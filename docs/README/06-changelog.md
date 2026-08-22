# 版本历史

> 📖 主入口：[../README.md](../README.md)

## v0.4 · 2026-08-21

### ✨ 新增功能

- **🔄 转生轮回系统**
  - 解锁条件：Lv.100 + 通关龙岛
  - 永久加成：经验 +2%/次（封顶30%）、金币 +2%/次（封顶30%）、基础属性 +5/次
  - 转生点数 = 总属性 / 100
  - 入口：角色 → 转生/进化 → 转生 tab

- **🔨 装备锻造系统**
  - 升级：装备 +1 ~ +10，每级 +5% 基础属性
  - 合成：3 件同品质 → 1 件高一阶品质
  - 重铸：1000 金币重洗词条
  - 入口：背包 → 装备详情

- **👹 世界 BOSS 系统**
  - 3 个 BOSS 模板（虚空领主 / 深渊巨蛇 / 泰坦之魂），30 分钟自动刷新
  - 全服共享血量，按伤害占比发奖励
  - 伤害排行榜 + 最后一击额外奖励
  - 入口：地图 → 侧边抽屉 → 世界 BOSS

- **🗺️ 7 个新区域**
  - 元素深渊（Lv.130）/ 星界战场（Lv.150）/ 神魔殿（Lv.180）
  - 永恒虚空（Lv.200）/ 时之境（Lv.220）/ 创世核心（Lv.250）
  - 终极 BOSS「万界之眼」HP 30,000,000

- **⚔️ 22 件新装备**
  - 中段过渡 5 件（Lv.50-90）
  - 高阶 4 件（Lv.110-140）
  - 终极 3 件（Lv.200-250，无尽之刃 / 时之甲 / 全知之眼）

- **🧪 9 个新怪物技能**
  - 虚空新星 / 时间停止 / 星辰箭 / 神怒一击 / 元素风暴 / 神圣审判 / 灵魂分裂 / 界域崩裂

### 🐛 Bug 修复

- **PVP 平衡修复**：`engine.js:simulatePvP` 引用未定义变量 `round` → 改成 `rounds.length`
- **挂机收益修复**：`engine.js:calculateIdle` 引用未定义变量 `reincBonus` → 补充声明
- **TabBar 金色横线**：`.tabbar::before` 渐变线悬空 → 改用居中 60% 宽度的 ::before 伪元素
- **图鉴页文字图标**：CodexView 直接渲染 emoji → 改用 IconBase 组件
- **竞技场手动结算**：删除手动按钮 + doSettle 函数 + 简化结算 tab

### 🎨 视觉升级

- **AI 图标全量替换**：emoji → 28 个魔兽暗黑风 PNG 图标
- **图标背景透明化**：CSS `mix-blend-mode: screen` 让 PNG 白底与深色 UI 融合
- **图鉴图标**：4 个分类 tab 全部接入 IconBase 组件

### 📚 文档

- README.md 重写为 v0.4
- 拆分到 `docs/README/` 子目录（6 个文件）
- 删除 GAMEPLAY_TASKS.md（被 README 取代）
- 新增 [00-code-style.md](00-code-style.md) **代码模块化规范**（行数规则 / 文件清单模板 / 拆分原则）

### 🧱 模块化重构（v0.4 同日）

按代码规范（行数 300-500 为理想 / > 800 必须拆）实施拆分：

- **后端 `server/`**：
  - `data.js` 987 → 4 行 + `data/` 9 个子模块 + `affixes/` 按等级 4 子文件
  - `engine.js` 2780 → 4 行 + `engine/` 13 个子模块（state/utils/daily/player/stats/combat/pvp/items/progression/worldboss/idle/view/index）
  - `index.js` 1160 → 103 行 + `routes/` 11 个路由模块 + `_helpers.js`
  - 所有文件 ≤ 500 行，循环依赖通过 setHandler 注入模式解耦
- **前端 `client/src/components/`**：
  - `MapView.vue` 799 → 87 行（拆为 `map/` 7 个子组件 + `battleLogUtils.js`）
  - `PvPView.vue` 799 → 171 行（拆为 `pvp/` 7 个子组件 + `pvpUtils.js`）
  - `EvolutionView.vue` 488 → 134 行（拆为 `evolution/` 4 个 Tab 子组件）
  - `App.vue` 656 → 327 行（拆出 LoginScreen/TopBar/TabBar/OfflineRewardModal/LevelUpNotice/ShopModal）
  - `CharacterView.vue` 642 → 560 行（抽出 `EquipDetailModal.vue`）
- **验证**：`skill.test.js` 19/19 通过；`npm run build` 91 modules 成功；13 个 GET 路由验证 200
- **兼容性**：所有原 `require('./engine')` / `require('./data')` 通过 4 行重定向壳正常工作，调用方零修改

### 🐛 Bug 修复（v0.4 同日补丁）

- **dev 启动端口冲突修复**：`vite.config.js` 的 `/api` proxy 之前硬编码 `http://localhost:3000`，与 dev:server 同时占用 3000 端口时会启动失败 → 改为读取 `process.env.PORT || 3000`，并通过 `PORT=3001` 启动两个独立进程
- **启动方式**：手动启动后端 `set PORT=3001 && node server/index.js`，前端 `set PORT=3001 && npx vite --port 3000 --host`

---

## v0.3 · 2026-08-20

5 大职业 + 词条 + 附魔 + 种族进化 + 法则 + 登神 + 战斗策略 + 伤害飘字 + PVP + 任务/成就 + 新手引导 + 全服排行榜

---

## v0.1-v0.2 · 早期

基础挂机 + 账号系统 + 商店 + 图鉴 + Docker