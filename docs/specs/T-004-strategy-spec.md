# T-004 战斗策略模式选择 — Spec v3

> 优先级 🔴 高 · 难度 ★★ · 分支 `feat/T-004-strategy` · 依赖 无（认证见 §5.6）· 对应 `GAMEPLAY_TASKS.md:2.2`
> 本版修复 v2 的 3 P1 + 3 P2（校验/结算顺序、monsterAtk 归属、收益回归、seam 完整性、幂等/等级、取整/性能）

## 1. 背景与目标

挂机被动无决策点。本功能提供 6 策略 trade-off，影响后续 `calculateIdle`。

成功标准：
- Lv.1 可选 3 初始，Lv.20/40/60 解锁 3 进阶
- 切换 5 分钟 CD，前端可感知
- 非法参数不生效；切换可审计（非安全边界）

## 2. 范围

做：`STRATEGIES` 单一数据源、`strategy/strategyChangedAt` 持久化与迁移、唯一落点与公式定版、`POST /strategy` 边界与校验、`MapView` 卡片、`pnpm test` seam
不做：二次平衡、独立榜单、付费、认证（T-061）

## 3. 策略定义

| id | 名称 | 效果（乘法） | 解锁 |
|----|------|--------------|------|
| `aggressive` | 全力进攻 | `atk ×1.15`, `def ×0.90` | Lv.1 |
| `defensive` | 稳健防守 | `def ×1.15`, `atk ×0.90`, `regen ×1.50` | Lv.1 |
| `balanced` | 平衡 | 无加成 | Lv.1·默认 |
| `greedy` | 贪婪掠夺 | `gold ×1.30`, `exp ×0.80`, `dropRate ×1.05` | Lv.20 |
| `desperate` | 背水一战 | `atk ×1.40`, `def ×0.70`，且 `hp/maxHp<0.30` 时 `atk` 额外 `×1.20` | Lv.40 |
| `training` | 极限修炼 | `exp ×1.50`, `gold ×0.50`, 怪物 `atk ×1.20` | Lv.60 |

`regen` 指 `getTotalStats.regen` 与战斗内 `regen`；`dropRate` 仅 `win` 时生效；`training` 怪物仅当次战斗副本。

## 4. 数据模型

```js
strategy: 'balanced',
strategyChangedAt: 0 // 上次成功切换 ms；0=从未切换
```
`migratePlayer`：`typeof !== string || !Object.hasOwn(STRATEGIES, strategy)` 回退 `balanced`；`!Number.isFinite(strategyChangedAt)` 回退 `0`。`store` 透传。

## 5. 后端设计

### 5.1 常量与导出

`server/data.js`
```js
const STRATEGIES = { aggressive:{...}, defensive:{...}, balanced:{...}, greedy:{...}, desperate:{...}, training:{...} }
const STRATEGY_CD_MS = 5*60*1000
module.exports = { AREAS, ..., STRATEGIES, STRATEGY_CD_MS, getStage, expToNext, createEquipItem }
```
必须加入显式导出列表（`data.js:674-680`）。

### 5.2 收益结算边界（修复 P1-1）

`calculateIdle` 单次按 `lastTick→now` 结算，切换不得追溯。

`POST /strategy` 采用两阶段校验，避免非法请求推进 `lastTick`：

**阶段 A — 无副作用校验（不写盘、不结算）**
- A1 `typeof strategy !== 'string' || !Object.hasOwn(STRATEGIES, strategy)` → `策略不存在`
- A2 若 `strategy === player.strategy` → 幂等直接返回 `success:true`（绕过等级与 CD，见 §5.4）
- A3 `Date.now() - strategyChangedAt < CD && strategyChangedAt !==0` → `冷却中`

**阶段 B — 旧策略结算（仅 A 通过后）**
- B1 `maybeResetWeeklyBossKills(store)`（如需）
- B2 `calculateIdle(player)` 按旧 `strategy` 结算（`elapsed<3000` 则无收益但仍更新 `lastTick` 逻辑与现有保持一致）
- 此次结算可能升级（Lv.19→20），需进入 C

**阶段 C — 等级复核与写入**
- C1 以结算后 `player.level` 复核 `reqLevel`：`player.level < STRATEGIES[target].reqLevel` → `需要 Lv.X`（因此 Lv.19 已结算到 20 后可通过）
- C2 通过则 `old=player.strategy; player.strategy=target; player.strategyChangedAt=_now()`，写日志（§5.5），`store.setPlayer`，返回 `getPlayerView`

非法/冷却/等级不满足的请求不执行 B/C，不产生收益、不改 `lastTick`。

### 5.3 数值唯一落点与公式（修复 P1-2/3）

**归属**
- 战斗向 `atk/def/regen/desperateAtk`：唯一落点 `getTotalStats` / `getCombatStats`（玩家属性）
- 怪物向 `monsterAtk`：唯一落点 `buildBattleMonster(monster, strategy)` → `simulateBattle(battleMonster)` 的战斗输入变换，不属于玩家属性，也不属于收益向；`calculateIdle` 仅负责选怪并传入副本
- 收益向 `exp/gold/drop`：唯一落点 `calculateIdle` 结算阶段

**battleMonster**
```js
function buildBattleMonster(monster, strategy){
  if(strategy==='training') return { ...monster, atk: Math.floor(monster.atk * 1.20) }
  return { ...monster }
}
// calculateIdle: const battleMonster = buildBattleMonster(monster, player.strategy); simulateBattle(player, battleMonster)
```

**完整收益公式（保留现有回归项）**
现有 `engine.js:729-753` 包含：`total.expBonus/lawBonus.exp/raceBonus.exp`、`godhood 1.5/2`、`talents.killExp`、`total.killExp/flatExp/killGold`、`doubleKill`。

v3 插入策略倍率后的定版顺序（策略不覆盖现有项，乘法叠加）：
```js
// 1) 基础倍率（保留现有）
let expMult = 1 + total.expBonus + lawBonus.exp + (raceBonus.exp||0)
let goldMult = 1 + total.goldBonus + lawBonus.gold
if(player.godhood==='demigod') expMult *= 1.5
if(player.godhood==='god') expMult *= 2
// 2) 策略收益倍率（新增，紧接基础倍率）
if(strategy==='greedy'){ expMult *= 0.80; goldMult *= 1.30 }
if(strategy==='training'){ expMult *= 1.50; goldMult *= 0.50 }
// 3) 基础掉落
let expGain = Math.floor(monster.exp * expMult)
let goldGain = Math.floor(monster.gold * goldMult)
let effectiveDropRate = drop.rate * (strategy==='greedy' ? 1.05 : 1)
// 4) 击杀额外（保留现有，策略已在 expMult/goldMult 生效，不重复）
if(talents.killExp){ expGain += (talents.killExp==='level*2'? player.level*2 : Math.floor(monster.exp*talents.killExp)) }
if(total.killExp) expGain += Math.floor(monster.exp * total.killExp)
if(total.killGold) goldGain += Math.floor(monster.gold * total.killGold)
if(total.flatExp) expGain += total.flatExp
// 5) 炼金双倍（最后）
if(total.doubleKill){ expGain *= 2; goldGain *= 2 }
// lose/timeout 同走 expMult：lose= floor(monster.exp*0.1*expMult)，timeout= floor(monster.exp*0.3*expMult)，gold 0；策略倍率同样生效
```

**取整与战力**
- `getTotalStats` 内 `atk = floor(baseAtk * (1+affix.atk) * (1+strategy.atk) * allAttrMult)`；`def/hp/agi` 同理；`regen = (affix.regen+mechanics.regen)*(1+strategy.regen)` 不 floor
- `desperate` 低血：`atkLow = floor(floor(baseAtk *...*1.40) *1.20)`，两次 floor 不合并为 `*1.68`，验收以分步结果为准
- `powerScore = floor(total.atk+total.def+total.hp+total.agi)` 含战斗向策略，不含收益向

日志记录 `monsterBaseAtk` 与 `battleMonster.atk` 双值供审计。

### 5.4 API 契约

`POST /api/player/:username/strategy` `200 {success,message,data}`

顺序见 §5.2：
1. A1 原型污染校验 → A2 幂等（同策略直接成功，绕过等级与 CD）→ A3 CD
2. 仅通过后进入 B 旧策略结算
3. C 以结算后等级复核 `reqLevel`，通过后写入

`getPlayerView` 新增：
```js
strategy, strategyChangedAt,
strategyCdRemaining: Math.max(0, STRATEGY_CD_MS - (_now() - strategyChangedAt)), // ms 向下取整
strategies: [{id,name,desc,reqLevel,unlocked,active},...] // 6 项按 STRATEGIES 顺序
```
同策略幂等时 `unlocked` 可为 false 仍返回成功；`active:true` 优先级高于 `unlocked:false`（前端高亮已选，置灰解锁提示并存）。

等级回退不踢出已选高阶策略。

### 5.5 日志契约

```js
player.logs.push({ time:_now(), type:'strategy', from:old, to:target, strategy:target, text:`策略切换：${STRATEGIES[old].name}→${STRATEGIES[target].name}` })
if(player.logs.length>30) player.logs = player.logs.slice(-30) // 追加后再次截断，避免 31 条瞬时
// getPlayerView 返回 20 条，可审计窗口 20，非长期审计
```
`time` 必填，`formatTime` 可渲染。

### 5.6 安全

信任 `username` 路径参数，无认证。T-004 不宣称安全边界，完整 JWT/bcrypt 由 T-061 负责，预留 `req.user`。

## 6. 前端设计

`MapView.vue` 新增「战斗策略」卡片（区域与属性之间）：
- 6 个原生 `<button>` 网格，`disabled` + `aria-pressed={active}` + `aria-disabled`，`locked` 与 `cd` 时 `disabled`
- 交互：`emit('strategy-change', id)` → `App.vue` 调 `api.setStrategy` → 用返回 `data` 回写 `player`（禁 `props.player.strategy=`），失败 `alert(message)`
- 样式仅 `var(--duration-*/--ease-*/--accent-*/--lb-*)`

`client/src/api.js`: `setStrategy(username,strategy)`

## 7. 非功能

- 策略新增开销：`getTotalStats` 内 2 次乘法与 1 次分支；验收以 benchmark 为准（见 §9）
- 时间/随机见 §8

## 8. 可测试性

`package.json`: `"test":"node --test server/**/*.test.js"`

`server/engine.js` seam：
```js
let _now=()=>Date.now(), _rand=Math.random, _dropRand=Math.random
function __setNow(fn){ _now=fn } function __setRandom(fn){ _rand=fn } function __setDropRandom(fn){ _dropRand=fn }
function __resetSeams(){ _now=()=>Date.now(); _rand=Math.random; _dropRand=Math.random }
```
`calculateIdle`、`buildBattleMonster`、`shouldDrop`、`POST /strategy` 的 `Date.now`/`Math.random`/`drop` 均走 seam；测试后 `__resetSeams()`。

## 9. 验收标准

- [ ] 旧策略结算边界：`elapsed>=3s` 时切换前产生旧策略 battle 日志
- [ ] 非法/`__proto__` 不结算不改 `lastTick`
- [ ] Lv.19 未结算→结算到 20 后可切 `greedy`
- [ ] 同策略幂等：转生后已选 `training` 仍可提交自身，不被等级拦截，`active` 高亮
- [ ] `training` 时 `AREAS` 原 `atk` 不变，`log.monsterBaseAtk=100` 则 `log.monster.atk=120`
- [ ] `desperate` 低血分步 floor 校验（非 `*1.68` 合并）
- [ ] 失败/超时经验同样受 `greedy/training` 影响；`doubleKill` 最后翻倍
- [ ] `strategyCdRemaining` ms 误差 <2s，`time/from/to` 可渲染
- [ ] 切换 31 条时截断回 30
- [ ] `<button disabled aria-pressed>` 且失败 `alert`
- [ ] `pnpm test && pnpm build && git diff --check 0`，benchmark：策略路径 p95 <5ms（`node --test` 计时或 1k 次 `calculateIdle` 均值）

## 10. 风险与回滚

常更热修；分支删除回退，存档字段按 `balanced` 忽略。

## 11. 实施步骤

1. `data.js` 增 `STRATEGIES/STRATEGY_CD_MS` 并导出
2. `engine.js` 增迁移、公式、`buildBattleMonster`、seam 与 `__resetSeams`
3. `index.js` 按 §5.2 两阶段实现 `POST /strategy` 与 `getPlayerView`
4. `api.js` + `MapView.vue` + `App.vue` + `style.css`
5. `test` 单测 + `pnpm test && pnpm build`
