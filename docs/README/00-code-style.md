# 📐 代码模块化规范

> 📖 主入口：[../../README.md](../../README.md)
>
> 本文档为 AI 辅助开发与人类开发者共同遵守的项目代码规范。所有 PR / 重构 / 拆分工作都应遵循本文。

---

## 一、文件行数规则

| 文件行数 | 处理方式 |
|---------|---------|
| **< 300 行** | 🟢 保持单文件，无需拆分 |
| **300 ~ 500 行** | ✅ 理想状态，建议保持 |
| **500 ~ 800 行** | ⚠️ 考虑拆分，视逻辑内聚性决定 |
| **> 800 行** | 🔴 必须拆分，按功能拆成多个模块 |
| **> 1500 行（特殊情况）** | 允许保留，但必须在文件顶部添加"文件清单"注释 |

---

## 二、大文件专用模板（> 1500 行时强制添加）

如果某个模块逻辑高度内聚（如复杂的 NPC 行为树、物理引擎、渲染管线），不得不超过 1500 行，请在文件最顶部添加以下注释模板：

```javascript
/**
 * @file [文件名]
 * @module [模块名]
 * @description [一句话说明这个文件的核心职责]
 *
 * 本文件结构：
 * 1. [功能区块名称] (L[起始行]-L[结束行])
 * 2. [功能区块名称] (L[起始行]-L[结束行]) <- 核心逻辑
 * 3. [功能区块名称] (L[起始行]-L[结束行])
 * 4. [功能区块名称] (L[起始行]-L[结束行])
 * 5. [工具/辅助函数] (L[起始行]-L[结束行])
 * 6. 导出接口 (L[起始行]-L[结束行])
 *
 * @example
 * // 使用示例（如有必要）
 * import { xxx } from './xxx.js';
 */
```

**实际示例（NPC 行为树）**：

```javascript
/**
 * @file NPC行为树引擎
 * @module npc-ai
 * @description 管理游戏中所有 NPC 的 AI 决策逻辑，基于行为树实现
 *
 * 本文件结构：
 * 1. 基础节点类 (L25-L80)
 * 2. 条件节点 (L85-L200)
 * 3. 动作节点 (L205-L450)
 * 4. 组合节点 (L460-L800) <- 核心复杂逻辑
 * 5. 调试工具 (L810-L900)
 * 6. 导出接口 (L950-L980)
 *
 * @example
 * const tree = new BehaviorTree();
 * tree.addNode(new SequenceNode());
 */
```

---

## 三、模块化拆分原则

| 原则 | 说明 |
|------|------|
| **单一职责** | 一个文件只做一件事。 |
| **接口精简** | 每个文件对外暴露的 API（export）不超过 **5 个**。 |
| **避免循环依赖** | A 导入 B，B 就不要导入 A。遇到这种情况，把共用部分抽到 `utils.js` 或 `common.js`。 |
| **目录就近** | 同类功能放同一子目录（如 `components/pvp/`、`server/engine/`）。 |
| **重定向保留** | 拆分时保留原文件 4 ~ 10 行的重定向壳，**保证所有现有调用方零修改**。 |

---

## 四、目录结构示例

```text
src/
├── engine.js          (主入口，< 300行)
├── renderer/          (渲染相关)
│   ├── canvas.js      (画布管理)
│   ├── draw.js        (绘制函数)
│   └── animation.js   (动画循环)
├── physics/           (物理引擎)
│   ├── collision.js   (碰撞检测)
│   └── movement.js    (运动计算)
├── ai/                (AI模块)
│   ├── behavior-tree.js  (可能 > 1500行，带清单注释)
│   └── pathfinding.js    (寻路算法)
└── utils/             (工具函数)
    ├── math.js        (数学工具)
    └── helpers.js     (通用辅助)
```

---

## 五、本项目的实际拆分规范

### 5.1 后端 `server/`

| 原文件 | 行数 | 拆分后 | 拆分方式 |
|--------|------|--------|----------|
| `data.js` | 987 | `data/{areas,equipment,jobs,progression,monsters,quests,pvp,strategy,affixes/{novice,intermediate,advanced,master}}.js` + `data/index.js` | 按数据类别拆分，词条按等级再拆 |
| `engine.js` | 2780 | `engine/{state,utils,daily,player,stats,combat,pvp,items,progression,worldboss,idle,view,index}.js` | 按职责拆分 |
| `index.js` | 1160 | `routes/{auth,player,combat,progression,codex,leaderboard,pvp,worldboss,strategy,quest,index}.js` + `_helpers.js` | 按业务域拆分 |

### 5.2 前端 `client/src/components/`

| 原文件 | 行数 | 拆分后 |
|--------|------|--------|
| `MapView.vue` | 799 | `map/{MapAreaSelector, BattleStrategy, BattleStatsPanel, BattleLog, BattleLogDetail, DamageLayer, DropsPopup}.vue` + `map/battleLogUtils.js` |
| `PvPView.vue` | 799 | `pvp/{PvPHeader, PvPOpponents, PvPRanking, PvPRecords, PvPShop, PvPRewards, PvPBattleReplay}.vue` + `pvp/pvpUtils.js` |
| `EvolutionView.vue` | 488 | `evolution/{RaceTab, LawTab, AscendTab, ReincTab}.vue` |
| `App.vue` | 656 | `LoginScreen.vue` + `TopBar.vue` + `TabBar.vue` + `OfflineRewardModal.vue` + `LevelUpNotice.vue` + `ShopModal.vue` |
| `CharacterView.vue` | 642 | `EquipDetailModal.vue`（装备详情弹窗独立） |

### 5.3 文件头注释模板

每个新拆分的文件顶部必须包含：

```javascript
// ====== {一句话功能描述} ======
// @file {相对项目根的路径}
// @module {模块短名}
// @description {核心职责一句话}
//
// 本文件结构（已模块化拆分后主文件 ~XXX 行）：
// 1. {职责1}
// 2. {职责2}
// ...
```

### 5.4 循环依赖解决

引擎层采用 **setHandler 注入模式**：

```javascript
// engine/player.js —— 提供设置入口
function setRecalcMaxStatsHandler(fn) { if (typeof fn === 'function') _recalcMaxStats = fn; }

// engine/index.js —— 统一绑定循环引用
const realRecalcMaxStats = (p) => { ... };
player.setRecalcMaxStatsHandler(realRecalcMaxStats);
items.setRecalcMaxStatsHandler(realRecalcMaxStats);
progression.setRecalcMaxStatsHandler(realRecalcMaxStats);
```

---

## 六、拆分流程（推荐步骤）

1. **先扫描行数**：用 `wc -l` 或编辑器统计每个文件行数。
2. **优先拆 > 800 行的文件**（必须拆）。
3. **按职责拆分**：同一文件内的独立功能（弹窗 / 工具 / Tab）分别抽离。
4. **保持兼容**：原文件保留为 4 ~ 10 行的 `module.exports = require('./xxx/index')`。
5. **测试通过**：跑 `node server/skill.test.js` 和 `npm run build`。
6. **更新文档**：在 `docs/README/06-changelog.md` 记录模块化变更。

---

## 七、自动化检查（建议）

可以在 `package.json` 添加检查脚本：

```json
{
  "scripts": {
    "check:lines": "node -e \"const m=require('glob'),fs=require('fs');m('server/**/*.js').forEach(f=>{const n=fs.readFileSync(f,'utf8').split('\\n').length;if(n>800)console.log('⚠️ ',f,n,'lines');});\""
  }
}
```

---

## 八、版本演进记录

| 版本 | 模块化进度 |
|------|----------|
| v0.1 ~ v0.3 | 单文件模式（`engine.js` 2780 行 / `index.js` 1160 行 / `data.js` 987 行） |
| **v0.4** | 全部按规范拆分：后端 `engine/` 13 模块 + `routes/` 11 模块 + `data/` 9 模块；前端组件 20+ 独立子组件 |

> 当前最大单文件 ≤ 600 行（`CharacterView.vue`），其他均 ≤ 500 行，达成"理想状态"目标。

---

## 九、遵守本规范带来的好处

1. **AI 辅助友好**：每个文件 ≤ 500 行，AI 可一次性完整读取、修改而不丢失上下文。
2. **测试隔离**：工具函数（`battleLogUtils.js` / `pvpUtils.js`）可独立单测。
3. **新人友好**：新成员可快速定位职责单一的子模块，降低理解成本。
4. **重构安全**：单文件 ≤ 500 行让 PR diff 更小、冲突更少。
5. **性能稳定**：模块加载按需 `require`，启动速度不受拆分影响。

---

> **本项目核心口号**：
> *单文件 300-500 行为理想状态。超过 800 行必须按功能拆分。如果某个模块因逻辑内聚超过 1500 行，必须在文件顶部添加带有行号标注的"文件清单"注释，方便 AI 快速定位。*

---

## 十、相关文档

- 📖 [主入口 README.md](../../README.md)
- 🏗️ [05-architecture.md](05-architecture.md) · 项目结构 + 技术栈
- 📊 [06-changelog.md](06-changelog.md) · v0.4 模块化变更记录
