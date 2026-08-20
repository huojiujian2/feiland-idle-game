# T-004 战斗策略模式选择 — Spec

> 优先级 🔴 高 · 难度 ★★ · 分支 `feat/T-004-strategy` · 依赖 无 · 对应 `GAMEPLAY_TASKS.md:2.2`

## 1. 背景与目标

核心问题：挂机过于被动、玩家无决策点（诊断 §1）。本功能把「挂着不动」改为「挂着但有选择」，在挂机前提供策略 trade-off，影响后续所有 `calculateIdle` 收益，成本低、感知强。

成功标准：
- 玩家可在 3 个初始策略间切换，Lv.20/40/60 解锁 3 个进阶策略
- 策略立即影响战斗数值与挂机收益，前端 5 分钟内不可重复切换（CD 可感知）
- 后端可追责：切换记录可审计，非法客户端参数不生效

## 2. 范围

**做**
- 6 策略定义、数值、解锁条件
- `player.strategy / strategyChangedAt` 持久化与迁移
- `engine.calculateIdle` / `simulateBattle` / 收益结算中落策略加成
- `POST /api/player/:username/strategy` 校验 + CD
- `MapView.vue` 策略切换按钮组（遵循全屏替换规范，CSS 变量）
- `client/src/api.js` 封装、`getPlayerView` 回传当前策略与剩余 CD

**不做**
- 策略与职业/词条的联动平衡二次调优（后续观察数据再调）
- 策略影响排行榜单独榜单（复用现有战力/等级榜）
- 策略的付费解锁

## 3. 策略定义（权威表）

| id | 名称 | 效果（乘法，除特别说明） | 解锁 | 备注 |
|----|------|--------------------------|------|------|
| `aggressive` | 全力进攻 | `atk ×1.15`, `def ×0.90` | 初始 | 进攻向 |
| `defensive` | 稳健防守 | `def ×1.15`, `atk ×0.90`, `regen ×1.50` | 初始 | 回复指 `getTotalStats.regen` 与战斗内 `regen` |
| `balanced` | 平衡 | 无加成 | 初始·默认 | 新号/未设置时回退到此 |
| `greedy` | 贪婪掠夺 | `gold ×1.30`, `exp ×0.80`, `dropRate ×1.05` | Lv.20 | 掉落加成作用于 `area.drops[].rate` 判定 |
| `desperate` | 背水一战 | `atk ×1.40`, `def ×0.70`，且 `hp/maxHp <0.30` 时 `atk` 额外 `×1.20`（最终 `×1.68`） | Lv.40 | 低血阈值在 `getCombatStats` 内按实时 `hp` 判定 |
| `training` | 极限修炼 | `exp ×1.50`, `gold ×0.50`, 怪物 `atk ×1.20` | Lv.60 | 怪物加成仅当次战斗生效，不写盘 |

数值由 `server/data.js:STRATEGIES` 单一数据源导出，前后端共享展示文案。

## 4. 数据模型

`server/engine.js:createCharacter` 新增：
```js
strategy: 'balanced',
strategyChangedAt: 0 // timestamp ms，上次切换时间
```

`migratePlayer` 补充：缺失字段补 `balanced/0`；非法值回退 `balanced`。

`store` 无 schema 变更，JSON 透传。

## 5. 后端设计

### 5.1 常量

`server/data.js`
```js
const STRATEGIES = {
  aggressive: { name:'全力进攻', desc:'ATK+15% DEF-10%', reqLevel:1, effects:{ atk:0.15, def:-0.10 } },
  defensive:  { name:'稳健防守', desc:'DEF+15% ATK-10% 回复+50%', reqLevel:1, effects:{ def:0.15, atk:-0.10, regen:0.50 } },
  balanced:   { name:'平衡', desc:'无加成', reqLevel:1, effects:{} },
  greedy:     { name:'贪婪掠夺', desc:'GOLD+30% EXP-20% 掉落+5%', reqLevel:20, effects:{ gold:0.30, exp:-0.20, drop:0.05 } },
  desperate:  { name:'背水一战', desc:'ATK+40% DEF-30% 低血再+20%', reqLevel:40, effects:{ atk:0.40, def:-0.30, desperateAtk:0.20, hpThreshold:0.30 } },
  training:   { name:'极限修炼', desc:'EXP+50% GOLD-50% 怪物ATK+20%', reqLevel:60, effects:{ exp:0.50, gold:-0.50, monsterAtk:0.20 } },
}
const STRATEGY_CD_MS = 5 * 60 * 1000
```

### 5.2 战斗/收益落点

- `getCombatStats(player)` / `getTotalStats`：读 `player.strategy` 应用 `atk/def/regen`；`desperate` 低血二次加成在此生效；`training` 的 `monsterAtk` 传给 `simulateBattle(monster)` 前对 `monster.atk` 临时乘。
- `calculateIdle`：`expMult/goldMult` 叠加 `greedy/training` 的 `exp/gold`；`drop` 加成在 `for (const drop of area.drops) if (Math.random() < drop.rate * (1+dropBonus))`。
- 顺序：策略加成在职业/词条/装备之后、法则之前/之后均可，但必须与现有 `expBonus/goldBonus` 乘法叠加，避免覆盖。

### 5.3 API

`POST /api/player/:username/strategy` `body: { strategy: string }`

校验：
1. `STRATEGIES[strategy]` 存在否则 400 `策略不存在`
2. `player.level >= reqLevel` 否则 400 `需要 Lv.X`
3. `Date.now() - player.strategyChangedAt < STRATEGY_CD_MS` 且非首次设置，否则 400 `策略切换冷却中，剩余Xs`
4. 通过则 `player.strategy = strategy; player.strategyChangedAt = Date.now()` 并 `store.setPlayer`，返回 `getPlayerView`

`GET /api/player/:username` 与 `getPlayerView` 新增 `strategy/strategyCdRemaining/strategies`（全量含解锁态）供前端渲染。

### 5.4 兼容

- 旧存档无字段 → 迁移后为 `balanced`
- 等级回退不踢出已选策略，但前端置灰提示，下次切换时强制校验

## 6. 前端设计

`MapView.vue`
- 在「挂机区域」与「战斗属性」之间新增「战斗策略」卡片：6 按钮网格（4列→手机2列复用现有网格），选中态 `active` + 锁态 `locked` + CD 遮罩
- 展示：名称/效果/解锁等级；未解锁显示 `🔒Lv.X`；CD 中显示 `剩余 4m12s` 且按钮 disabled
- 交互：点击 → `api.setStrategy(username, id)` → 成功刷新 `player`，失败 toast 提示；遵循 `style.css` 变量，不硬编码色值

`client/src/api.js`
```js
setStrategy(username, strategy) { return request(`/player/${username}/strategy`, { method:'POST', body: JSON.stringify({ strategy }) }) }
```

`App.vue` 无新增 Tab，保持 `MapView` 全屏替换交互。

## 7. 非功能与约束

- 性能：策略分支为常数判断，不引入循环；`calculateIdle` 单次 <1ms
- 安全：后端权威校验，前端仅展示；CD 存后端时间戳，客户端改时间无效
- 日志：切换成功写 `player.logs.push({type:'strategy', text:'切换为XX策略'})`，便于回溯

## 8. 验收标准（可自动化）

- [ ] 初始号 `strategy==='balanced'`，可在 3 初始策略间切换
- [ ] `aggressive` 下 `combatStats.atk` 为原值 `×1.15` 且 `def ×0.90`（对同一存档快照对比）
- [ ] `defensive` 下 `regen` 为原值 `×1.50`
- [ ] `greedy` Lv.19 拒绝、Lv.20 通过；`gold ×1.30 exp ×0.80` 生效
- [ ] `desperate` HP 29% 时 `atk` 为 `×1.68`，HP 31% 时 `×1.40`
- [ ] `training` 下当次战斗怪物 `atk ×1.20`，且 `exp ×1.50 gold ×0.50`，掉落不变
- [ ] 切换后 5 分钟内二次切换返回 `冷却中` 且 `remaining` 误差 <2s
- [ ] 5 分钟后可切换，旧存档迁移后首次切换无 CD
- [ ] `pnpm build` 通过，`git diff --check` 0，无硬编码色值

## 9. 风险与回滚

- 数值过强/过弱：仅改 `STRATEGIES` 常量即可热修
- 回滚：分支删除即回退；存档中 `strategy` 字段保留不影响旧逻辑（回退后回退到 `balanced` 语义）

## 10. 实施步骤

1. `server/data.js` 增 `STRATEGIES/STRATEGY_CD_MS`
2. `server/engine.js` 增迁移、战斗/收益落点
3. `server/index.js` 增接口与 `getPlayerView` 透出
4. `client/src/api.js` + `MapView.vue` + `style.css` 变量复用
5. 自测 + `pnpm build` + 提交 PR（不合入）
