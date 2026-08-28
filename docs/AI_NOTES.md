# �� AI 极速备忘（Feiland MVP · v1.02）

> **TL;DR**：所有任务前必读 `docs/CODE_INDEX.md`（约 372 行）。
> 本文件只是**一屏速记** —— 不能替代主索引。

## ⚡ 项目一句话
Vue 3 + Express 西幻放置挂机游戏。端口 **3000/3001**。JSON 存档。

## ⚡ 5 步法
1. 读 `docs/CODE_INDEX.md`
2. 定位文件 + 行号
3. 必要时读 `docs/README/0X-*.md` 业务文档
4. 改 → 守 `00-code-style.md`（>800 必须拆）
5. `npm test` + `npm run build` + 更新 `06-changelog.md`

## ⚡ 红线文件（优先拆）
- `LoginScreen.vue` 1541 ��
- `GenesisView.vue` 1190 ��
- `CharacterView.vue` 926 ��
- `style.css` 814 ��
- `InventoryView.vue` 732 ⚠️
- `App.vue` 545 ⚠️
- `engine/player.js` 546 ⚠️
- `engine/pvp.js` 502 ⚠️

## ⚡ 严禁
- ❌ 改端口 3000/3001
- ❌ engine 子模块直接 require 循环
- ❌ > 800 行不拆
- ❌ 跳原子写直接改 db.json
- ❌ 改 meta.genesis 不调 engine.setStore（重启会丢自创内容）
- ❌ localStorage 存游戏状态

## ⚡ 一句话业务路由
- 词条/装备/锻造 → `engine/items.js`
- 职业/登神/转生 → `engine/progression.js`
- 战斗公式 → `engine/combat.js#calcDamage`
- 挂机 → `engine/idle.js#calculateIdle`
- PvP → `engine/pvp.js`
- 世界 BOSS → `engine/worldboss.js`（hp×5,atk×3,def×1,agi×1 = 最强玩家×10）
- 创世之书 → `engine/genesis.js` + `data/genesis.js`

## ⚡ 一句话前端
- `App.vue` 持有 player