# AI 极速备忘（Feiland v1.03 · 2026-08-31）

> **TL;DR**：所有任务前必读 `docs/CODE_INDEX.md`（约 700 行，整合优化版）。
> 本文件只是**一屏速记** —— 不能替代主索引。

## ⚡ 项目一句话
Vue 3 + Express 西幻放置挂机游戏。端口 **3000/3001**。JSON 存档。17 个子系统（含灵鸡斗场 / 远征 / 公会 / 每日活跃）。

## ⚡ 5 步法
1. 读 `docs/CODE_INDEX.md`（v4.0 整合版）
2. 定位文件 + 行号（用第 3/4 章 + 第 7 章红线表）
3. 必要时读 `docs/README/0X-*.md` 业务文档
4. 改 → 守 `00-code-style.md`（>800 必须拆）
5. `npm test` + `npm run build` + 更新 `06-changelog.md`

## ⚡ 红线文件（优先拆）—— 2026-08-31 实测
- `client/src/components/GenesisView.vue` **1128** ⚠️
- `client/src/components/LoginScreen.vue` **1082** ⚠️
- `client/src/style.css` **814** ⚠️
- `server/engine/player.js` **734** ⚠️
- `client/src/components/InventoryView.vue` **686** ⚠️
- `server/routes/pvp.js` **581** ⚠️
- `client/src/App.vue` **564** ⚠️
- `client/src/components/CodexView.vue` **515** ⚠️
- `client/src/components/character/AttrAllocator.vue` **325** ⚠️

## ⚡ 严禁
- ❌ 改端口 3000/3001
- ❌ engine 子模块直接 require 循环
- ❌ > 800 行不拆
- ❌ 跳原子写直接改 db.json
- ❌ 改 meta.genesis/guilds/cockfight 不调 engine.setStore（重启会丢数据）
- ❌ localStorage 存游戏状态
- ❌ 跳过 settlement.assertSettlementReward 校验
- ❌ 把独立玩法（斗鸡/公会/远征）写入主 player

## ⚡ 一句话业务路由
- 词条/装备/锻造 → `engine/items.js`
- 职业/登神/转生 → `engine/progression.js`
- 战斗公式 → `engine/combat.js#calcDamage`
- 挂机 → `engine/idle.js#calculateIdle`
- PvP → `engine/pvp.js`
- 世界 BOSS → `engine/worldboss.js`（v3.0：最强一半玩家中位数推算）
- 创世之书 → `engine/genesis.js` + `data/genesis.js`
- **灵鸡斗场** 🆕 → `engine/cockfight.js`（独立 cockMeta）
- **远征** 🆕 → `engine/expedition.js`（派遣→事件→领奖）
- **公会** 🆕 → `engine/guild.js`（写入 meta.guilds）
- **每日活跃** 🆕 → `engine/active.js`（7 档积分制）
- **结算校验** 🆕 → `engine/settlement.js#assertSettlementReward`
- **主动技能** 🆕 → `engine/active.js`（CD 触发纯函数）

## ⚡ 一句话前端
- `App.vue` 持有 player + 11 Tab 路由 + 5s 轮询
- 13 个 View 主页 + 5 个子组件目录（LoginScreen/character/evolution/map/pvp/icons）
- 抽屉页：expedition / guild / cockfight（从地图侧边进入）
- API 50+ 方法在 `client/src/api.js`，与路由一一对应

## ⚡ 数据流向
按钮 → App.vue handle* → api.js → routes/* → engine/* → store.setPlayer → 5s save → 前端响应式刷新

## ⚡ v4.0 索引相比 v3.0 新增
- 补全 6 大新模块：灵鸡斗场 / 远征 / 公会 / 每日活跃 / 主动技能 / 结算校验
- 标注 5 个子组件目录的拆分映射
- 新增第 5 章 API ↔ 路由 ↔ 引擎三向速查（37 项高频操作）
- 补全 17 个测试文件清单
- 增加远征/公会/斗鸡的独立数据流图
- 增加 6 项严禁事项（settlement 校验、独立玩法隔离等）

→ 详见 `docs/CODE_INDEX.md` 主索引。