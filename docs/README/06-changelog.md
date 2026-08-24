# 版本历史

> 📖 主入口：[../README.md](../README.md)

## v0.6 · 2026-08-24

### ✨ 新增功能

- **💎 深渊之石附魔配方「神话·灵蕴」**
  - 饰品附魔：精神+15 / MP+200 / 攻击+10
  - 消耗：深渊之石 ×1 + 光明晶 ×3 + 附魔卷轴 ×5（8000 金币）
  - 为终局材料「深渊之石」提供了新的稳定消耗出口

### 🔧 其他

- 优化了部分 bug

---

## v0.5 · 2026-08-22

### 🎨 AI 生图全面接入

- **28 个暗黑 RPG 图标重新生成**：全部透明背景，风格统一（魔兽暗黑风）
- **3 张主背景图**（minimax-m3 生成 + Pillow 裁剪去水印）：
  - `bg-main.png`：紫夜城堡主背景（1080×1920），body 全局铺底
  - `header-bg.png`：魔法卷轴纹理（768×80），TopBar 横向平铺
  - `tabbar-bg.png`：雕花石座 + 紫色符文（768×80），TabBar 横向平铺

### 🍞 全局 UI 桥接系统

- 新增 `client/src/ui-bridge.js`：全局响应式 Toast 栈 + Modal 队列
- 新增 `client/src/components/UIBridge.vue`：统一渲染层，App.vue 全局挂载
- API：`toast.success/error/warn/info`、`modalAlert(msg)`、`modalConfirm(msg)`（返回 Promise）
- 替换全部浏览器原生弹窗：9 处 `confirm()` + 50+ 处 `alert()`（背包/进化/角色/世界BOSS/登录/任务等）

### 🧙 游戏感 UI 增强

- **基础控件游戏化**：按钮 / 输入框 / 下拉框 / 滚动条全局重写（style.css）
- **TopBar 重构**：金边头像 + 名牌（名字·种族）+ 属性 chip（Lv/职业/神位）+ 金币胶囊
- **TabBar 重构**：34px 圆形图标底座 + 金色激活态 + 中心地图大按钮 + 徽章脉冲动画
- **品质边框系统**：`.q-normal / .q-fine / .q-epic / .q-legend` 四档品质色边框与发光
- **奖励徽章动画**：`.reward-badge` 弹跳入场

### 🐛 Bug 修复

- **TabBar 图标溢出**：`--tabbar-h` 58px → 64px，图标 38px → 34px，中心地图按钮取消凸出
- **金色渐变线清理**：移除 `.card::before`、`.tabbar-item::before`、`.tabbar-item.active::before`、`*:focus-visible` 等多余金线
- **EquipDetailModal 重复样式**：清理重复定义的 `.btn-danger`

### ✅ 验证

- `npm run build` 94 modules 转换成功
- 登录 / 挂机 / 背包 / 转生 / 世界 BOSS 全流程回归正常

---

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

### 🐛 Bug 修复 + 功能优化（2026-08-22）

- **法则 Tab 崩溃修复**：`LawTab.vue` 的 `getMaterialCount` 函数引用了未定义的 `player.value`（script setup 中没有 `player` 变量）→ 改为 `const props = defineProps(...)` 并使用 `props.player.inventory`，消除 `ReferenceError: player is not defined` 及其连锁的 3 条 Vue 渲染错误（shapeFlag/subTree/emitsOptions 为 null）
- **转生按钮误触发兑换修复**：`ReincTab.vue` 兑换按钮的 `:click="$emit('buyReincItem', item)"` 是 prop 绑定而非事件监听（应为 `@click`）→ 修正为 `@click`，修复"点转生触发兑换转生点"的错位行为
- **转生后地图不重置修复**：`doReincarnate` 函数重置等级/经验/属性但漏了 `currentArea`，转生后仍停留在高等级地图 → 新增 `player.currentArea = 'gaomanshan'`（保留 `maxClearedArea` 历史成就记录不重置，避免破坏二次转生门槛判定）
- **商店批量购买逻辑修复**：`ShopModal.vue` 的 `setBuyQty` 用 `=` 覆盖数量导致点 `×10` 始终是 10 → 改为 `+=` 累加，按钮文案 `×10` → `+10`
- **商店商品扩充**：`SHOP_ITEMS` 从 6 个扩到 17 个（消耗品 8 + 装备 9），新增大生命/法力药剂、高级经验卷轴等；装备复用 `EQUIP_TEMPLATES` 已有模板（铁制长矛/铁甲/水晶戒指/雷霆长枪/海灵胸甲/光之翼甲），同步适配 `useConsumable` 支持高级药水
- **背包批量出售装备**：新增"按等级批量出售"功能
  - 后端：`sellEquipsByLevel(player, maxLevel)` + 路由 `POST /api/player/:username/sell-equip-by-level`
  - 前端：`InventoryView.vue` 装备区加"批量出售"按钮 + 弹窗（≤Lv.30/50/100/150/全部 五档快捷选择 + 实时预览件数/金币/品质分布）
  - 安全保障：只卖 `player.equips`（背包中的），不影响 `player.equipped`（穿戴中的）；写入操作日志

### 🔧 端口方案统一（2026-08-22）

- **端口约定（所有模式统一）**：前端固定 **3000**（浏览器打开的地址），后端 API 固定 **3001**
- `server/index.js`：默认端口 3000 → **3001**（纯 API 服务，不再托管前端）
- `vite.config.js`：新增 `strictPort: true` 锁死 3000（被占用时报错而非自动跳端口）；`/api` 代理默认指向 3001
- 新增 `server/web-server.js`：生产模式前端服务器，监听 3000 托管 `client/dist` 并把 `/api` 反代到 3001（零第三方依赖）
- 新增 `server/start-all.js` + `package.json` 的 `npm start`：一键同时拉起前后端，任一退出则整体停止
- Docker：`ENV PORT=3001`、新增 `EXPOSE 3001`、`CMD node server/start-all.js`；宿主机访问端口仍由 compose 的 `${PORT:-3000}` 映射到容器内前端 3000

---

## v0.3 · 2026-08-20

5 大职业 + 词条 + 附魔 + 种族进化 + 法则 + 登神 + 战斗策略 + 伤害飘字 + PVP + 任务/成就 + 新手引导 + 全服排行榜

---

## v0.1-v0.2 · 早期

基础挂机 + 账号系统 + 商店 + 图鉴 + Docker