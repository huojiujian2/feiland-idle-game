# �� 代码索引（AI 速查 v3.0 · 2026-08-28）

> **本文件 = 整本项目速查表。** 任何任务先读本文件 → 定位行号 → 再按需 `Read` 单个文件。
> 单文件 ≤ 500 行是项目红线（>800 必须拆分），本索引按行数标注热度。
> 行数已用脚本实测（`wc -l`），与 `docs/README/06-changelog.md` 同步。
>
> 维护人：项目主人 · 工具：TRAE

---

## 0. 项目一句话

**费兰德世界 v1.02**：Vue 3 + Express 西幻放置挂机游戏。
- 前端 dev/prod 端口 **3000**，后端 API 端口 **3001**（**严禁修改**）。
- 存档 `server/db.json`（含 `db.json.bak` 自动备份，原子写）。
- 主要系统：5 职业、装备/词条、挂机与离线收益、进化/法则/登神/转生、任务引导、PvP、世界 BOSS、称号、创世之书。

---

## 1. 阅读优先级（极重要）

按这个顺序读，能省 70% token：

1. �� **`docs/CODE_INDEX.md`**（本文件）—— 一站式速查
2. �� **`README.md`** —— 总目录 + 简介
3. �� **`docs/README/00-code-style.md`** —— 拆分规范（动手前必读）
4. �� 单个目标文件（按本文件 §3 §4 的行号定位）

---

## 2. 启动 & 脚本

```bash
npm run dev          # 并发：API(3001) + Vite(3000)
npm start            # 生产模式（start-all.js 拉起后端+前端服务器）
双击 启动游戏.bat    # Windows 一键
docker compose up    # Docker
npm test             # 运行 server/**/*.test.js（目前仅 skill.test.js）
```

---

## 3. 后端 `server/`（Node + Express）

### 3.1 入口 & 基础设施（5 文件，全部 ≤ 200 行）

| 文件 | 行 | 职责 |
|------|----|------|
| `index.js` | 122 | Express 入口：加载存档、注入引擎、注册路由、启动 5s 挂机 / 30s 存档 / 1min 竞技场周期定时器 |
| `web-server.js` | 151 | 生产前端服务器：托管 `client/dist`，`/api` 反代到 3001 |
| `start-all.js` | 49 | 生产一键：同时拉起 `index.js` + `web-server.js` |
| `store.js` | 88 | JSON 存储：load/save（原子写 + .bak 备份）+ 账号/角色/元数据 CRUD |
| `engine.js` | 4 | **旧版引擎入口**（已被 `engine/index.js` 取代，仅作兼容） |
| `data.js` | 4 | **旧版数据入口**（已被 `data/index.js` 取代，仅作兼容） |

### 3.2 游戏引擎 `server/engine/`（13 模块）★ 核心

入口 `engine/index.js` (213 行)：装配所有子模块 + `setHandler` 注入循环引用 + 统一导出。

| 子模块 | 行 | 关键导出 | 干啥的 |
|--------|----|---------|---------|
| `state.js` | 35 | `getNow / getRand / __setNow / __setRandom / isTestMode` | 测试 seam（时间、随机数可注入） |
| `utils.js` | 31 | `shouldDrop / buildBattleMonster / genUid / getActiveSkillCd / shouldTriggerActiveSkill` | 通用工具 |
| `stats.js` | 295 | `getEquipBonus / getAffixBonus / getRaceBonus / getGodhoodBonus / getReincarnationBonus / getTotalStats / getCombatStats / getJobGrowth / getJobTalents / getJobMechanics` | **属性聚合** |
| `player.js` | **546** ⚠️ | `createCharacter / allocateAttributes / autoAllocateAttributes / saveAttrPreset / grantGold / grantExpWithLevelUp / migratePlayer` | 角色 CRUD、属性点、升级、迁移 |
| `items.js` | 404 | `equipItem / equipAffix / sellMaterial / sellEquip / enchantItem / upgradeEquipment / mergeEquipment / reforgeEquipment / useConsumable / learnLaw / evolveRace / buyItem` | **装备/词条/附魔/合成/重铸/进化/消耗品** |
| `progression.js` | 251 | `chooseJob / attemptAscension / doReincarnate / getReincarnationInfo / getOfflineSummary / getReincShop / buyReincShopItem` | 职业/登神/转生/离线收益 |
| `daily.js` | 267 | `createDailyQuests / claimDaily / claimChest / claimAchievement / refreshDailyIfNeeded / findAffix / getJobStage / updateDailyProgress / updateTutorialStep` | 每日任务/成就/词条查找/教程 |
| `combat.js` | 319 | `calcDamage / getActionCount / simulateBattle / simulateBossBattle` | 回合制战斗（含 5 回合 BOSS 战） |
| `idle.js` | 339 | `calculateIdle / maybeResetWeeklyBossKills / setMetaGetter` | **挂机结算**（每 5s 调用） |
| `pvp.js` | **502** ⚠️ | `calcPvpRating / simulatePvP / createBot / generateArenaBots / settleArenaRewards / getSeasonKey / applySeasonResetToPlayers / buyArenaItem` | ELO 竞技场、AI bot、赛季结算、商店 |
| `worldboss.js` | 270 | `spawnWorldBoss / getActiveBoss / getBossExpiresAt / attackWorldBoss / settleWorldBossRewards / getBossRanking / getStrongestPlayer` | **世界 BOSS**：每日 0 点强结、按最强玩家 ×10 数值 |
| `genesis.js` | 410 | `isUnlocked / birthMonster / forgeEquip / deleteCustom / listByPlayer / rehydrateFromMeta / setMetaGetter / setStore` | **创世之书**：二转解锁，自定义怪物/装备，存 `meta.genesis` |
| `view.js` | 136 | `getPlayerView / getReadonlyPlayer / getPowerScore` | 玩家视图（前端展示用） |

**引擎装配模式（必读！避免循环引用）**：
```js
// engine/index.js
const realRecalcMaxStats = (p) => { /* ... */ };
player.setRecalcMaxStatsHandler(realRecalcMaxStats);
items.setRecalcMaxStatsHandler(realRecalcMaxStats);
progression.setRecalcMaxStatsHandler(realRecalcMaxStats);
idle.setRecalcMaxStatsHandler(realRecalcMaxStats);

player.setUpdateDailyProgress((p, id, inc) => daily.updateDailyProgress(p, id, inc));
daily.setGrantHandlers({ grantGold: player.grantGold, grantExpWithLevelUp: player.grantExpWithLevelUp });
idle.setGrantGoldHandler((p, amount) => player.grantGold(p, amount));
pvp.setBotCharacterDeps({ createCharacter: player.createCharacter, recalcMaxStats: realRecalcMaxStats });

// 创世系统：把 store.getMeta 注入到 idle/genesis
function setStore(store) {
  idle.setMetaGetter(() => store.getMeta());
  genesis.setMetaGetter(() => store.getMeta());
  genesis.rehydrateFromMeta(store.getMeta());
}
```

### 3.3 静态数据 `server/data/`（11 模块）

| 文件 | 行 | 职责 |
|------|----|------|
| `index.js` | 40 | 桶导出（聚合所有数据） |
| `areas.js` | 241 | **11 个挂机区域** + 怪物列表 |
| `equipment.js` | 193 | **装备模板** + 材料 + 词条（自创装备以 `custom_` 前缀） |
| `jobs.js` | 109 | **5 职业 × 4 阶** 天赋/机制/成长系数 |
| `monsters.js` | 35 | 45+ 怪物模板 + 24 个怪物技能 |
| `progression.js` | 97 | 转生/法则/登神/附魔配方参数 |
| `pvp.js` | 97 | 竞技场规则 |
| `quests.js` | 37 | 每日任务 + 成就 |
| `strategy.js` | 63 | 6 种战斗策略模式 |
| `genesis.js` | 287 | **创世之书** 8 种族 + 预算表 + LIMITS + oracleText |
| `titles.js` | 81 | 扫描 JOB_TREE 派生 20 职业称号 + 3 世界 BOSS 限时称号 |
| `affixes/index.js` | 24 | 词条桶导出 |
| `affixes/{novice,intermediate,advanced,master}.js` | 64 | 四档词条池 |

### 3.4 HTTP 路由 `server/routes/`（14 个模块）

`routes/index.js` 统一注册 `registerRoutes(app, store)`。玩家标识是 `username`。

| 文件 | 行 | 路径前缀 | 干啥 |
|------|----|---------|-------|
| `_helpers.js` | 22 | - | 通用 helper（认证/校验） |
| `auth.js` | 68 | `/api/register /api/login /api/player/:u/create-character /api/players/names` | 注册、登录、建角色、全服名册 |
| `account-exists.js` | 15 | `/api/account-exists` | 账号存在性检查 |
| `player.js` | 127 | `/api/player/:u/*` | 玩家状态、挂机/离线结算、属性分配、属性预设、头像 |
| `combat.js` | 150 | `/api/player/:u/{affix,equip,buy,use,sell,equipment/*}` | 词条、装备、商店、出售、锻造 |
| `progression.js` | 101 | `/api/player/:u/{job,evolve,enchant,learn-law,ascend,reincarnate} + /api/reinc-shop` | 职业、种族、附魔、法则、登神、转生 |
| `pvp.js` | 345 | `/api/arena/*` | 竞技场全接口、排名、记录、赛季、奖励、商店 |
| `worldboss.js` | 59 | `/api/worldboss/*` + `/api/player/:u/worldboss/attack` | 世界 BOSS 查询、攻击、刷新 |
| `codex.js` | 161 | `/api/areas /api/codex /api/data/enchants` | 区域、图鉴、附魔配方 |
| `leaderboard.js` | 78 | `/api/leaderboard` | 6 维度排行 |
| `strategy.js` | 66 | `/api/player/:u/strategy` | 战斗策略设置 |
| `quest.js` | 44 | `/api/player/:u/quest/*` + `/tutorial` | 每日任务、宝箱、成就、教程 |
| `genesis.js` | 73 | `/api/player/:u/genesis*` + `/api/genesis/public` | 创世之书 CRUD、公开造物 |
| `titles.js` | 53 | `/api/player/:u/titles*` | 称号查询、佩戴/卸下 |

**重要约定**：
- 响应格式统一 `{ success: boolean, data?, message? }`。
- `/api` 未匹配返回 JSON 404（不被前端兜底吞掉）。

---

## 4. 前端 `client/src/`（Vue 3 + Vite）

### 4.1 根级（10 文件）

| 文件 | 行 | 职责 |
|------|----|------|
| `App.vue` | **545** ⚠️ | **主应用**：登录态 + 11 Tab 路由 + 5s 轮询 + 30+ handle 业务方法 |
| `api.js` | 208 | **API 请求封装**（与后端路由一对一，约 40 个方法） |
| `main.js` | 8 | Vue 应用入口 |
| `style.css` | 814 ⚠️ | 全局样式 + CSS 变量（品质色/品质边框/徽章动画 + RGB 三元组） |
| `theme.js` | 50 | 主题切换 + localStorage 持久化（key: `ferland-theme`） |
| `themes.css` | 99 | 主题样式表（星夜/暗金/羊皮纸三种） |
| `ui-bridge.js` | 74 | **全局 Toast + Modal 队列**（替代 alert/confirm） |
| `composables/useLongPress.js` | 145 | 长按手势 composable |
| `utils/avatars.js` | 25 | 5 选 1 头像选项（v1.02） |
| `utils/timeTitles.js` | 12 | 称号时长格式化 |

### 4.2 业务页面组件（11 个 Tab 主页）

`App.vue` 的 `tabOrder`：`char → skill → bag → map → codex → evo → rank → quest → pvp → boss → genesis`
**底部 TabBar** 只显示 5 个：`char / skill / map / bag / codex`（其余从地图页侧边抽屉进入）。

| 文件 | 行 | Tab | 干啥 | 拆分建议 |
|------|----|-----|------|---------|
| `LoginScreen.vue` | **1541** �� | 初始 | 登录/注册/创建角色 | **超红线 800**，候选拆 4 子组件 |
| `CharacterView.vue` | **926** �� | `char` | 角色页（属性/职业/装备/头像选择） | **超红线 800**，候选拆 3 子组件 |
| `SkillView.vue` | 306 | `skill` | 词条页（装备/卸下） | - |
| `InventoryView.vue` | **732** ⚠️ | `bag` | 背包（装备/材料/锻造/合成/重铸/批量出售/整理） | 接近红线 |
| `MapView.vue` | 258 | `map` | 地图（区域选择 + 战斗入口），已拆 7 子组件 | - |
| `CodexView.vue` | 373 | `codex` | 图鉴（材料/装备/怪物/消耗品） | - |
| `EvolutionView.vue` | 157 | `evo` | 进化（拆 4 Tab 子组件） | - |
| `LeaderboardView.vue` | 226 | `rank` | 排行榜（6 维度） | - |
| `QuestView.vue` | 227 | `quest` | 任务/成就 | - |
| `PvPView.vue` | 190 | `pvp` | 竞技场（拆 7 子组件） | - |
| `WorldBossView.vue` | 313 | `boss` | 世界 BOSS（每日 1 次 / 5 回合战报 / 称号奖励） | - |
| `GenesisView.vue` | **1190** �� | `genesis` | **创世之书**（二转解锁） | **超红线 800**，候选拆 4 子组件 |

### 4.3 辅助组件（13 个）

| 文件 | 行 | 用途 |
|------|----|------|
| `TopBar.vue` | 202 | 顶部状态栏（头像/属性 chip/金币/设置/登出） |
| `TabBar.vue` | 138 | 底部 5 Tab + 中心地图圆形凸按钮 |
| `ShopModal.vue` | 274 | 商店 Action Sheet |
| `EquipDetailModal.vue` | 127 | 装备详情弹窗（升级/合成/重铸入口） |
| `OfflineRewardModal.vue` | 90 | 离线收益弹窗 |
| `LevelUpNotice.vue` | 25 | 升级飘字 |
| `TutorialOverlay.vue` | 191 | 新手引导高亮（6 步） |
| `UIBridge.vue` | 167 | 全局 Toast/Modal 渲染层 |
| `TitleModal.vue` | 249 | 称号查询、佩戴与卸下弹窗 |
| `JobView.vue` | 103 | 职业信息视图 |
| `ThemeModal.vue` | 181 | 主题与外观设置弹窗 |
| `ReincarnHintModal.vue` | 193 | 转生提示弹窗 |
| `icons/IconBase.vue` | 70 | 图标组件（PNG 优先，emoji 兜底） |
| `icons/icons.js` | 197 | 图标注册表（key → PNG/em 映射） |

### 4.4 `map/` 子组件（已拆分完成）

| 文件 | 行 | 用途 |
|------|----|------|
| `MapAreaSelector.vue` | 57 | 区域列表 |
| `BattleStrategy.vue` | 71 | 战斗策略选择 |
| `BattleLog.vue` | 234 | 战斗日志列表 |
| `BattleLogDetail.vue` | 224 | 单条战斗日志详情 |
| `DamageLayer.vue` | 40 | 伤害飘字层 |
| `DropsPopup.vue` | 42 | 战利品弹窗 |
| `battleLogUtils.js` | 167 | 日志解析工具 |

### 4.5 `evolution/` 子组件

`RaceTab.vue` (122) / `LawTab.vue` (92) / `AscendTab.vue` (118) / `ReincTab.vue` (171)

### 4.6 `pvp/` 子组件

`PvPHeader.vue` (103) / `PvPOpponents.vue` (65) / `PvPRanking.vue` (62) / `PvPRecords.vue` (64) / `PvPRewards.vue` (140) / `PvPShop.vue` (68) / `PvPBattleReplay.vue` (111) / `pvpUtils.js` (64)

---

## 5. 数据流向 & 调用链速查

### 5.1 一个按钮点击的完整链路（例：附魔）

```
用户点"附魔" → InventoryView.vue 调 handleEnchant(itemUid, recipeId)
    → App.vue 的 handleEnchant 调 api.enchant(...)
        → 走 client/src/api.js 的封装 POST /api/player/:user/enchant
            → server/index.js 注册的路由
                → server/routes/player.js
                    → server/engine/items.js#enchantItem
                        → 改 player.equips → store.setPlayer → markDirty → 5s 后 save
                            → 返回 { success: true, data: player }
                                → App.vue 更新 player.value → Vue 响应式刷新
```

### 5.2 5 秒定时任务（`server/index.js` L34-L39）

```js
setInterval(() => {
  engine.maybeResetWeeklyBossKills(store);
  const players = store.getAllPlayers();
  for (const player of players) engine.calculateIdle(player);
  if (players.length > 0) store.save();
}, 5000);
```

→ `engine/idle.js#calculateIdle(p)` 是挂机结算核心（经验/金币/掉落/战斗模拟/升级/任务进度）。

### 5.3 跨模块调用约定

| 想做的事 | 调用 |
|---------|------|
| 创建/查找玩家 | `engine/player.js` |
| 改装备/词条 | `engine/items.js` |
| 改经验/金币/升级 | `engine/player.js#grantGold / grantExpWithLevelUp` |
| 加任务进度 | `engine/daily.js#updateDailyProgress` |
| 触发战斗 | `engine/combat.js#simulateBattle` |
| 存 player | `store.setPlayer(username, player)` |
| 触发 BOSS 战 | `engine/combat.js#simulateBossBattle` |
| 取最强玩家 | `engine/worldboss.js#getStrongestPlayer` |

### 5.4 创世自创装备同步流程（易错点）

```
玩家在 GenesisView 提交造物
  → routes/genesis.js 接收 → engine/genesis.js#forgeEquip
    → 写入 store.getMeta().genesis.customEquips[id] = { ..., _owner: username }
      → service:setStore(store) 启动时调 genesis.rehydrateFromMeta(meta)
        → 把 custom_* 注册回 EQUIP_TEMPLATES（引擎 items.js 才能识别）
```

**重启后自创装备"找不到"99% 是因为没调 `engine.setStore(store)`**。

---

## 6. 体积红线 & 健康度（重要！）

> 由 `00-code-style.md` 规定：单文件 **> 800 行必须拆分**。

| 状态 | 文件 | 行数 | 优先级 |
|------|------|------|--------|
| �� 超红线 | `client/src/components/LoginScreen.vue` | **1541** | P0 候选拆 4 子组件 |
| �� 超红线 | `client/src/components/GenesisView.vue` | **1190** | P1 候选拆 4 子组件 |
| �� 超红线 | `client/src/components/CharacterView.vue` | **926** | P1 候选拆 3 子组件 |
| �� 超红线 | `client/src/style.css` | **814** | P1（CSS 可容忍但建议拆主题/通用/动画） |
| ⚠️ 接近红线 | `client/src/components/InventoryView.vue` | **732** | P2 |
| ⚠️ 接近红线 | `client/src/App.vue` | **545** | P2 |
| ⚠️ 接近红线 | `server/engine/player.js` | **546** | P2 |
| ⚠️ 接近红线 | `server/engine/pvp.js` | **502** | P2 |

**拆分原则**：
- Vue：抽成 `components/<原名>/<子功能>.vue`，父组件只保留 `tab` 切换 + props 透传。
- 引擎 JS：按"领域"切（如 `items-enchant.js` / `items-equip.js`），用 `setHandler` 注入共享函数。
- 原文件保留 4~10 行的重定向壳（`module.exports = require('./xxx/index')`）。

---

## 7. 关键设计原则（修改前必看）

| 原则 | 说明 |
|------|------|
| **玩家存盘** | 任何 player 改动后调 `store.setPlayer`（自动 markDirty） |
| **原子写** | 改 `db.json` 用 `.tmp + rename`，每小时滚一次 `.bak` |
| **循环引用** | 引擎用 `setHandler` 注入模式，**不要** 直接 require 形成循环 |
| **参数校验前置** | 创世之书的怪物/装备属性超过预算**立即拒绝**，不要等后置结算 |
| **响应格式** | 所有路由响应 `{ success, data?, message? }` |
| **端口** | 前端 3000 / 后端 3001，**不要改** |
| **API 路径** | `/api/...`，前端开发模式走 vite proxy，生产走 web-server.js 反代 |
| **创世数据恢复** | 服务启动时 `engine.setStore(store)` 会把 `meta.genesis` 重新注册回 EQUIP_TEMPLATES |
| **新装备前缀** | 自创装备 ID 以 `custom_` 开头，避免和系统模板冲突 |
| **代码行数** | 单文件 ≤ 500 行（软上限），> 800 行必须拆 |
| **测试 seam** | 引擎 `state.js` 提供 `__setNow / __setRandom` 让测试可注入 |

---

## 8. AI 协作工作流（6 步法）

1. **接到任务** → 先读本文件 `docs/CODE_INDEX.md`（约 360 行）
2. **定位文件** → 看第 3/4 章找路径，第 6 章看行数/红线
3. **理解业务** → 必要时读 `docs/README/01-gameplay.md` 或 `02-systems.md`
4. **看版本历史** → 改动前先查 `docs/README/06-changelog.md` 看是否已有类似修复
5. **改代码** → 严格遵守 `00-code-style.md`（单文件 ≤ 500 行，> 800 必须拆）
6. **改完验证** → `npm test` + `npm run build`，并在 `06-changelog.md` 追加新版本

---

## 9. 常见任务速查表（高频任务）

| 用户问 | 看哪里 |
|--------|-------|
| "加一个新的词条" | `server/data/affixes/{novice\|intermediate\|advanced\|master}.js` + `SkillView.vue` |
| "加一个新区域" | `server/data/areas.js` + `server/data/monsters.js` + `client/components/MapView.vue` |
| "加一个新职业" | `server/data/jobs.js` + `CharacterView.vue` |
| "改附魔公式" | `server/engine/items.js#enchantItem` |
| "改转生加成曲线" | `server/engine/progression.js` + `server/data/progression.js` |
| "创世之书扩展" | `server/engine/genesis.js` + `server/data/genesis.js` + `GenesisView.vue` |
| "改 PvP 积分公式" | `server/engine/pvp.js#calcPvpRating` |
| "改战斗公式" | `server/engine/combat.js#calcDamage` |
| "挂机收益调参" | `server/engine/idle.js#calculateIdle` |
| "新手指引改动" | `server/engine/daily.js#updateTutorialStep` + `TutorialOverlay.vue` |
| "排行榜加维度" | `server/routes/leaderboard.js` + `LeaderboardView.vue` |
| "加一个新 Tab" | `App.vue` 的 `tabOrder/mainTabs` + 新建 `components/<X>View.vue` + `routes/` 注册 |
| "前端换主题" | `theme.js` + `themes.css`（不动数值） |
| "称号调整" | `server/data/titles.js` (自动派生) + `TitleModal.vue` |
| "世界 BOSS 调数值" | `server/engine/worldboss.js` 中倍率常量（hp×5, atk×3, def×1, agi×1） |
| "前端按钮无响应" | `App.vue` 的对应 handle* 方法 → `client/src/api.js` → `server/routes/*` → `server/engine/*` |
| "存档丢失/回滚" | `server/db.json` + `server/db.json.bak`（自动备份） |
| "拆分 XX 大文件" | 见第 6 章红线表 |

---

## 10. 严禁事项

- ❌ 改端口号（3000/3001 统一约定）
- ❌ 在 `engine/` 子模块间直接 `require` 形成循环（用 setHandler 注入）
- ❌ 单文件超 800 行不拆
- ❌ 跳过原子写直接改 `db.json`
- ❌ 改 `meta.genesis` 不调 `engine.setStore`（重启会丢自创内容）
- ❌ 前端直接读 `localStorage` 存游戏状态（用后端）
- ❌ 把数据库 ID 写死（自创装备用 `custom_` 前缀）
- ❌ 在 README/changelog 之外写中文说明文案到代码（注释除外）

---

## 11. 本索引的元信息

| 项目 | 值 |
|------|------|
| 本文件行数 | 约 360 行 |
| 维护人 | 项目主人 |
| 最近重写 | v3.0 · 2026-08-28（用 `wc -l` 实