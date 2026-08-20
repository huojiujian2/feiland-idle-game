# T-004 战斗策略模式选择 — Spec v4

> 优先级 🔴 高 · 难度 ★★ · 分支 `feat/T-004-strategy` · 依赖 无（认证见 §5.6）· 对应 `GAMEPLAY_TASKS.md:2.2`
> 本版修复 v3 的 2 P1 + 3 P2（C 失败事务、<3s 窗口、路由 seam、doubleKill 范围、p95 口径、desperate 快照），其余副本/回归/校验等沿用 v3

## 1. 背景与目标

挂机被动无决策点。本功能提供 6 策略 trade-off，影响后续 `calculateIdle`。

成功标准：Lv.1 可选 3 初始，Lv.20/40/60 解锁 3 进阶；切换 5 分钟 CD；非法不生效；切换可审计（非安全边界）。

## 2. 范围

做：`STRATEGIES` 单一数据源、`strategy/strategyChangedAt` 持久化与迁移、唯一落点与公式定版、`POST /strategy` 边界与校验（含事务与窗口）、`MapView` 卡片、`pnpm test` seam
不做：二次平衡、独立榜单、付费、认证（T-061）

## 3. 策略定义

| id | 名称 | 效果（乘法） | 解锁 |
|----|------|--------------|------|
| `aggressive` | 全力进攻 | `atk ×1.15`, `def ×0.90` | Lv.1 |
| `defensive` | 稳健防守 | `def ×1.15`, `atk ×0.90`, `regen ×1.50` | Lv.1 |
| `balanced` | 平衡 | 无加成 | Lv.1·默认 |
| `greedy` | 贪婪掠夺 | `gold ×1.30`, `exp ×0.80`, `dropRate ×1.05` | Lv.20 |
| `desperate` | 背水一战 | `atk ×1.40`, `def ×0.70`，且战斗开始时 `hp/maxHp<0.30` 时 `atk` 额外 `×1.20`（分步 floor，见 §5.3） | Lv.40 |
| `training` | 极限修炼 | `exp ×1.50`, `gold ×0.50`, 怪物 `atk ×1.20` | Lv.60 |

`desperate` 为战斗开始时快照判定，非每回合重算（`simulateBattle` 仅在 476-477 调用一次 `getCombatStats`）；`training` 仅当次战斗副本。

## 4. 数据模型

```js
strategy: 'balanced',
strategyChangedAt: 0
```
`migratePlayer`：`typeof !== string || !Object.hasOwn(STRATEGIES, strategy)` 回退 `balanced`；`!Number.isFinite(strategyChangedAt)` 回退 `0`。

## 5. 后端设计

### 5.1 常量与导出

`server/data.js`
```js
const STRATEGIES = { aggressive:{...}, defensive:{...}, balanced:{...}, greedy:{...}, desperate:{...}, training:{...} }
const STRATEGY_CD_MS = 5*60*1000
module.exports = { AREAS, ..., STRATEGIES, STRATEGY_CD_MS, getStage, expToNext, createEquipItem }
```
必须加入显式导出列表（`data.js:674-680`）。

### 5.2 收益结算边界与事务（修复 P1-1/2）

`calculateIdle` 现状：`elapsed = _now() - lastTick; if(elapsed<3000) return null` **不更新** `lastTick`（`engine.js:706-708`）。直接复用会导致 <3s 的切换前时间在下一次 `calculateIdle` 中按新策略结算。

**两阶段事务（A 无副作用 → B 旧策略结算 → C 复核写入）**

- **A — 无副作用校验（不写盘、不结算、不改 lastTick）**
  - A1 `typeof strategy !== 'string' || !Object.hasOwn(STRATEGIES, strategy)` → `策略不存在`
  - A2 同策略幂等 `strategy === player.strategy` → 直接 `success:true`（绕过等级与 CD）
  - A3 ` _now() - strategyChangedAt < CD && strategyChangedAt!==0` → `冷却中`
  - 任意 A 失败直接返回，不执行 B/C，不产生收益，不改 `lastTick`

- **B — 旧策略结算（仅 A 通过后，按旧 strategy 结算）**
  - B1 `maybeResetWeeklyBossKills(store)`（如需）
  - B2 `const result = calculateIdle(player)` // 内部用旧 `strategy` 与 `_now()/_rand()`
  - B2 产生的 `exp/gold/drops/levelUps` 立即落盘：若 `result` 非空已在 `calculateIdle` 内更新 `player.exp/gold/inventory` 与 `lastTick=_now()`；若 `result===null`（`elapsed<3000`）则 **不**更新 `lastTick`，需由 C 统一关窗（见下）

- **C — 等级复核与写入（以 B 结算后等级为准）**
  - C1 以结算后 `player.level` 复核：`player.level < STRATEGIES[target].reqLevel` → 返回 `success:false, message:'需要 Lv.X'` **但保留 B 的结算结果**（不回滚）：`store.setPlayer(player)` 已提交的 `exp/gold/lastTick` 保留，仅 `strategy` 不变
  - C2 通过则 `old=player.strategy; player.strategy=target; player.strategyChangedAt=_now();` 追加日志（§5.5）并在追加后再次截断
  - C3 关窗：若 B 无收益（`result===null`）则显式 `player.lastTick = _now()`，避免 <3s 窗口被下一次战斗按新策略追溯
  - C4 `store.setPlayer` + 返回 `getPlayerView`

因此 Lv.19 未结算→B 结算到 20→C 通过；Lv.19 结算后仍 19→C 失败但 B 的 1 场旧策略收益已保留，下一次满 3s 再试即满足等级。

### 5.3 数值唯一落点与公式

**归属**
- 战斗向 `atk/def/regen/desperateAtk`：`getTotalStats` / `getCombatStats`（玩家快照）
- 怪物向 `monsterAtk`：`buildBattleMonster(monster, strategy)` → `simulateBattle(battleMonster)` 输入变换；`calculateIdle` 仅选怪传副本
- 收益向 `exp/gold/drop`：`calculateIdle` 结算阶段

```js
function buildBattleMonster(monster, strategy){
  if(strategy==='training') return { ...monster, atk: Math.floor(monster.atk * 1.20) }
  return { ...monster }
}
```

**完整收益公式（保留回归项，仅 win 翻倍）**
```js
let expMult = 1 + total.expBonus + lawBonus.exp + (raceBonus.exp||0)
let goldMult = 1 + total.goldBonus + lawBonus.gold
if(player.godhood==='demigod') expMult *= 1.5
if(player.godhood==='god') expMult *= 2
if(strategy==='greedy'){ expMult *= 0.80; goldMult *= 1.30 }
if(strategy==='training'){ expMult *= 1.50; goldMult *= 0.50 }

if(battle.result==='win'){
  let expGain = Math.floor(monster.exp * expMult)
  let goldGain = Math.floor(monster.gold * goldMult)
  let effectiveDropRate = drop.rate * (strategy==='greedy' ? 1.05 : 1)
  if(talents.killExp){ expGain += (talents.killExp==='level*2'? player.level*2 : Math.floor(monster.exp*talents.killExp)) }
  if(total.killExp) expGain += Math.floor(monster.exp * total.killExp)
  if(total.killGold) goldGain += Math.floor(monster.gold * total.killGold)
  if(total.flatExp) expGain += total.flatExp
  if(total.doubleKill){ expGain *= 2; goldGain *= 2 } // 仅 win 分支
} else if(battle.result==='lose'){
  let expGain = Math.floor(monster.exp * 0.1 * expMult) // 策略同影响保底
} else { // timeout
  let expGain = Math.floor(monster.exp * 0.3 * expMult)
}
```

**取整与战力**
- `atk = floor(baseAtk * (1+affix.atk) * (1+strategy.atk) * allAttrMult)`；`def/hp/agi` 同理；`regen` 不 floor
- `desperate` 分步：`atkStep1 = floor(baseAtk *...*1.40)`, `atkLow = floor(atkStep1 *1.20)`（不合并为 `*1.68`）
- `powerScore = floor(total.atk+total.def+total.hp+total.agi)` 含战斗向不含收益向

日志记录 `monsterBaseAtk` 与 `battleMonster.atk`。

### 5.4 API 契约

`POST /api/player/:username/strategy` `200 {success,message,data}`，顺序按 §5.2 A→B→C。

`getPlayerView` 新增：
```js
strategy, strategyChangedAt,
strategyCdRemaining: Math.max(0, STRATEGY_CD_MS - (getNow() - strategyChangedAt)),
strategies: [{id,name,desc,reqLevel,unlocked,active},...]
```
同策略幂等绕过等级/CD；`active` 优先 `unlocked`。

### 5.5 日志契约

```js
player.logs.push({ time:getNow(), type:'strategy', from:old, to:target, strategy:target, text:`策略切换：${STRATEGIES[old].name}→${STRATEGIES[target].name}` })
if(player.logs.length>30) player.logs = player.logs.slice(-30) // 追加后再次截断
```
`time` 必填，`getPlayerView` 返回 20 条。

### 5.6 安全

信任 `username`，无认证，T-004 不宣称安全边界，T-061 负责 JWT/bcrypt，预留 `req.user`。

## 6. 前端设计

`MapView.vue` 新增「战斗策略」卡片：6 个原生 `<button disabled aria-pressed>` 网格；`emit('strategy-change')` → `App.vue` 调 `api.setStrategy` 回写 `player`；失败 `alert(message)`；仅 `var(--*)`。

`client/src/api.js`: `setStrategy(username,strategy)`

## 7. 非功能

策略新增开销以 benchmark 为准（§9）。

## 8. 可测试性

`package.json`: `"test":"node --test server/**/*.test.js"`

`server/engine.js`：
```js
let _now=()=>Date.now(), _rand=Math.random, _dropRand=Math.random
function getNow(){ return _now() }
function __setNow(fn){ _now=fn } function __setRandom(fn){ _rand=fn } function __setDropRandom(fn){ _dropRand=fn }
function __resetSeams(){ _now=()=>Date.now(); _rand=Math.random; _dropRand=Math.random }
module.exports = { ..., getNow, __setNow, __setRandom, __setDropRandom, __resetSeams, buildBattleMonster }
```
`calculateIdle`/`simulateBattle` 内所有 `Date.now` → `getNow()`，所有 `Math.random`（含 `pickPlayerSkill/pickMonsterSkill/calcDamage/getActionCount`）走 `_rand`，掉落走 `_dropRand`/`shouldDrop`。

`server/index.js` 的 `POST /strategy` 必须 `const { getNow } = require('./engine')` 并用 `getNow()` 计算 CD 与 `strategyChangedAt`/`time`，否则路由层无法被 `__setNow` 控制。

## 9. 验收标准

- [ ] 非法/`__proto__` 不结算不改 `lastTick`
- [ ] `elapsed>=3s` 切换前产生旧策略 battle 日志，C 失败仍保留该收益仅策略不变
- [ ] `elapsed<3s` 切换成功后 `lastTick===getNow()`，下一次战斗不含旧时间
- [ ] Lv.19→B 到 20 后可切 `greedy`；同策略幂等 `active` 高亮不受等级拦截
- [ ] `training` 时 `AREAS` 原 `atk` 不变，`log.monsterBaseAtk=100` 则 `log.monster.atk=120`
- [ ] `desperate` 分步 floor 且为战斗开始快照（非每回合重算）
- [ ] `doubleKill` 仅 win 翻倍，lose/timeout 不翻倍但策略 `expMult` 仍生效
- [ ] `strategyCdRemaining` ms 误差 <2s，`time/from/to` 可渲染，>30 条截断回 30
- [ ] `<button disabled aria-pressed>` 且失败 `alert`
- [ ] `pnpm test && pnpm build && git diff --check 0`，benchmark：固定 Node 20、空载 1k 次 `calculateIdle` 的 p95 <5ms（取排序后 95 分位，非均值）

## 10. 风险与回滚

常更热修；分支删除回退，字段按 `balanced` 忽略。

## 11. 实施步骤

1. `data.js` 增 `STRATEGIES/STRATEGY_CD_MS` 并导出
2. `engine.js` 增迁移、公式、`buildBattleMonster`、`getNow/__set*` 并导出
3. `index.js` 按 §5.2 两阶段实现 `POST /strategy`（用 `getNow()`）与 `getPlayerView`
4. `api.js` + `MapView.vue` + `App.vue`
5. 单测 + `pnpm test && pnpm build`
