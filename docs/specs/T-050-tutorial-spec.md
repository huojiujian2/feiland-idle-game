# T-050 新手引导教程 — 技术方案 Spec v10（待审核）

> 严格按 `GAMEPLAY_GUIDE.html:702` 范围，不扩展。v10 修复 v9 的 1×P1 + 4×P2，闭合 fallback 与补偿重试（非事务原子）。

## 1. 背景与目标

- 现状：无引导，新玩家不知操作路径；现有 UI 已有战斗日志/角色/地图/背包/技能 Tab，`App.vue:80` 默认 `activeTab='char'`，`MapView` 为 `v-if`。
- 目标：分步高亮引导，手把手教操作，完成后不再出现，可跳过，刷新后恢复。

## 2. 需求澄清（状态机、强校验与显示/持久化分离）

**6 步状态机（`STEPS` 长度 6 索引 0-5 复用指南六段原文（欢迎/升级/加点/地图/背包/技能），step6 为完成哨兵不占 STEPS）**

| step | 名称 | 持久化可进入（允许持久化为该值） | 显示条件（`overlayVisible`） | 完成事件（`App` 显式包装，经 POST 强校验） | 高亮目标 |
|------|------|----------------------------------|------------------------------|------------------------------------------|----------|
| 0 | 欢迎 | `0` | 恒真 | `TutorialOverlay emit('next')` → `App` `POST {1}`（仅 step0 显示“下一步”，其余步骤“下一步”由 Tab/分配代理，不额外显示） | `MapView` `[data-tutorial=log]`；**新角色以 `create-character` 响应 `playerView` 为首次 hydrate，已有角色以首次 `GET /player` 为首次 hydrate；`migrate` 仅归一数据；首次 hydrate 若 `tutorialStep===0` 由 `App` 自动切 `map`，后续轮询 0 不强制切回** |
| 1 | 升级 | `1` | 恒真 | `App.handleTabClick('char')` 内 `POST {2}` | `[data-tab=char]` |
| 2 | 加点 | `2` | `targetReady` 为 false 时仍显示但居中降级（见下） | `App.handleAllocate` 成功（`POST /api/player/:username/attributes` 200 且 `r.data.questView.dailyQuests.find(x=>x.id==='alloc1').done===true`）后 `POST {3}`；若第二请求 409/网络异常（捕获 `catch`），下次 `GET /player` 成功轮询检测到 `alloc1.done && tutorialStep===2` 且无 `retrying` 标记时自动重试一次（置 `retrying=true` 防并发，请求 `finally` 清除标记；成功后 `tutorialStep!==2` 即停止，失败则清除标记允许下次成功轮询再次重试） | 包裹容器 `[data-tutorial=alloc-wrap]` |
| 3 | 地图 | `3` | 恒真 | `App.handleTabClick('map')` 内 `POST {4}` | `[data-tab=map]` |
| 4 | 背包 | `4` （`3→4` 无门槛） | `level>=5` 否则隐藏等待 | `App.handleTabClick('bag')` 内 `POST {5}` 需 `level>=5` 否则 409 | `[data-tab=bag]` |
| 5 | 技能 | `5` （`4→5` 需 `level>=5`） | `jobPath!=null` 否则隐藏等待 | `App.handleTabClick('skill')` 内 `POST {6}` 需 `jobPath!=null` 否则 409 | `[data-tab=skill]` |
| 6 | 完成 | `6` | — | — | 遮罩消失 |

- **三态分离（修复 v5 不可达）**：
  ```js
  waiting = (step===4 && level<5) || (step===5 && !jobPath)
  baseVisible = (0 <= step && step <= 5) && !waiting
  overlayVisible = baseVisible
  targetReady(step2) = !!document.querySelector('[data-tutorial=alloc-wrap] [data-alloc-available]')
  fallbackCenter = baseVisible && step===2 && !targetReady
  ```
  `baseVisible` 为范围判断（`0 <= step && step <= 5`），`overlayVisible` 不再包含 `targetReady`，`fallbackCenter` 覆盖 `!targetReady` 时居中降级并 `requestAnimationFrame` 轮询直到 `targetReady`。

- **推进链路（App 显式包装，失败不推进，含重试）**：
  - `App.handleTabClick(tab)`：切 `activeTab` 后，若 `tutorialStep` 与 `tab` 对应且 `overlayVisible`，则 `await api.updateTutorial(current+1)`；409/400 保持当前步。
  - `App.handleAllocate(allocation)`：`const r = await api.allocateAttributes(...); if(!r.success) return; // 不推进`；`const done = r.data.questView.dailyQuests.find(x=>x.id==='alloc1').done`（**读取 `r.data.questView` 而非 `player.questView` 更新前状态**）；若 `tutorialStep===2 && done` 则 `await api.updateTutorial(3)`；若第二请求失败（409/网络），**下次 `GET /player` 成功轮询检测到 `alloc1.done && tutorialStep===2` 且无 `retrying` 时自动重试一次 `POST {3}`（`finally` 清除标记，成功后停止，失败可下次再试）**，避免停滞。
  - `TutorialOverlay` 仅 `emit('next')`/`emit('skip')`，`App` 监听后调 `api.updateTutorial` 并 `player = res.data` 回写；`next` 仅 step0 显示，其余步骤通过 Tab/分配代理推进，不额外显示“下一步”绕过。
  - 跳过：`emit('skip')` → `POST {6}` 任意 200 幂等；重复 `current` 409，`6` 重复 200。

- **样式 token**：`style.css` 定义 `--tutorial-overlay-bg: rgba(0,0,0,0.6)`、`--tutorial-blur: blur(2px)`、`--tutorial-outline: 2px solid var(--accent)`、`--tutorial-z: 400` 默认值，组件内仅 `var(--tutorial-*)` 无 fallback 硬编码，动效仅 `var(--duration-*/--ease-*)`。

## 3. 涉及文件（严格限定，v10）

- `server/engine.js` — `migratePlayer` 追加 `tutorialStep:number`（0-6，`tutorialDone` 派生），`createCharacter` `0`，`getPlayerView` 暴露，`updateTutorialStep` 校验单调 + 条件（`4→5 level>=5`、`5→6 jobPath`、`2→3 alloc1.done`）。
- `server/index.js` — 固定 `POST /api/player/:username/tutorial`（400/404/409/200）。
- `server/data.js` — 无。
- `client/src/components/TutorialOverlay.vue` — 新建，`STEPS` 长度 6 索引 0-5，`overlayVisible/targetReady/waiting/fallbackCenter` 四态，`emit next/skip`，4 块镂空，`nextTick` + `requestAnimationFrame` 重算。
- `client/src/components/MapView.vue` — 追加 `data-tutorial="log"`。
- `client/src/components/CharacterView.vue` — 包裹容器 `data-tutorial="alloc-wrap"`，内按钮 `data-alloc-available` 仅当 `attrPoints>0` 时渲染且 `!disabled`。
- `client/src/style.css` — 新增 `--tutorial-overlay-bg/--tutorial-blur/--tutorial-outline/--tutorial-z` 默认值。
- `client/src/App.vue` — 引入 `TutorialOverlay`，`handleTabClick/handleAllocate` 显式推进 + 重试，首次 hydrate 自动切 `map`，`data-tab` 必备。
- `client/src/api.js` — `updateTutorial(username, step)`。
- `server/tutorial.test.js` — 创建/迁移/视图/API 单调/条件/非法/跳过/刷新/等待隐藏/重试（服务端）；App 轮询重试/Tab 代理/DOM/rAF/自动切图为手工验收，不纳入服务端单测。
- 不新增其他系统。

## 4. 数据与落点

```js
// player 扩展
tutorialStep: number // 0-6 整数，派生 tutorialDone = step===6
```

- `migratePlayer`：归一 `!Number.isFinite||<0→0`、`>6→6`、`Math.floor`；`tutorialDone` 派生；老存档统一 `0`。
- `createCharacter`：`0`。
- `getPlayerView`：返回 `tutorialStep` 与派生 `tutorialDone`。
- `updateTutorialStep(player, nextStep)`：400 非整数/越界；`6` 任意 200 幂等；`current` 重复 409；`current+1` 时：`2→3` 校验 `player.dailyQuests.find(x=>x.id==='alloc1').done===true`（服务端路径）且视图路径 `r.data.questView.dailyQuests` 同步；`4→5` 校验 `level>=5`；`5→6` 校验 `jobPath!=null`；成功置 `step`。
- `TutorialOverlay`：`baseVisible/overlayVisible/fallbackCenter` 如上，`querySelector('[data-tutorial=alloc-wrap]')` 内 `querySelectorAll('[data-alloc-available]')` 合并包裹 `boundingRect`，单一容器契约。

## 5. 交互时序（起点为 create-character，经 App 包装，含重试）

- `POST /create-character` 成功响应 `playerView` 本身即首次 hydrate（`tutorialStep===0`）→ `App` 置 `player=res.data` 后立即若 `tutorialStep===0` 自动切 `map`；后续 `GET /player` 首次 hydrate 亦同（`migrate` 仅归一数据不切 Tab），后续轮询 0 不强制切回 → 步骤0 `overlayVisible`
- `emit next` → `App` `POST /tutorial {1}` → 200 → 步骤1；`handleTabClick('char')` → `POST {2}` → 200；`handleAllocate` 成功且 `r.data.questView.dailyQuests.find(x=>x.id==='alloc1').done` → `POST {3}` → 200，失败（409/网络异常捕获）则等待下次成功轮询补偿重试一次（进行中标记防并发，成功后停止）；`handleTabClick('map')` → `POST {4}` → 200；等待 `level>=5` 后 `handleTabClick('bag')` → `POST {5}` → 200；等待 `jobPath` 后 `handleTabClick('skill')` → `POST {6}` → 200；`skip` → `POST {6}` 任意

```http
POST /api/player/:username/tutorial
Body: {step: number 0-6}
200 {success:true,data:playerView}
409 {success:false,message:'步骤不连续'或'条件未满足'}
404 {success:false,message:'角色不存在'}
400 {success:false,message:'step 非法'}
```

## 6. 验收标准

- [ ] 6 步按表：0 首次 hydrate 自动切 map、1 角色 Tab、2 需 `alloc1.done`（`POST /attributes` 成功原子置 `alloc1.done`，教程经第二请求及轮询补偿推进，失败重试）、4 等待 `Lv.5`、5 等待 `jobPath` 隐藏、跳过至 6；推进经 `App.handle*` 显式包装，失败 409 不推进
- [ ] 单调 409（重复非 6、跳级、条件未满足）、6 幂等 200；`waiting/fallbackCenter/baseVisible` 覆盖无目标/未达条件；刷新恢复；`STEPS` 长度 6 索引 0-5
- [ ] 遮罩 backdrop 拦截孔放行，`position:fixed` 仅 `var(--tutorial-*)`，`MapView/CharacterView` 选择器稳定，`alloc-wrap` 单容器多矩形合并
- [ ] `App` `data-tab` 必备，`TutorialOverlay` 仅 `emit` 由 `App` 调 API 并回写 `player`，`r.data.questView` 读取
- [ ] 持久化统一 0 起步，派生 `tutorialDone`
- [ ] `pnpm build`/`git diff --check` 通过，`tutorial.test.js` 覆盖创建/迁移/视图/API 单调/条件/非法/跳过/刷新/等待隐藏/重试；手工验收遮罩穿透/Tab 点击/`requestAnimationFrame` 重算/自动切图

## 7. 风险与回退

- 风险：目标未渲染 — `nextTick` + `requestAnimationFrame` 轮询，失败居中。
- 回退：移除 `TutorialOverlay` 与 `tutorialStep`。
