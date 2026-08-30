# T-102 远征探索 — 技术方案 Spec v4（待审核·已闭合 v3 评审 2P0+2P1）

> 范围严格对应 `ai开发任务需求:89-115` 远征探索 + `ai开发任务需求:97-106` 区域设计 + `ai开发任务需求:108-114` 事件与首领 + `ai开发任务需求:162-170` 统一原则。
> 本阶段**仅做个人远征**，不开放公会。功能按文档全量落地（4 区域/8-12 事件/区域首领/结算报告），工程上小步快跑（规范与单测从简）。

## 1. 背景与目标

- 现状：已有 `server/data/areas.js:9` 14 挂机区与 `server/engine/idle.js:29` 5s 结算，但无 `ai开发任务需求:93` 所需的“选择区域→设置时长→离线探索→随机事件→领取结算报告”离线决策内容。
- 目标：按 `ai开发任务需求:97-106` 开放 4 区域（差异体现在收益结构而非单纯数值）、`ai开发任务需求:108-110` 8-12 事件各 2 选项、 `ai开发任务需求:112-114` 区域首领（复用 `worldboss.js:270` 小型化思路，1 人规模、奖归个人），用 `T-101` 的 `withTransaction/getNow/settlementLedger` 做幂等与快照，为 F03 公会贡献提供来源。

## 2. 功能范围（按文档全量，不裁剪）

**必须做：**
- 4 区域 `ai开发任务需求:101-106` 全量
- 固定时长 3 档（30m/2h/8h）`ai开发任务需求:93`
- 10 事件（覆盖战斗/商人/遗迹/救援/天气/路线 `ai开发任务需求:110`），每事件 2 选项、明示风险/可能收益/是否影响时长
- 区域首领 `ai开发任务需求:112-114`：高概率触发、复用 `server/engine/combat.js:241 simulateBossBattle` 思路但走新增 `simulateExpeditionBossBattle(CombatSnapshot,boss,5)`（见 §3.3）、5 回合内战报、里程碑发装备材料（称号本期 N/A，见 §5.4）
- 结算报告：挂机时长、基础收益、事件结果、首领战报、战利品汇总，沿用 `idle.js` 展示语言 `ai开发任务需求:146`
- 联动：`daily.js` 远征计数、`titles.js` 探索成就、`codex` 区域/首领记录（本期先计数与掉落去重）
- 单队并发 + 历史截断 + 重启一致

**暂缓（按 `ai开发任务需求:199`）：** 实时寻路/几十层随机地图/强制组队/多人集火首领

## 3. 静态配置 `server/data/expedition.js`（新增）

### 3.1 区域 `EXPEDITION_AREAS`（4 个，收益结构差异化）

| id | 名称 `ai开发任务需求:101` | `minLevel` | 风险 | 主要收益 | 事件池 | 首领 | 首领概率 |
|----|---------------------------|------------|------|----------|--------|------|----------|
| `verdant_border` | 丰饶边境 | 1 | 低 | 金币+基础经验 `gold 80~150 exp 120`，材料 `草药/兽皮` 30% | 低风险 6 个 | `边境巡林客` | 0.10 |
| `ancient_ruins` | 古代遗迹 | 15 | 中 | 装备材料+图鉴碎片 `gold 200~400 exp 400`，`青铜矿/飞龙鳞片` 15% | 中风险 6 个（含 2 复用） | `遗迹守卫` | 0.30 |
| `abyss_rift` | 深渊裂隙 | 30 | 高 | 稀有材料+特殊道具 `gold 350~600 exp 800`，`深渊之石/法则碎片` 10%，**中概率损失 30% 基础金币** | 高风险 6 个 | `裂隙潜伏者` | 0.35 |
| `dragon_nest` | 巨龙巢穴 | 50 | 高 | 首领战利品+称号进度 `gold 500~900 exp 1200`，`龙鳞/龙血` 8% | 高风险 6 个 | `雏龙` | 0.60 |

- 结构：`{id,name,desc,minLevel,risk:'low'|'mid'|'high', base:{gold:[min,max], exp:number, drops:Array<{name,rate}>, goldLoss?:{chance:number, rate:number}}, boss:{name,hpRate,atkRate,expMul,goldMul,chance}, eventPool:string[]}`
  - `base.goldLoss` 仅 `abyss_rift` 配置 `{chance:0.4, rate:0.3}`（中概率损失 30% 基础金币，`ai开发任务需求:101`），其余区域无此字段；派遣时预骰 `baseGoldLossRoll=getRand()` 与 `baseGoldLossTriggered=roll<chance` 并持久化，供结算时使用（见 §5.1）
- `boss.hpRate/atkRate` 相对于玩家快照的系数（小型化，首领约玩家 `hp*4 atk*2`），复用 `worldboss.js:139` 按最强思路但缩小为个人快照
- `EXPEDITION_DURATIONS = [{key:'30m', ms:30*60*1000},{key:'2h', ms:2*3600*1000},{key:'8h', ms:8*3600*1000}]` 三档共享；`MIN_EXPEDITION_MS = 10*60*1000`（允许负时长选项缩短后的下界，解决 `Spec:113` 截断问题）
- 校验：`player.level < minLevel` → 400；`durationKey` 非法 → 400

### 3.2 事件 `EXPEDITION_EVENTS`（10 个，8-12 区间内）

| id | 类型 | 标题 | 选项A | 选项B | 时长影响 |
|----|------|------|-------|-------|----------|
| `evt_battle_slime` | 战斗 | 史莱姆群 | 稳妥推进 | 强行突破 | B -10% 时长但高收益 |
| `evt_merchant` | 商人 | 流浪商人 | 交易(耗金币得材料) | 拒绝 | 无 |
| `evt_ruins_trap` | 遗迹 | 机关密室 | 破解(敏捷判定) | 绕行(耗时+10m) | A 失败损失金币/B +10m |
| `evt_rescue` | 救援 | 受伤旅人 | 救助(耗时间得称号进度) | 观望 | A +10m |
| `evt_weather` | 天气 | 突变天气 | 冒雨前进(风险) | 休整(耗时) | B +15m |
| `evt_route` | 路线 | 岔路口 | 捷径(高风险) | 大路(稳定) | A -10m/B 无 |
| `evt_treasure` | 遗迹 | 废弃宝箱 | 开启(概率陷阱) | 留给后来人 | 无 |
| `evt_scout` | 战斗 | 斥候遭遇 | 交涉(策略判定) | 驱逐(战斗) | 无 |
| `evt_abyss_whisper` | 战斗 | 深渊低语 | 倾听(高风险高稀有材料) | 屏蔽 | 无 |
| `evt_dragon_sign` | 遗迹 | 龙痕 | 追踪(高概率首领) | 绕开 | A 首领概率+0.2 |

- 每事件 `choices:[{id:'a'|'b', label, risk:'low'|'mid'|'high', rewardHint:string, timeDelta:number, outcome:{ success:boolean, goldDelta:number, expDelta?:number, material?:{name:string,count:number}|null, lossRate?:number, bossChanceDelta?:number, message:string }}]`
  - `success` 为该选项的风险判定结果（服务端预骰，刷新不变）；`goldDelta` 可负（`costGold` 统一为负的 `goldDelta`，如商人交易 `-50`、陷阱失败 `-80`）；`lossRate` 如 `0.3` 表示按基础金币的 30% 扣除（事件级高风险）；最终结算 `totalGold = max(0, baseGold + ΣgoldDelta + bossGold - floor(baseGold*(baseGoldLossRate+ΣlossRate)))`，保证非负
  - `timeDelta` 若配置为百分比（如 `'-10%'`）则在派遣时解析为固定毫秒值 `Math.floor(baseMs * -0.10)` 后持久化为数值；若为数值则直接存毫秒数（含负值如 `-10*60*1000`），后续 `choose` 与 `claim` 均按数值计算，避免百分比在改选时重复计算
- 调度：每远征随机 1~2 个事件（`getRand()` 按区域 `eventPool` 抽样，`verdant_border` 1 个、其余 1-2 个），**服务端预骰**：为每 choice 预计算 `outcome`（含 `success/goldDelta/lossRate/bossChanceDelta/message`）并固化到 `expedition.events[].choices[].outcome`，`chosenId` 初始 `null`，前端仅展示 `risk/rewardHint/timeDelta`，刷新不改结果 `ai开发任务需求:110`

### 3.3 首领模板 `EXPEDITION_BOSSES`（内联于区域 boss 字段，复用伤害思路）

- 快照定义 `CombatSnapshot`（远征出战快照，派遣时固化，供首领战直接使用）：
  ```js
  snapshot: {
    level:number, strategy:string,
    atk:number, def:number, maxHp:number, hp:number, agi:number,
    crit:number, critDmg:number, dodge:number, lifesteal:number, regen:number,
    // 由 getTotalStats(player)+getCombatStats(player) 在 dispatch 时一次性快照，不随后续属性变化
  }
  ```
- 按快照生成首领：`boss.hp = snapshot.maxHp * hpRate`、`boss.atk = snapshot.atk * atkRate`、`boss.def = floor(snapshot.def*0.8)`、`boss.agi = floor(snapshot.agi*0.9)`，`boss.skillChance=0.15`
- 新增远征首领战斗接口（不复用 `server/engine/combat.js:241 simulateBossBattle(player,boss)` 的 `getCombatStats` 路径，避免 `Spec:60` 五字段 snapshot 不可用）：
  ```js
  type ExpeditionBossBattleResult = { result:'win'|'lose'|'timeout', rounds:Array<{round,actions:Array<{actor:'player'|'monster',skill:string,damage?:number,crit?:boolean,dodge?:boolean,pHp:number,mHp:number}>,pHp:number,mHp:number}>, totalDamage:number }
  function simulateExpeditionBossBattle(snapshot:CombatSnapshot, boss:{hp,atk,def,agi,skillChance}, maxRounds=5): ExpeditionBossBattleResult
  ```
  内部直接使用 `snapshot.atk/def/agi/crit/dodge/maxHp/hp`，不读取 `attributes/equipped/affixes`，战报结构与 `simulateBossBattle` 一致便于复用渲染
- 奖励：`gold = floor(baseGold * goldMul)`、`exp` 同理 + 固定材料 1 个 + 首领计数 `bossKills++`（用于里程碑）

## 4. 数据模型

```js
// player 扩展（migratePlayer 默认，JSON 可持久化）
expedition: null | {
  id: string,            // genUid()
  areaId: string,        // 4 选 1
  durationKey: '30m'|'2h'|'8h',
  startAt: number,       // getNow()
  baseEndAt: number,     // startAt + ms（不含选项时间影响，用于重算基准）
  endAt: number,         // baseEndAt + appliedTimeDelta（Σ 已选 choice.timeDelta 数值，百分比已在派遣时解析为 ms；默认选项未选时不计入，claim 时按默认 a 补算）
  appliedTimeDelta: number, // 已应用的 ΣtimeDelta 数值（随 choose 改选回滚/重加）
  baseGoldLossRate: number, // 区域基础金币损失率（abyss_rift 预骰 0 或 0.3，其余恒 0，见 §5.1）
  baseGoldLossRoll: number, // 区域基础损失预骰 roll（0-1，持久化供报告追溯）
  snapshot: { level:number, strategy:string, atk:number, def:number, maxHp:number, hp:number, agi:number, crit:number, critDmg:number, dodge:number, lifesteal:number, regen:number }, // CombatSnapshot
  events: Array<{ eventId:string, title:string, desc:string, choices:Array<{id,label,risk,rewardHint,timeDelta:number,outcome:{success:boolean,goldDelta:number,expDelta?:number,material?:{name,count}|null,lossRate?:number,bossChanceDelta?:number,message:string}}>, chosenId: string|null, choiceChangeCount:number }>,
  boss: null | { id:string, name:string, baseChance:number, roll:number, triggered:boolean|null, battle:ExpeditionBossBattleResult|null, rewards:{gold:number,exp:number,material?:{name,count}}|null },
  status: 'ongoing'|'ready'|'claimed',
  settlementId: string,  // expedition:${id}
}
expeditionHistory: Array<{ id, areaId, durationKey, startAt, endAt, claimedAt:number, reward:{gold:number,exp:number,materials:Array}, bossTriggered:boolean, eventsSummary:string }> // ≤20 截断
expeditionCodex: Record<areaId, { dispatched:number, claimed:number, lastAt:number, bossKills:number }>
expeditionReports: Record<expeditionId, { id, areaId, durationKey, startAt, baseEndAt, endAt, claimedAt, base:{gold:number,exp:number,drops, baseGoldLossRate:number, baseGoldLossRoll:number}, events:Array<{eventId,chosenId,outcome}>, boss:{triggered:boolean,battle:ExpeditionBossBattleResult|null,rewards:{gold,exp,material?}|null,baseChance:number,roll:number,finalChance:number}|null, total:{gold:number,exp:number,materials:Array} }> // 近 20 份报告供追溯
settlementLedger: 追加 { id: settlementId, at:number, type:'expedition', reward:{gold:number,exp:number,materials?:Array,equips?:Array}, source:`expedition:${areaId}:${durationKey}`, fullResult: expeditionReports[id] } // 复用 T-101 ≤100，reward 仅最终非负奖励（不含 goldDelta/lossRate 中间字段），需满足 assertSettlementReward('expedition',reward)
```

- `migratePlayer`：缺字段补默认，`expedition.status` 非法回 `ongoing`，历史/报告超 20 截断；`expeditionCodex` 4 key 补零
- `getPlayerView` 新增 `expedition/currentExpedition/expeditionHistory/codex/reports`

## 5. 后端设计

### 5.1 模块

- `server/data/expedition.js` — 导出 `EXPEDITION_AREAS/EXPEDITION_EVENTS/EXPEDITION_DURATIONS/getExpeditionConfig()`
- `server/engine/expedition.js` — 注入 `grantGold/grantExpWithLevelUp/updateDailyProgress/checkAchievements`（同 `daily.js:47`）：
  - `dispatchExpedition(player, areaId, durationKey)` — 校验单队并发/等级/时长；`genUid()`、`getNow()` 快照 `getCombatStats` 得 `CombatSnapshot`、抽 1-2 事件并预骰（含 `success/goldDelta/lossRate/bossChanceDelta/message`，`timeDelta` 百分比已解析为固定 ms 数值持久化）、`boss` 仅保存 `{baseChance: area.boss.chance, roll: getRand(), triggered:null}` 不预先判定（解决 `bossChanceDelta` 在派遣后失效问题，`Spec:53` 选项的 `+0.2` 在 claim 时才生效）、`baseGoldLossRoll=getRand()`、`baseGoldLossRate=(area.base.goldLoss && baseGoldLossRoll < area.base.goldLoss.chance ? area.base.goldLoss.rate : 0)`（仅 `abyss_rift` 有 `{chance:0.4,rate:0.3}`，其余 0，解决 `Spec:32` 区域级 30% 损失无来源问题）、`baseEndAt=startAt+ms`、`endAt=baseEndAt`、`appliedTimeDelta=0`、每事件 `chosenId=null, choiceChangeCount=0`，写 `player.expedition`、`codex[areaId].dispatched++`，返回 `expedition`
  - `chooseEventOption(player, eventId, choiceId)` — 仅 `ongoing` 可选（`ready` 后禁止，避免 `Spec:95` 状态歧义），校验事件存在且 `choiceChangeCount<1`（每事件仅允许改选一次，`chosenId===null` 首次选择不计改选、已有选择后改选则 `choiceChangeCount++` 满 1 后 409）；`endAt = baseEndAt + Σ(各事件 chosenId?对应choice.timeDelta数值:0)` 重算（回滚旧 delta 再加新 delta，`appliedTimeDelta` 同步），`endAt` 下界为 `startAt + MIN_EXPEDITION_MS`（`10*60*1000`，非 `baseEndAt`，使 `Spec:43` 的 `-10m/-10%` 负时长选项可真正提前领取，`Spec:113` 截断修复）
  - `claimExpedition(player, expeditionId)` — `expeditionId` **必填**（见 5.3 重放闭合）；先按 `expeditionId` 查 `settlementLedger`（`id=expedition:${expeditionId}`）若命中则 200 `already:true` 重放 `fullResult` 不二次发放；否则校验 `player.expedition && player.expedition.id===expeditionId` 否则 404 未找到；对每事件若 `chosenId===null` 则默认 `chosenId='a'` 并将其数值 `timeDelta` 与 `lossRate/bossChanceDelta` 纳入本次结算的 `endAt` 与损失/概率汇总（重算 `endAt = baseEndAt + Σ(含默认a)的timeDelta` 后若 `getNow()<endAt` 仍按 409 拒绝，保证默认选项时长影响生效）；否则 `endAt` 已在 `choose` 时重算；`base = rollBase(area)`，`eventGold = Σ outcome.goldDelta`、`eventExp = Σ outcome.expDelta`、`eventLossRate = Σ outcome.lossRate`，`lossGold = floor(base.gold * (baseGoldLossRate + eventLossRate))`（区域基础损失与事件损失叠加，下界 0），`finalChance = clamp(0,1, boss.baseChance + Σ outcome.bossChanceDelta)`，`triggered = boss.roll < finalChance`（此时才判定，`evt_dragon_sign` 的 `+0.2` 生效），若 `triggered` 则 `simulateExpeditionBossBattle(snapshot,boss,5)` 得 `ExpeditionBossBattleResult` 战报与 `boss.rewards`，`totalGold = max(0, base.gold + eventGold - lossGold + (triggered?boss.rewards.gold:0))`、`totalExp = max(0, base.exp + eventExp + (triggered?boss.rewards.exp:0))`，`grantGold/grantExpWithLevelUp` 发放、材料 `inventory` 去重追加、`updateDailyProgress(player,'expedition1',1)`、`checkAchievements`、写 `settlementLedger`（`assertSettlementReward('expedition', {gold:totalGold,exp:totalExp,materials,equips})` 仅校验最终奖励，`goldDelta/lossRate/bossChanceDelta` 仅存 `fullResult/report` 不入 ledger reward，解决 `Spec:100/131` 混用）、`expeditionHistory/reports/codex.claimed++` 截断、`expedition=null`，返回 `report`
  - `getExpeditionStatus(player)` — 推导 `remainingMs = max(0,endAt-getNow())`、`status = getNow()>=endAt?'ready':'ongoing'`，供轮询；事件默认 `a` 的 `timeDelta` 在此不计入 `endAt`，仅 claim 时补算并据此判定是否可领，GET 不自动改 `endAt`

### 5.2 时间与随机

- 全部 `Date.now()`→`getNow()`，事件/基础掉落/首领判定走 `getRand()`，受 `state.__setNow/__setRandom` 控制
- `endAt` 与 `remainingMs` 同源 `getNow()`，时长影响通过 `choice.timeDelta` 累加体现

### 5.3 幂等与事务（沿用 T-101，闭合 claim 重放）

- 唯一键 `settlementId = expedition:${expedition.id}`，`settlementLedger` 为首要重放依据
- **claim 重放顺序（必严格按此）**：
  1) 收到 `POST /expedition/claim {expeditionId}` 先查 `player.settlementLedger` 中 `id===expedition:${expeditionId}` 的条目，若命中且 `fullResult` 完整 → 200 `{already:true, report:fullResult}` 重放，不写盘；
  2) 若命中但 `fullResult` 缺失 → 500 `数据损坏`；
  3) 若未命中，再校验 `player.expedition && player.expedition.id===expeditionId` 是否为当前进行中远征，存在则走正常 claim 结算；不存在则 404 `远征不存在或已结算`（此时若 ledger 未命中则视为已超出保留窗口或非法 id）；
  4) 结算成功后 `expedition=null`，后续同 `expeditionId` 的 claim 必走 1) 重放；`expeditionId` 为空或缺参直接 400
- `dispatch/choose/claim` 均 `store.withTransaction`，失败 500 回滚；`GET /expedition` 若触发 `status` 推导变更走事务保存
- `settlement.js` 新增 `expedition` 校验：`assertSettlementReward('expedition', {gold:number>=0, exp:number>=0, materials?:Array<{name,count}>, equips?:Array})` 仅校验最终奖励非负，`goldDelta/lossRate/bossChanceDelta/success/message` 仅存 `fullResult/report.events[].outcome` 与 `report.base.baseGoldLossRate/roll`，不入 `settlementLedger.reward`

### 5.4 联动

- `daily.js` 新增 `expedition1` 进度口（完成 1 次远征，复用 `updateDailyProgress`）
- `titles.js` 本期 **N/A**：探索称号（`遗迹探索者/深渊行者/屠龙者`）延期至 F05 联动阶段统一发放，本期仅计数与材料奖励，不新增 `EXPEDITION_TITLES`；若“功能全量”需含称号则需另起 `Spec` 增量，当前 spec 明确为 N/A
- `view.js` 透出 `expedition` 相关视图

## 6. API 契约 `server/routes/expedition.js` → `registerExpeditionRoutes(app,store)` 在 `routes/index.js` 注册

| 方法 | 路径 | 入参 | 成功 | 失败 |
|------|------|------|------|------|
| GET | `/api/expedition/config` | — | 200 `{areas,durations,events}` | — |
| GET | `/api/player/:u/expedition` | — | 200 `{expedition,history,codex,reports,remainingMs}`（无则 `expedition:null`，`remainingMs` 基于 `endAt=getNow()` 推导，默认选项 timeDelta 不预计入） | 404 角色不存在 / 500 |
| POST | `/api/player/:u/expedition/dispatch` | `{areaId,durationKey}` | 200 `{expedition}` | 400 缺参/非法时长 / 404 区域/角色不存在 / 409 已有远征或等级不足 / 500 |
| POST | `/api/player/:u/expedition/event/choose` | `{eventId,choiceId:'a'|'b'}` | 200 `{expedition}`（`appliedTimeDelta/endAt` 同步重算） | 400 缺参 / 404 远征/事件不存在 / 409 已结算/`ready`后禁止选择/已达改选上限(1 次) / 500 |
| POST | `/api/player/:u/expedition/claim` | `{expeditionId:string} **必填**` | 200 `{report, expedition:null, history}` / 200 `{already:true, report}` 重放（先查 ledger） | 400 缺参(无 expeditionId) / 404 远征不存在或已结算(ledger 未命中) / 409 未到时间(按 `baseEndAt+Σ默认a的timeDelta` 重算后仍未到) / 500 |

- 统一 `{success,data?,message?,already?}`，`_helpers.fail` 显式码

## 7. 前端 `client/src/api.js` + `ExpeditionView.vue`

- 入口：**地图侧边抽屉“远征营地”**（避免 `TabBar.vue:138` 6 Tab 拥挤，二期再考虑独立 Tab），复用 `MapView.vue:258` 抽屉模式
- `ExpeditionView.vue` 全屏替换：
  - 无远征：4 区域卡片（名称/推荐等级/风险/主要收益 `ai开发任务需求:101-106`/首领概率/时长 3 档）+ 派遣
  - 进行中：倒计时 `remainingMs` 1s 递减（仅展示）、事件卡片（标题/描述/2 选项 `risk/rewardHint/timeDelta` 高亮 `chosenId`，`ready` 前可改选）
  - 可领取：高亮“领取结算” + 基础/事件/首领收益预览
  - 报告：展开上次 `report`（时长/基础/事件结果/首领战报 5 回合/战利品汇总），文案同 `idle.js` 挂机报告 `ai开发任务需求:146`
  - 历史：近 10 条简表 + `codex` 计数
- `App.vue` 透传 `handleExpedition*`，`GET /player` 轮询不自动 claim，仅 `ExpeditionView` 轮询 `GET /expedition`

## 8. 验收（功能全量，工程从简）

- [ ] 4 区域 × 3 时长可派遣，等级不足 400，未到 `endAt` claim 409，单队并发二次 dispatch 409；负时长 `-10m/-10%` 可使 `endAt` 早于 `baseEndAt` 不低于 `startAt+10m`（`MIN_EXPEDITION_MS`），默认 `a` 的 `-10%` 已解析为 ms 并在 claim 时补算
- [ ] 10 事件各 2 选项，`risk/rewardHint/timeDelta数值/success/message/goldDelta/lossRate/bossChanceDelta` 完整，刷新不改预骰 outcome（服务端固化），仅 `ongoing` 可选、每事件改选上限 1 次，未选 claim 时默认 `a` 且补算其 `timeDelta` 后仍需满足 `getNow()>=endAt` 才可领
- [ ] 商人耗金币为负 `goldDelta`、陷阱失败扣金币、区域 `abyss_rift baseGoldLoss {chance:0.4,rate:0.3}` 预骰叠加事件 `lossRate` 按基础金币扣减，最终 `gold/exp` 非负；`evt_dragon_sign` 的 `bossChanceDelta +0.2` 在 claim 时与 `boss.roll` 叠加判定生效（非派遣时预判定）
- [ ] 远征首领走 `simulateExpeditionBossBattle(CombatSnapshot,boss,5):ExpeditionBossBattleResult`，`snapshot` 含 `atk/def/maxHp/agi/crit/dodge` 可直接战斗，`battle` 字段类型统一为 `ExpeditionBossBattleResult|null`，战报 5 回合可追溯且奖归个人；`巨龙巢穴` 0.6 高概率验证
- [ ] ledger `reward` 仅最终 `{gold,exp,materials,equips}`（非负），`goldDelta/lossRate/success/bossChanceDelta` 仅存 `report`；`assertSettlementReward('expedition')` 仅校验最终奖励
- [ ] `POST claim {expeditionId}` 必填，`expeditionId` 重放路径先查 `settlementLedger` 再判当前远征，二次 claim 200 `already:true`，`expedition=null` 后无参 claim 400；`history≤20/reports≤20`、`inventory` 持久化、可追溯；称号本期 N/A（`titles.js` 不新增）
- [ ] 重启一致：dispatch → 等 5s 落盘 → 重启 → `GET /expedition` 同 `id/remainingMs/baseEndAt/appliedTimeDelta/baseGoldLossRate`
- [ ] `npm run build` 通过；单测从简（`server/engine/expedition.test.js` 4-6 例覆盖 dispatch/负时长下界/区域基础损失/耗金币与lossRate非负/bossChanceDelta 生效/重放，不追求覆盖率门槛）

## 9. 风险与回退

- `db.json` 膨胀：`history/reports/ledger` 均 20/20/100 截断
- 回退：`git revert` 删除 `data/expedition.js/engine/expedition.js/routes/expedition.js/ExpeditionView.vue` + `player.js` 迁移字段，老档自动补默认

## 10. 实施步骤

1. `data/expedition.js` + `engine/settlement.js` 扩展 `expedition` 校验
2. `engine/expedition.js` + `engine/player.js` 迁移 + `engine/view.js` + `engine/index.js` 导出
3. `routes/expedition.js` + `routes/index.js`
4. `api.js` + `ExpeditionView.vue` + 地图入口
5. `npm test` + `npm run build` + `06-changelog.md` v1.05
