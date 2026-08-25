# 📚 代码索引（AI 协作地图）

> **目的**：让任何 AI 在接手这个项目时，**不用读完整工程**就能精准定位代码。
> 当用户问"XX 功能在哪里"或"修 XX bug"时，**先看本索引**，再针对性 Read 文件。
> 本文档约 200 行，可一次性完整加载，**预计节省 60%~80% token**。

---

## 0. 项目一句话

**费兰德世界**：Vue 3 + Express 的西幻放置挂机游戏（v0.7）。
- 前端端口 **3000**，后端 API 端口 **3001**（固定不变）。
- 存档 `server/db.json`（含 `db.json.bak` 自动备份，原子写）。
- **重要规范**：单文件 ≤ 500 行，超 800 行必须拆（详见 `docs/README/00-code-style.md`）。

---

## 1. 文档速查

| 文件 | 用途 |
|------|------|
| `README.md` | 主入口 + 目录 |
| `docs/README/00-code-style.md` | **代码模块化规范（重要！）** |
| `docs/README/01-gameplay.md` | 玩法（职业/词条/新手指南） |
| `docs/README/02-systems.md` | 系统详解（转生/锻造/BOSS/PvP） |
| `docs/README/03-areas-and-equipment.md` | 11 区域 + 装备 + 怪物技能 |
| `docs/README/04-quickstart.md` | 启动部署 |
| `docs/README/05-architecture.md` | 项目结构 + 技术栈 |
| `docs/README/06-changelog.md` | 版本历史（v0.1 → v0.7） |
| `docs/CODE_INDEX.md` | **本文件**（AI 优先读我） |
| `docs/specs/T-*.md` | 5 个具体需求规格 |

---

## 2. 启动 & 脚本

```bash
npm run dev          # 并发：API(3001) + Vite(3000)
npm start            # 生产模式（start-all.js 拉起后端+前端服务器）
双击 启动游戏.bat    # Windows 一键
docker compose up    # Docker
node server/skill.test.js   # 单测
```

---

## 3. 后端 `server/`（Node + Express）

### 3.1 入口 & 基础设施

| 文件 | 行 | 职责 |
|------|------|------|
| `index.js` | 122 | Express 服务器入口：注册路由 + 启动定时任务（5s 挂机结算/30s 存档/1min 竞技场结算/1min 周重置） |
| `web-server.js` | - | 生产前端服务器：托管 `client/dist`，`/api` 反代到 3001 |
| `start-all.js` | - | 生产一键：同时拉起 index.js + web-server.js |
| `store.js` | 87 | JSON 存储：load/save（原子写 + .bak 备份）+ 账号/角色/元数据 CRUD |

### 3.2 游戏引擎 `server/engine/`（按 v0.4 拆分，共 13 模块）

**入口**：`engine/index.js` (191 行) —— 装配所有子模块 + 注入循环引用（setHandler 模式） + 统一导出。

| 子模块 | 行 | 关键导出 | 干什么的 |
|--------|-----|---------|---------|
| `state.js` | - | `getNow / __setNow / __setRandom` | 测试 seam（时间、随机数可注入） |
| `utils.js` | - | `shouldDrop / buildBattleMonster / genUid / getActiveSkillCd / shouldTriggerActiveSkill` | 通用工具 |
| `stats.js` | 273 | `getEquipBonus / getAffixBonus / getRaceBonus / getGodhoodBonus / getReincarnationBonus / getTotalStats / getCombatStats` | **属性聚合**（词条/装备/种族/神位/转生加成） |
| `player.js` | 334 | `createCharacter / allocateAttributes / autoAllocateAttributes / saveAttrPreset / grantGold / grantExpWithLevelUp / migratePlayer` | 角色 CRUD、属性点、升级、迁移 |
| `items.js` | 374 | `equipItem / equipAffix / sellMaterial / sellEquip / enchantItem / upgradeEquipment / mergeEquipment / reforgeEquipment / useConsumable / learnLaw / evolveRace / buyItem` | **装备/词条/附魔/合成/重铸/进化/消耗品** |
| `progression.js` | 232 | `chooseJob / attemptAscension / doReincarnate / getReincarnationInfo / getOfflineSummary / updateOfflineSnapshot` | 职业选择/登神/转生/离线收益 |
| `daily.js` | 255 | `createDailyQuests / claimDaily / claimChest / claimAchievement / refreshDailyIfNeeded / findAffix / getJobStage / getPassiveSlots / updateDailyProgress` | 每日任务/成就/词条查找/职业阶段表/教程步骤 |
| `combat.js` | 217 | `calcDamage / getActionCount / simulateBattle` | 回合制战斗（伤害公式/行动数/PVE 模拟） |
| `idle.js` | 298 | `calculateIdle` | **挂机结算**（每 5 秒调用一次） |
| `pvp.js` | 463 | `calcPvpRating / simulatePvP / createBot / generateArenaBots / settleArenaRewards / getSeasonKey / applySeasonResetToPlayers` | ELO 竞技场 + AI bot + 赛季日/周/月结算 |
| `worldboss.js` | - | `spawnWorldBoss / getActiveBoss / attackWorldBoss / settleWorldBossRewards / getBossRanking` | 世界 BOSS（每 30 分钟刷新） |
| `genesis.js` | 243 | `birthMonster / forgeEquip / deleteCustom / listByPlayer / rehydrateFromMeta / setMetaGetter` | **创世之书（v0.7）**：自定义怪物/装备，存 meta.genesis |
| `view.js` | - | `getPlayerView / getReadonlyPlayer / getPowerScore` | 玩家视图（前端展示用） |

**引擎装配模式**（重要！避免循环引用）：
```js
// engine/index.js
const realRecalcMaxStats = (p) => { ... };
player.setRecalcMaxStatsHandler(realRecalcMaxStats);
items.setRecalcMaxStatsHandler(realRecalcMaxStats);
// 多个模块共享同一个 recalcMaxStats
```

### 3.3 静态数据 `server/data/`（v0.4 拆分）

| 文件 | 职责 |
|------|------|
| `index.js` | 桶导出 |
| `areas.js` (235) | 11 个挂机区域 + 怪物列表 |
| `equipment.js` (174) | 装备模板 + 材料 + 词条（自创装备以 `custom_` 前缀注册） |
| `jobs.js` | 5 职业 × 4 阶 天赋/机制/成长系数 |
| `monsters.js` | 45+ 怪物模板 + 24 个怪物技能 |
| `progression.js` | 转生/法则/登神/附魔配方参数 |
| `pvp.js` | 竞技场规则 |
| `quests.js` | 每日任务 + 成就 |
| `strategy.js` | 6 种战斗策略模式 |
| `genesis.js` | **创世之书** 8 种族 + 预算表 + LIMITS + oracleText |
| `affixes/` | 词条按等级拆分（novice/intermediate/advanced/master + index） |

### 3.4 HTTP 路由 `server/routes/`（v0.4 拆分，共 11 模块）

| 文件 | 路径前缀 | 干什么 |
|------|---------|-------|
| `index.js` | - | `registerRoutes(app, store)` 总开关 |
| `_helpers.js` | - | 通用 helper（认证/校验） |
| `auth.js` | `/api/register /api/login /api/player/:user/create-character` | 登录注册建角色 |
| `player.js` | `/api/player/:user/*` | 玩家状态/属性分配/换区/装备/转生/登神/商店/附魔/进化/策略/任务 |
| `combat.js` | - | 战斗相关（测试用，正常不走 HTTP） |
| `progression.js` | `/api/player/:user/reincarnation /reinc-shop` | 转生点数 + 转生商店 |
| `pvp.js` (312) | `/api/arena/*` | 竞技场全接口 |
| `worldboss.js` | `/api/worldboss/*` + `/api/player/:user/worldboss/attack` | 世界 BOSS |
| `codex.js` | `/api/codex` | 图鉴数据 |
| `leaderboard.js` | `/api/leaderboard` | 6 维度排行 |
| `strategy.js` | - | 战斗策略设置 |
| `quest.js` | - | 任务领取 |
| `genesis.js` | `/api/player/:user/genesis*` | 创世之书 CRUD |

**重要路由约定**：
- 玩家标识是 `username`（账号名/角色名复用）
- 所有响应格式 `{ success: boolean, data?, message? }`
- `/api` 未匹配返回 JSON 404（避免被前端兜底吞掉）

---

## 4. 前端 `client/src/`（Vue 3 + Vite）

### 4.1 根级

| 文件 | 行 | 职责 |
|------|-----|------|
| `main.js` | - | Vue 应用入口 |
| `App.vue` | 358 | **主应用**：登录态 + 11 Tab 路由 + 5 秒轮询 + 30+ handle 业务方法 |
| `api.js` | 159 | **API 请求封装**（与后端路由一对一） |
| `style.css` | - | 全局样式 + CSS 变量（品质色/品质边框/徽章动画等） |
| `ui-bridge.js` | 75 | **全局 Toast + Modal 队列**（替代 alert/confirm）：`toast.success/error/warn`、`modalAlert`、`modalConfirm` |

### 4.2 业务页面组件 `components/`

**主页面**（11 个 Tab）：

| 文件 | 行 | Tab 触发 | 干啥 |
|------|-----|---------|------|
| `LoginScreen.vue` | - | 初始 | 登录/注册/创建角色 |
| `CharacterView.vue` | 561 | `char` | 角色页（属性分配/职业选择/装备栏） |
| `SkillView.vue` | 278 | `skill` | 词条页（装备/卸下） |
| `InventoryView.vue` | 526 | `bag` | 背包（装备/材料/锻造/合成/重铸/批量出售） |
| `MapView.vue` | - | `map` | 地图（区域选择 + 战斗入口），内部拆 7 子组件见下 |
| `CodexView.vue` | 311 | `codex` | 图鉴（材料/装备/怪物/消耗品） |
| `EvolutionView.vue` | - | `evo` | 进化（拆 4 Tab 子组件） |
| `LeaderboardView.vue` | 191 | `rank` | 排行榜（6 维度） |
| `QuestView.vue` | - | `quest` | 任务/成就 |
| `PvPView.vue` | 172 | `pvp` | 竞技场（拆 7 子组件） |
| `WorldBossView.vue` | 190 | `boss` | 世界 BOSS |
| `GenesisView.vue` | 409 | `genesis` | **创世之书**（v0.7） |

**辅助组件**：

| 文件 | 行 | 用途 |
|------|-----|------|
| `TopBar.vue` | 249 | 顶部状态栏（头像/属性 chip/金币/设置/登出） |
| `TabBar.vue` | - | 底部 5 Tab + 中心地图圆形凸按钮 |
| `OfflineRewardModal.vue` | - | 离线收益弹窗 |
| `LevelUpNotice.vue` | - | 升级飘字 |
| `ShopModal.vue` | - | 商店 Action Sheet |
| `EquipDetailModal.vue` | - | 装备详情弹窗（升级/合成/重铸入口） |
| `TutorialOverlay.vue` | 185 | 新手引导高亮 |
| `UIBridge.vue` | 161 | 全局 Toast/Modal 渲染层 |
| `icons/IconBase.vue` + `icons/icons.js` | - | 图标组件（PNG 优先，emoji 兜底） |

**地图子组件 `map/`**（v0.4 拆分）：
- `MapAreaSelector.vue` —— 区域列表
- `BattleStrategy.vue` —— 战斗策略选择
- `BattleLog.vue` (212) —— 战斗日志列表
- `BattleLogDetail.vue` (206) —— 单条战斗日志详情
- `DamageLayer.vue` —— 伤害飘字层
- `DropsPopup.vue` —— 战利品弹窗
- `battleLogUtils.js` —— 日志解析工具

**进化子组件 `evolution/`**（v0.4 拆分）：
- `RaceTab.vue` —— 种族进化（鹰人→翼人→天使）
- `LawTab.vue` —— 法则学习（6 法则）
- `AscendTab.vue` —— 登神
- `ReincTab.vue` —— 转生

**PvP 子组件 `pvp/`**（v0.4 拆分）：
- `PvPHeader.vue` / `PvPOpponents.vue` / `PvPRanking.vue` / `PvPRecords.vue` / `PvPRewards.vue` / `PvPShop.vue` / `PvPBattleReplay.vue` / `pvpUtils.js`

### 4.3 Tab 顺序

`App.vue` 的 `tabOrder`：`char → skill → bag → map → codex → evo → rank → quest → pvp → boss → genesis`

**底部 TabBar** 只显示 5 个：`char / skill / map / bag / codex`（其余从地图页侧边抽屉进入）

---

## 5. 数据流向 & 调用链速查

### 5.1 一个按钮点击的完整链路（例：附魔）

```
用户点"附魔" → InventoryView.vue 调 handleEnchant(itemUid, recipeId)
    → App.vue 的 handleEnchant 调 api.enchant(...)
        → 走 client/src/api.js 的封装 POST /api/player/:user/enchant
            → server/index.js 路由
                → server/routes/player.js
                    → server/engine/items.js.enchantItem
                        → 改 player.equips → store.setPlayer → markDirty → 5s 后 save
                            → 返回 { success: true, data: player }
                                → App.vue 更新 player.value → Vue 响应式刷新
```

### 5.2 5 秒定时任务

```js
// server/index.js
setInterval(() => {
  engine.maybeResetWeeklyBossKills(store);
  for (const player of store.getAllPlayers()) engine.calculateIdle(player);
  if (players.length > 0) store.save();
}, 5000);
```

→ `engine/idle.js.calculateIdle(p)` 是挂机结算核心（经验/金币/掉落/战斗模拟/升级/任务进度）

### 5.3 跨模块调用约定

- **创建/查找玩家** → `engine/player.js`
- **改装备/词条** → `engine/items.js`
- **改经验/金币/升级** → `engine/player.js#grantGold / grantExpWithLevelUp`
- **加任务进度** → `engine/daily.js#updateDailyProgress`
- **触发战斗** → `engine/combat.js#simulateBattle`
- **存 player** → `store.setPlayer(username, player)`

---

## 6. 关键设计原则（修改前必看）

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

---

## 7. AI 协作工作流

1. **接到任务** → 先读本文件 `docs/CODE_INDEX.md`（本文 ~200 行）
2. **定位文件** → 看本文件第 3/4 章节找具体路径
3. **理解业务** → 必要时读 `docs/README/01-gameplay.md` 或 `02-systems.md`
4. **看版本历史** → 改动前先查 `docs/README/06-changelog.md` 看是否已有类似修复
5. **改代码** → 严格遵守 `00-code-style.md`（单文件 ≤ 500 行，> 800 必须拆）
6. **改完验证** → `node server/skill.test.js` + `npm run build`
7. **记录变更** → 在 `docs/README/06-changelog.md` 追加新版本

---

## 8. 常见任务速查表

| 用户问 | 看哪里 |
|--------|-------|
| "加一个新的词条" | `server/data/affixes/{novice\|intermediate\|advanced\|master}.js` + `SkillView.vue` |
| "加一个新区域" | `server/data/areas.js` + `Monsters.js` + `client/components/MapView.vue` |
| "加一个新职业" | `server/data/jobs.js` + `CharacterView.vue` |
| "改附魔公式" | `server/engine/items.js#enchantItem` |
| "改转生加成曲线" | `server/engine/progression.js` + `server/data/progression.js` |
| "创世之书扩展" | `server/engine/genesis.js` + `server/data/genesis.js` + `GenesisView.vue` |
| "改 PvP 积分公式" | `server/engine/pvp.js` |
| "改战斗公式" | `server/engine/combat.js#calcDamage` |
| "挂机收益调参" | `server/engine/idle.js` |
| "新手指引改动" | `server/engine/daily.js#updateTutorialStep` + `TutorialOverlay.vue` |
| "排行榜加维度" | `server/routes/leaderboard.js` + `LeaderboardView.vue` |
| "前端全屏替换/弹窗切换" | 参照 `docs/README/05-architecture.md` UI/UX 规范 |
| "图标替换" | `client/public/icons/ai/*.png` + `components/icons/IconBase.vue` |

---

## 9. 严禁事项

- ❌ 改端口号（3000/3001 统一约定）
- ❌ 在 `engine/` 子模块间直接 `require` 形成循环（用 setHandler 注入）
- ❌ 单文件超 800 行不拆
- ❌ 跳过原子写直接改 `db.json`
- ❌ 改 `meta.genesis` 不调 `engine.setStore`（重启会丢自创内容）
- ❌ 前端直接读 `localStorage` 存游戏状态（用后端）
- ❌ 把数据库 ID 写死（自创装备用 `custom_` 前缀）
- ❌ 在 README/changelog 之外写中文说明文案到代码（注释除外）

---

> 最后更新：v0.7 (2026-08-25) — 创世之书上线路
> 维护人：项目主人 · 工具：Claude Code / TRAE
