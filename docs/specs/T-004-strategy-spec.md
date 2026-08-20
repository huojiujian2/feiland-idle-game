# T-004 战斗策略模式选择 — Spec v2

> 优先级 🔴 高 · 难度 ★★ · 分支 `feat/T-004-strategy` · 依赖 无（认证依赖见 §7）· 对应 `GAMEPLAY_TASKS.md:2.2`
> 本版修复 v1 的 8 项 MUST_FIX（收益边界/副本污染/计算顺序/原型污染/日志契约/授权模型/API 契约/可测试性）

## 1. 背景与目标

核心问题：挂机过于被动、玩家无决策点。本功能把「挂着不动」改为「挂着但有选择」，在挂机前提供策略 trade-off，影响后续所有 `calculateIdle` 收益。

成功标准：
- 玩家可在 3 个初始策略间切换，Lv.20/40/60 解锁 3 个进阶策略
- 策略立即影响战斗数值与挂机收益，前端 5 分钟内不可重复切换（CD 可感知）
- 非法客户端参数不生效；切换记录可审计（非安全边界，见 §7）

## 2. 范围

**做**
- 6 策略定义、数值、解锁条件（`server/data.js:STRATEGIES` 单一数据源）
- `player.strategy / strategyChangedAt` 持久化与迁移（含校验）
- `engine` 战斗/收益唯一落点与公式定版
- `POST /api/player/:username/strategy` 校验 + CD + 收益结算边界
- `MapView.vue` 策略卡片、`client/src/api.js` 封装、`getPlayerView` 回传
- `pnpm test` 可测试性 seam

**不做**
- 策略与职业/词条二次平衡（后续数据驱动）
- 策略独立排行榜
- 付费解锁
- 本期认证（依赖 T-061，见 §7）

## 3. 策略定义（权威表）

| id | 名称 | 效果（乘法） | 解锁 | 备注 |
|----|------|--------------|------|------|
| `aggressive` | 全力进攻 | `atk ×1.15`, `def ×0.90` | Lv.1 |  |
| `defensive` | 稳健防守 | `def ×1.15`, `atk ×0.90`, `regen ×1.50` | Lv.1 | `regen` 指 `getTotalStats.regen` 与战斗内 `regen` |
| `balanced` | 平衡 | 无加成 | Lv.1·默认 | 非法/缺失回退到此 |
| `greedy` | 贪婪掠夺 | `gold ×1.30`, `exp ×0.80`, `dropRate ×1.05` | Lv.20 | `dropRate` 作用于 `area.drops[].rate` 判定 |
| `desperate` | 背水一战 | `atk ×1.40`, `def ×0.70`，且 `hp/maxHp <0.30` 时 `atk` 额外 `×1.20`（最终 `×1.68`） | Lv.40 | 阈值在 `getCombatStats` 按实时 `hp` 判定 |
| `training` | 极限修炼 | `exp ×1.50`, `gold ×0.50`, 怪物 `atk ×1.20` | Lv.60 | 怪物加成仅当次战斗副本生效，不写盘 |

## 4. 数据模型

`server/engine.js:createCharacter` 新增：
```js
strategy: 'balanced',
strategyChangedAt: 0 // ms timestamp，上次成功切换时间；0 表示从未切换
```

`migratePlayer` 规则（覆盖旧存档与非法写盘）：
```js
if (typeof player.strategy !== 'string' || !Object.hasOwn(STRATEGIES, player.strategy)) player.strategy = 'balanced'
if (!Number.isFinite(player.strategyChangedAt)) player.strategyChangedAt = 0
```

`store` 无 schema 变更，JSON 透传。

## 5. 后端设计

### 5.1 常量与导出

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
module.exports = { AREAS, EQUIP_TEMPLATES, ..., STRATEGIES, STRATEGY_CD_MS, getStage, expToNext, createEquipItem }
```
必须加入显式导出列表（当前 `data.js:674-680` 为显式导出，遗漏则前端/引擎无法引用）。

### 5.2 收益结算边界（修复 P1-1）

`calculateIdle` 按 `lastTick → now` 单次结算，策略切换不得追溯修改已产生的挂机时间。

`POST /strategy` 成功路径必须：
1. `maybeResetWeeklyBossKills(store)` 与登录/查询一致（如需）
2. **先用旧策略结算**：`calculateIdle(player)`（若 `elapsed >= 3000` 则按旧 `strategy` 产生成果并更新 `player.lastTick`）
3. 再校验并写入新策略（见 §5.4）
4. `store.setPlayer` + `store.save()`（或由定时落盘）并返回 `getPlayerView`

禁止按 `strategyChangedAt` 拆分单次 `calculateIdle`（当前引擎为单次随机怪物，拆分会引入二次随机不一致）。切换前的 `lastTick→now` 全部归旧策略，切换后的下一次 `calculateIdle` 才用新策略。

### 5.3 数值唯一落点与公式（修复 P1-3）

唯一落点：
- **战斗向**（`atk/def/regen/monsterAtk/desperate`）：仅在 `getTotalStats` / `getCombatStats` 内生效，不在 `calculateIdle` 重复计算
- **收益向**（`exp/gold/drop`）：仅在 `calculateIdle` 结算阶段生效，不在 `getTotalStats` 内生效
- `getPowerScore` 定义为 `floor(total.atk + total.def + total.hp + total.agi)`，其中 `total` 来自 `getTotalStats`（含策略战斗向加成）。因此切换 `aggressive/defensive/desperate` 会影响排行榜战力，`greedy/training` 的 `exp/gold` 不影响战力。此为预期行为，需在接口文档注明

固定顺序与取整：
```js
// getTotalStats 内（战斗向）
baseAtk = 10 + (level-1)*3 + attr.atk*2 + eq.atk + ...
atk = floor(baseAtk * (1+affix.atk) * (1+strategy.atk) * allAttrMult)
// 同理 def/hp/agi；regen = (affix.regen+mechanics.regen) * (1+strategy.regen)
// desperate 低血：在 getCombatStats 内按实时 hpRatio < threshold 时 atk = floor(atk * 1.20)

// calculateIdle 内（收益向）
expMult = 1 + total.expBonus + lawBonus.exp
goldMult = 1 + total.goldBonus + lawBonus.gold
if (strategy==='greedy') { expMult *= 0.80; goldMult *= 1.30 }
if (strategy==='training') { expMult *= 1.50; goldMult *= 0.50 }
// 胜/败/超时均走同一 expMult/goldMult：
// win: expGain = floor(monster.exp * expMult) + talents + affix flat；goldGain = floor(monster.gold * goldMult) ...
// lose: expGain = floor(monster.exp * 0.1 * expMult)  // 策略同样影响失败/超时保底经验
// timeout: expGain = floor(monster.exp * 0.3 * expMult)
// drop: effectiveRate = drop.rate * (strategy==='greedy' ? 1.05 : 1)  // 仅 win 时判定
// training 怪物：const battleMonster = {...monster, atk: Math.floor(monster.atk * 1.20)} // 副本，不污染 AREAS
```
日志记录 `battleMonster.atk` 为调整后值，同时在 `logEntry` 保留 `monsterBaseAtk: monster.atk` 供审计。

### 5.4 API 契约（修复 P1-4/6/7）

`POST /api/player/:username/strategy` `Content-Type: application/json` `body: { strategy: string }`

**项目约定**：沿用现有风格 `HTTP 200 + { success: boolean, message?: string, data? }`，不使用 400 状态码（保持前端 `request` 统一处理）。

校验顺序（全部失败返回 `success:false`）：
1. `typeof strategy !== 'string' || !Object.hasOwn(STRATEGIES, strategy)` → `策略不存在`（防 `__proto__/constructor` 原型污染）
2. `player.level < STRATEGIES[strategy].reqLevel` → `需要 Lv.X 才能使用该策略`
3. `!Number.isFinite(player.strategyChangedAt)` 视为 `0`
4. 若 `strategy === player.strategy` → 直接返回 `success:true, data: getPlayerView(player)`（幂等，不刷新 CD，不写日志）
5. `Date.now() - player.strategyChangedAt < STRATEGY_CD_MS` 且 `strategyChangedAt !== 0` → `策略切换冷却中，剩余Xs`（`X = ceil((CD - elapsed)/1000)`）
6. 通过则先执行 §5.2 的旧策略结算，再 `player.strategy = strategy; player.strategyChangedAt = Date.now()`，写入 `player.logs`（见 §5.5），`store.setPlayer`，返回 `getPlayerView`

`getPlayerView` 新增透出：
```js
strategy: 'balanced',
strategyChangedAt: 1700000000000,
strategyCdRemaining: 0, // ms，向下取整，0 表示可切换；由 Date.now() - strategyChangedAt 计算，<0 取 0
strategies: [
  { id:'aggressive', name:'全力进攻', desc:'...', reqLevel:1, unlocked:true, active:false },
  // ...6 项，按 STRATEGIES 顺序
]
```

等级回退：已选高阶策略不自动踢出，但 `strategies[].unlocked` 为 false 且前端置灰；再次切换时仍校验 `reqLevel`。

### 5.5 日志契约（修复 P1-5）

切换成功追加：
```js
player.logs.push({
  time: Date.now(), // 必须，MapView.vue:240 formatTime 依赖
  type: 'strategy',
  from: oldStrategy,
  to: newStrategy,
  strategy: newStrategy, // 冗余便于过滤
  text: `策略切换：${STRATEGIES[oldStrategy].name} → ${STRATEGIES[newStrategy].name}`
})
```
保留既有截断：`engine:814` 保留 30 条、`getPlayerView:1202` 返回 20 条，策略日志遵循同一上限（可审计窗口为最近 20 条，非长期审计；长期审计依赖 T-061 后端日志）。

### 5.6 安全与授权（修复 P1-6）

当前 ` /api/player/:username/...` 信任路径参数 `username`，无服务端身份校验，任何知晓用户名者可改他人策略。**T-004 不引入认证**，不宣称安全边界。

Spec 声明：T-004 的“可追责”仅指 `logs.from/to/time` 可回溯到玩家对象，不作为防伪/授权保证；完整认证/授权由 T-061 `API 限流与安全加固（JWT/bcrypt）` 解决，T-004 仅预留 `req.user` 接入点。

## 6. 前端设计

`MapView.vue`（不新增 Tab，保持全屏替换）：
- 在「挂机区域」与「战斗属性」之间新增「战斗策略」卡片，复用现有网格（桌面 4 列/手机 2 列/底部翻页器无需）
- 6 按钮：`active` 高亮、`locked` 置灰、`cd` 遮罩显示 `剩余 XmYs`（由 `strategyCdRemaining` 轮询 1s 递减）
- 交互：点击 → `emit('strategy-change', id)` → `App.vue` 调用 `api.setStrategy(username, id)` → 成功用返回 `data` 全量回写 `player`（禁止直接 `props.player.strategy =`），失败用项目现有 `alert`/`toast` 提示 `message`
- 样式：仅 `var(--duration-*/--ease-*/--accent-*/--lb-*)`，无硬编码色值

`client/src/api.js`：
```js
setStrategy(username, strategy) { return request(`/player/${username}/strategy`, { method:'POST', body: JSON.stringify({ strategy }) }) }
```

## 7. 非功能与约束

- 性能：常数分支，`calculateIdle` 单次 <1ms
- 时间/随机可测试：见 §8 seam
- 安全：见 §5.6

## 8. 可测试性（修复 P1-8）

`package.json` 新增：
```json
"scripts": { "test": "node --test server/**/*.test.js" }
```

`server/engine.js` 暴露 seam（不改业务逻辑）：
```js
// 仅测试注入：__setNow, __setRandom, __setDropRandom
let _now = () => Date.now(), _rand = Math.random
function __setNow(fn){ _now = fn } // 测试用
```
`calculateIdle` 内 `Date.now` → `_now()`，`Math.random` 抽样走 `_rand`，`drop` 判定单独函数 `shouldDrop(rate, strategy)` 便于单测覆盖 `greedy ×1.05`。

单测覆盖（`server/engine.strategy.test.js`）：
- 收益边界：`lastTick` 未结算时切换，旧策略结算一次、新策略下一次生效
- `training` 不污染 `AREAS`（切换前后 `AREAS.shenyuan.monsters[1].atk` 不变）
- 数值：`aggressive atk×1.15 def×0.90` 等 6 策略对照表
- 校验：`__proto__/constructor/toString` 被拒，`strategyChangedAt=NaN` 回退
- CD：`strategyChangedAt=0` 首次无 CD，重复选同一策略幂等，冷却中剩余秒误差 <2s
- 日志：`time/from/to` 存在且 `formatTime` 可渲染

## 9. 验收标准

- [ ] 初始号 `strategy==='balanced'`，`strategies` 6 项且解锁态正确
- [ ] 切换前有未结算 `elapsed>=3s` 时，先按旧策略产出一条 battle 日志，再更新策略
- [ ] `training` 时 `AREAS` 原始 `atk` 不变，`log.monsterBaseAtk` 与 `log.monster.atk` 差 `×1.20`
- [ ] `aggressive` 等数值符合 §5.3 公式且 `powerScore` 随战斗向策略变化，`greedy` 不影响战力
- [ ] `greedy` Lv.19 拒、Lv.20 过；`desperate` 阈值行为正确；`training` 掉落不变
- [ ] 冷却中二次切返回 `剩余Xs`，`strategyCdRemaining` 单位 ms 且倒计时准确
- [ ] 日志含 `time/from/to` 且 MapView 不显示 `NaN:NaN:NaN`
- [ ] `api.setStrategy` 经 `App.vue` 回写，不直接改 prop；失败走 `alert`
- [ ] `pnpm test` 通过，`pnpm build` 通过，`git diff --check` 0

## 10. 风险与回滚

- 数值风险：仅改 `STRATEGIES` 热修
- 回滚：分支删除即回退；存档 `strategy` 保留，回退后按 `balanced` 语义忽略

## 11. 实施步骤

1. `server/data.js` 增 `STRATEGIES/STRATEGY_CD_MS` 并加入 `module.exports`
2. `server/engine.js` 增迁移、公式定版、`training` 副本、`__setNow/__setRandom` seam
3. `server/index.js` 增 `POST /strategy`（含旧策略结算边界与校验）与 `getPlayerView` 透出
4. `client/src/api.js` + `MapView.vue` + `App.vue` 事件透传 + `style.css` 变量
5. `package.json` 增 `test` 脚本与单测，`pnpm test && pnpm build` 验证后提交 PR（不合入）
