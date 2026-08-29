# T-101 稳定性底座（P0）— 技术方案 Spec v10（待审核·修订版）

> 范围严格对应 `ai开发任务需求:136-142` P0 + `ai开发任务需求:162-170` 统一原则 + `ai开发任务需求:175-177` 阶段01。
> 本阶段**不开放**公会与远征入口，仅加固存档、奖励与展示底座，为后续 F02-F05 提供幂等与追溯能力。
> v10 修订：闭合 v9 评审 5 项阻塞 — 事务边界与 safeSave、skip 占位数据模型、重放判别联合、奖励精确组合与校验归属、手工结算鉴权。

## 1. 背景与目标

- 现状：存档原子写 `server/store.js:56-73`、5s/30s 定时保存、奖励链路分散、称号混用已统一为对象。
- 目标：统一唯一结算与时间口径、加固存档与强类型可追溯、统一称号 canonical 与时间 seam、补齐移动端基线；**不新增**公会/远征业务入口。

## 2. 需求澄清

### 2.1 存档与数据一致性

| 场景 | 要求 | 当前落点 | 本期加固 |
|------|------|----------|----------|
| 玩家轮询 | `GET /api/player/:u` 内完成 `migratePlayer`→`refreshDailyIfNeeded`→`calculateIdle`→`updateOfflineSnapshot`→事务保存→`getPlayerView` | `server/routes/player.js:14-24` | 改用 §2.4 全状态事务，失败返 500 |
| 定时保存 | 5s 全量 `calculateIdle` + `store.save()`；30s 兜底；竞技场每分钟 `settleDuePeriods` | `server/index.js:33-45` | 结算上一周期，有结算必事务保存，失败不推进游标 |
| 手动保存 | 任何 `store.setPlayer/setMeta` 经 `markDirty` 5s 延迟落盘 | `server/store.js:48-73` | 新增事务 API，`lastSaveError` 成功清零，`finally` 清 timer |
| 重启后一致性 | `store.load` 恢复 `accounts/players/meta`，`engine.setStore` 重水合 | `server/store.js:13-46` | `migratePlayer` 补 `titleExpiry/settlementLedger` 默认并过滤非法 key |
| 字段覆盖 | 头像、称号、装备、背包、属性点、PvP、Boss 均需通过“修改→刷新→重启→再读取” | `server/engine/player.js:22-75` | 远征/公会 **N/A**（见§2.5） |

### 2.2 统一奖励唯一结算（强类型审计闭环）

> 原则：`ai开发任务需求:165-170` — 唯一结算、快照战斗、软性奖励、可追溯。**所有发奖必先校验是否已处理**。

**审计载体**
- `player.settlementLedger: Array<SettlementLedgerEntry>` ≤100。
- `meta.arenaRewards[period][periodKey]` 全局分类账，空排名也占位。
- `meta.arenaSkipped[period][periodKey]: {at:number, source:string}` 独立跳过记录（不与 `arenaRewards` 混用）。

```ts
// SettlementReward 单对象多可选字段 + 严格白名单（非互斥，因成就可同时含 gold+equips+title）
type SettlementReward =
  | null // 仅 chest
  | { gold:number } | { exp:number } | { materials:Array<{name:string,count:number}> }
  | { gold:number, equips:Array<{templateId:string}>, title?:string }
  | { gold:number, title:string } | { affixId:string, title?:string } | { reincPoints:number, title:string }
  | { gold:number, exp:number } | { gold:number, exp:number, titles:string[] }
  | { coins:number } | { gold:number, exp:number, coins:number }
  | { pointsDelta:number, points:number, title?:string } | { title:string, cost:number, points:number }

// 每 type 的 required/allowed 精确契约（assertSettlementReward 强制，位于 server/engine/settlement.js）
 // daily: 恰含其一 {gold}|{exp}|{materials}，materials 非空数组
 // chest: 必须 null
 // achievement: 至少含其一 {gold, equips, affixId, reincPoints, title}，且组合必须为实际存在组合（见下）；equips/title 非空
   // 实际成就组合白名单：{gold,title}（first/kill100/lv100/gold1m/collect10）、{gold,equips,title}（kill1000/kill10000/ascend）、{affixId,title}（affix50 词条大师）、{reincPoints,title}（reinc1）
 // boss_participation: 必含 {gold, exp} 且 ≥0
 // boss_settle: 必含 {gold, exp}，titles 可选但若出现非空
 // arena_*: 必含 {coins} 且 ≥0
 // pvp_challenge: 必含 {gold, exp, coins}
 // cock_round: 必含 {pointsDelta, points}，title 可选
 // cock_exchange: 必含 {title, cost, points} 且 cost>0

type PvpBattleRound = {
  round:number,
  actions:Array<{
    actor:'A'|'B', skill:string,
    damage?:number, crit?:boolean, dodge?:boolean, heal?:number,
    buff?:boolean, shield?:boolean, revive?:boolean,
    hpA:number, hpB:number
  }>, hpA:number, hpB:number
}
type PvpChallengeResult = {
  battle:{ result:'win'|'lose'|'draw', rounds:PvpBattleRound[], myHp:number, myMaxHp:number, enemyHp:number, enemyMaxHp:number },
  isWin:boolean, isDraw:boolean,
  rewards:{ gold:number, exp:number, coins:number },
  ratingChange:number, newRating:number, arenaCoins:number,
  targetName:string, targetLevel:number, targetJob:string,
  player:{ username:string, name:string, level:number, rating:number, pvpStats:{ wins:number, losses:number, streak:number, bestStreak:number } }
}
type CockResolveResult = {
  win:boolean, champion:string, championId:string,
  report:string[],
  pointsDelta:number, points:number, streak:number, played:number, todayLeft:number,
  interventionApplied:Array<{chicken:string,stat:string,from:number,to:number}>,
  interventionDiscovered:boolean, luckMessage:string|null, newTitle:string|null,
  createdAt:number
}
type BossSettlementResult = { gold:number, exp:number, titles?:string[], rank:number, tier:string }

// 判别联合：fullResult 按 type 严格绑定，杜绝跨类型错放；仅指定类型携带，其余禁止
type SettlementLedgerEntry =
  | { id:string, at:number, type:'daily', reward:{gold:number}|{exp:number}|{materials:Array<{name:string,count:number}>}, source:string }
  | { id:string, at:number, type:'chest', reward:null, source:string }
  | { id:string, at:number, type:'achievement', reward:{gold?:number, equips?:Array<{templateId:string}>, affixId?:string, reincPoints?:number, title?:string}, source:string }
  | { id:string, at:number, type:'boss_participation', reward:{gold:number,exp:number}, source:string }
  | { id:string, at:number, type:'boss_settle', reward:{gold:number,exp:number,titles?:string[]}, source:string, fullResult:BossSettlementResult }
  | { id:string, at:number, type:'arena_daily'|'arena_weekly'|'arena_monthly', reward:{coins:number}, source:string }
  | { id:string, at:number, type:'pvp_challenge', reward:{gold:number,exp:number,coins:number}, source:string, fullResult:PvpChallengeResult }
  | { id:string, at:number, type:'cock_round', reward:{pointsDelta:number,points:number,title?:string}, source:string, fullResult:CockResolveResult }
  | { id:string, at:number, type:'cock_exchange', reward:{title:string,cost:number,points:number}, source:string }
```

| 奖励域 | 决定性 settlementId | 持久化载体 | 幂等语义 |
|--------|---------------------|------------|----------|
| 日常个体 | `daily:${getTodayKey()}:${questId}` | `player.dailyQuests[].claimed` + ledger | 已 `claimed`→200 已处理 |
| 日常宝箱 | `chest:${getTodayKey()}` | `player.dailyChestClaimed` + ledger `null` | 同上 |
| 成就 | `ach:${achId}` | `player.achievements[achId].claimed` + `grantedTitle` + ledger | 同上；`ach:ascend` 固化 `grantedTitle` |
| 世界Boss 参与奖 | `boss:participation:${getBossDayKey()}:${boss.id}:${username}` | `boss.damageLog` + `player.lastBossAttackDay` + ledger | 同一北京日内二次→409 |
| 世界Boss 排名结算 | 批次 `boss:settle:${spawnDayKey}:${id}` + 子 `boss:settle:${spawnDayKey}:${id}:rank:${rank}` | `boss.settled` + `boss.settlementIds: string[]` 必写 + ledger `boss_settle`（含 `fullResult:BossSettlementResult`） | 顶部守卫 |
| 竞技场日/周/月 | `arena:${period}:${lastPeriodKey}` | `meta.arenaRewards[period][lastPeriodKey]`（空排名仅写全局空占位，不写玩家 ledger） + `meta.arenaSkipped` 独立跳过记录 + 每获奖玩家 ledger | 已存在（含 `arenaRewards` 空占位或 `arenaSkipped` 跳过）→200 已处理 `already:true` |
| 竞技场挑战 | `pvp:challenge:${requestId}` **必传** `requestId`（客户端 `genUid()` 生成，页面 `pendingRequestId` 持有至成功，重试复用；服务端校验 `requestId` 已绑定 `username/target/isBot`，跨主体复用返 409 `requestId 冲突`） | `settlementLedger` 同 `id`（含 `requestContext:{username,targetUsername,isBot}` 与 `fullResult:PvpChallengeResult`） + `pvpRecords`（含 `id` 与 `fullResult`） | **四态判别**：`ledger` 命中且 `fullResult` 完整→200 重放；命中但 `fullResult` 缺失→500 `数据损坏`；`ledger` 未命中但 `pvpRecords` 命中→200 重放；二者皆无→按 `NEW` 走冷却/自挑战校验；超出保留窗口（ledger 100/pvpRecords 200）后新请求视为 `NEW`，旧 `requestId` 视为过期 |
| 灵鸡对局 | `cock:round:${getTodayKey()}:${createdAt}`（`enter` 返回 `createdAt`，重复 `enter` 若 `current` 未过期则返原 `createdAt` 200 不覆盖） | `history[].createdAt`（含 `fullResult:CockResolveResult`，持久化完整 `CockResolveResult`，`report` 为唯一报告字段，无 `lines` 别名） + ledger `cock_round`（同 `fullResult`） | 已含同 `createdAt` 返缓存完整 `CockResolveResult`（优先读 `ledger.fullResult`，其次 `history.fullResult`）；命中但 `fullResult` 缺失→500 `数据损坏`；否则超 `DAILY_LIMIT`→409 |
| 灵鸡兑换 | `cock:exchange:${titleKey}` | `player.titles` + ledger | 已拥有→409 |
| 即时交易 | 无 settlementId | `inventory/equips` 快照 | 失败不落盘 |

- 校验：`assertSettlementReward(type, reward)` 位于 `server/engine/settlement.js` 导出，服务所有奖励域；按上表 required/allowed 精确校验，`cock_exchange` 缺 `cost` 必拒绝；`{affixId,title}` 组合已纳入成就白名单；`PvpChallengeResult.player` 含 `pvpStats` 满足前端 `PvPView.vue:156-163` 读取。
- 时间口径：`getTodayKey()` 本地 0 点；`getBossDayKey(ts)` 北京时间 `ts+8h`切片；竞技场 `getDailyKey/Weekly/Monthly` 与 `getSeasonKey` 分别驱动，均走 `getNow` seam。

### 2.3 称号与时间字段统一（canonical + seam）

- 结构：`player.titles: Record<string,true>`、`player.titleExpiry: Record<string,number>` 默认 `{}`、`player.currentTitle: string|null`。
- 创建：`createCharacter` 默认 `titles:{}, titleExpiry:{}, currentTitle:null, settlementLedger:[]`。
- 迁移：`migratePlayer` ① 数组→对象迁移 ② `titleExpiry` 非对象或数组→`{}` ③ 过滤非法 key ④ 过滤非法 expiry 值 `!Number.isFinite||<=0` 删除 ⑤ `currentTitle` 非法或过期→`null`。
- 来源 canonical：`ALL_TITLES = { JOB_TITLES(20), WORLD_BOSS_TITLES(3), ARENA_SHOP_TITLES(2), COCKFIGHT_DISPLAY_TITLES(6), ACHIEVEMENT_TITLES(11) }`，`isValidTitleKey` 覆盖。
- 时间 seam：所有过期判定走 `getNow()`，替换 `Date.now()`→`getNow()`。
- 读取：`GET /api/player/:u/titles` 先 `migratePlayer` 再清理过期 `titleExpiry[k]<=getNow()`，若 `currentTitle` 过期则 `null`，事务保存。
- 佩戴/卸下：`POST /api/player/:u/titles/equip {key}` 校验五类来源：职业已解锁 / 限时未过期 / 永久已拥有 / 斗鸡已拥有 / **成就已领取且 `grantedTitle===key`**，`key===null` 卸下 200 成功；`key` 不存在 404 / 未解锁或已过期 409。
- 前端：`WorldBossView.vue:164` 移除客户端 UTC 判定，改为仅用服务端 `challengedToday`。

### 2.4 保存与重放安全 + 竞技场周期语义

- **统一全状态事务（可调用 API）**：
  ```ts
  type TransactionResult<T=unknown> = { status:number, data?:T, message?:string }
  snapshot(): string; restore(s:string): void
  withTransaction<T>(fn:(data)=>TransactionResult<T>): TransactionResult<T>
    // snapshot → try{ret=fn(data)}catch(e){restore; cancelSaveTimer(); return {status:500,message:e.message}}
    // 若 ret.status 2xx: try{ save() }catch(e){ lastSaveError={at:getNow(),message,path}; restore; cancelSaveTimer(); return {status:500,message:'保存失败请重试'} }
    // 若 save 成功: clearLastSaveError(); cancelSaveTimer(); return ret
    // 若 ret.status 非 2xx: restore; cancelSaveTimer(); return ret
  getLastSaveError(): {at:number,message:string,path:string}|null
  cancelSaveTimer(): void
  safeSave(): void // try{ save() }catch(e){ lastSaveError=... } finally{ saveTimer=null } 供所有非事务路径
  ```
  - `save()` 同步本体 `catch` 设 `lastSaveError` 并 `throw` 供 `withTransaction` 捕获；`markDirty` 与 `5s`/`30s` 非事务定时器 **均调用 `safeSave()`** 且 `finally{ saveTimer=null }`；`settleDuePeriods`/启动补偿 **按周期各自包裹 `withTransaction`**（见下），失败不推进游标，不经过 `safeSave` 吞错。
  - 本期 `store.save` 全局迁移：`server/routes/combat.js:124,135` 售卖、`server/routes/strategy.js:25` 策略切换、`server/routes/genesis.js:29,43` 创世、`server/routes/pvp.js:250` 竞技商店、`server/engine/daily.js:253` 周重置、`server/engine/idle.js` 挂机等**所有直接 `store.save()` 调用**改为 `safeSave()`（非结算路径）或 `withTransaction`（结算路径）；实现后 `rg "store.save(" server --glob '*.js'` 仅剩 `server/store.js` 内部。
- **GET 触发结算必事务**：`GET /api/worldboss/active`（含无 Boss 时的初始 `spawn` 改 meta）、`GET /cockfight`、`GET /titles`、`GET /arena/season` 均走 `withTransaction` 失败返 500。
- **WorldBoss settled 时序**：`if(boss.settled) return {already:true}` 守卫；`attackWorldBoss` 先置 `dead/finalHitBy/killedAt` 再调 `settleWorldBossRewards`，`settled` 由 `settle` 内部末尾置 `boss.settlementIds=[batchId,...childIds]` 必写。
- **竞技场上一周期全语义（状态机归一）**：
  - 游标 `meta.arenaCursors:{daily,weekly,monthly}` 存**最后已结算周期**，持久化；`meta.arenaSkipped:{daily:{[k]:{at,source}}, weekly:{}, monthly:{}}` 独立记录跳过。
  - 引擎签名 `settleArenaRewards(store,period,rankingList,periodKey)`（`periodKey` **必传**无回退），`settleDuePeriods(store)` 读写 `meta.arenaCursors`/`meta.arenaSkipped`。
  - 定时器：`nextKey = nextPeriodKey(arenaCursors[period])` 且 `nextKey < curKey` 时在 `withTransaction` 内结算 `nextKey`；成功后 `arenaCursors[period]=nextKey` 并提交；失败不推进。
  - 启动：若 `meta.arenaCursors` 缺失则初始化为**两周期前已结算周期**（`getDailyKey(getNow()-2*86400000)` / `getWeeklyKey(getNow()-2*604800000)` / 上上月 `getMonthlyKey`，使 `nextKey=昨天/上周/上月 < curKey` 能补昨天）；随后循环 `while(nextKey < curKey)` 在 `withTransaction` 内依次补结算（每日最多 7 次、每周 4 次、每月 2 次）；若 gap 超 7/4/2 则对超界区间**写空占位并视为已处理**：为每个被跳过的 `periodKey` 在 `withTransaction` 内写 `arenaRewards[period][periodKey]={}` + `arenaSkipped[period][periodKey]={at:getNow(),source:'skip:gap'}`（`arenaRewards` 无 `source` 字段，跳过信息仅存 `arenaSkipped`），不写玩家 `settlementLedger`，推进 `arenaCursors`，失败不推进；`arenaSkipped` 同 `arenaRewards` 分开检查 `already:true`（见 `settleArenaRewards` 先查 `arenaSkipped` 再查 `arenaRewards`）。
  - 手工接口：`POST /api/arena/settle` 为 **admin/test-only**，需 `x-admin-token` 头匹配 `process.env.ADMIN_TOKEN` 或 `isTestMode()`，否则 403；请求体 `{period, periodKey?, username?}`，`periodKey` 若传必须为**已结束周期**（`periodKey < curKey`，weekly 需周一、monthly 需 `YYYY-MM`），否则 400；若不传则结算 `nextKey`；成功后仅当 `periodKey===nextKey` 才推进 `arenaCursors`，否则不推进但返回已处理判定；幂等 `already:true` 保证安全。
  - `GET /api/arena/rewards/:period?periodKey=&username=` 支持查询任意历史 `periodKey`，超出 `arenaRewards` 保留上限 30/12/12 时：若 `periodKey` 在保留窗口外且 `arenaRewards` 已删，先查 `settlementLedger`/`arenaSkipped` 仍可判定 `settled/skipped`，否则返回 404 `超出保留窗口`。

### 2.5 范围与 N/A 标记（对齐 `ai开发任务需求:138-140`）

| 需求项 | 原文 | 本期状态 |
|--------|------|----------|
| 远征/公会状态“修改→刷新→重启→再读取”覆盖 | `ai开发任务需求:138` 含 **公会状态和远征状态** | **N/A**（本期不开放），F03/F04 再补 |
| 唯一结算编号（含登录、PvP赛季、世界Boss、公会赛季、远征） | `ai开发任务需求:140` | **登录不产生本期 settlement**（登录虽调 `calculateIdle` 但属挂机路径本期不审计）；`tutorialStep` 与 `currentSeason` 为游标；PvP赛季重置为 `rating/streak/lastPvpAt/arenaCoins` 无发奖，`arenaRewards` 覆盖日/周/月；公会/远征前缀占位 F03-F05 |
| 移动端 5 断点回归 | `ai开发任务需求:156-158` | **本期执行**，仅回归现有12页（见§2.6） |

### 2.6 移动端与回退基线（P4 的首版子集）

- 本期仅回归现有关键页：登录/角色/技能/背包/地图/图鉴/进化/排行/任务/PvP/Boss/创世之书。
- 断点：320/360/375/390/414，检查长角色名/长称号/大数字/战报/倒计时/输入框/弹窗按钮不溢出不遮挡；`client/src/App.vue:143-163` `visualViewport` 垫高 + `TabBar.vue` 保持有效；不引入新 Tab/二级页。
- 证据：手工 5 断点各截 1 张关键页（角色+地图+Boss）共 15 张存 `docs/specs/T-101-mobile-evidence/`。

## 3. 涉及文件（严格限定）

| 文件 | 行 | 改动 |
|------|----|------|
| `package.json` | 11 | `test` 改为 `node --test server/**/*.test.js server/*.test.js` |
| `server/store.js` | 48-135 | 原子写+`.bak`；新增 `snapshot/restore/withTransaction/safeSave/getLastSaveError/cancelSaveTimer`；`finally` 清 timer，根对象 `null`/逻辑损坏双回退，`arenaRewards` 保留上限 30/12/12 由 store 清理 |
| `server/engine/state.js` | 1-35 | `getNow/__setNow/genUid/isTestMode` seam |
| `server/engine/settlement.js`（新增） | — | 导出 `assertSettlementReward` + `BossSettlementResult` 类型与校验，服务所有奖励域 |
| `server/engine/daily.js` | 10-210,253 | `claimDaily/claimChest/claimAchievement` 写 ledger（经 `settlement.js` 校验） + `getNow`；`maybeResetWeeklyBossKills` 移除内部 `store.save`，仅置内存标志，由外层 `withTransaction`/`safeSave` 提交 |
| `server/engine/player.js` | 22-185 | `createCharacter` 补 `titleExpiry/settlementLedger` 默认；`migratePlayer` 过滤非法 key/非法 expiry 值 |
| `server/engine/worldboss.js` | 14-320 | `getBossDayKey/getTodayMidnight` 走 `getNow`；`ensureBossFresh/settleWorldBossRewards` 正确时序+守卫+ `settlementIds` 必写 |
| `server/engine/pvp.js` | 419-485 | `settleArenaRewards(store,period,ranking,periodKey)` 必传 key + 空占位 + 每玩家 ledger；`settleDuePeriods` 读写 `meta.arenaCursors`/`meta.arenaSkipped` |
| `server/engine/cockfight.js` | 12-70 | `enter` 存 `createdAt` 并返回，重入返原 `createdAt`；`resolve` 接收 `createdAt` 先查重放（`fullResult:CockResolveResult`）；仅返回 `report` |
| `server/engine/genesis.js` | 177-337 | `Date.now()`→`getNow()` |
| `server/engine/view.js` | 18-129 | `getPlayerView` 必返 `titles/titleExpiry/currentTitle/questView/settlementLedger` |
| `server/engine/index.js` | 60-90 | 导出 `withTransaction`/`safeSave`/`settleDuePeriods`/`assertSettlementReward` |
| `server/data/titles.js` | 1-140 | 新增 `ACHIEVEMENT_TITLES(11)` 并入 `ALL_TITLES` |
| `server/data/equipment.js` | 123 | `Date.now()`→`getNow()` |
| `server/routes/_helpers.js` | 1-22 | `fail(res,msg,status)` 默认改为 400（原 200），调用方必须显式传 400/404/409/500/403 |
| `server/routes/auth.js` | 24 | 登录 `calculateIdle` 属挂机路径，本期不审计 |
| `server/routes/player.js` | 14-24 | `GET /player` 走 `withTransaction`，响应 `data:{player,offlineSummary}` 兼容 |
| `server/routes/quest.js` | 1-44 | `res.status(result.status)` 透传 |
| `server/routes/titles.js` | 1-61 | 先 `migratePlayer` 再清过期并矫正 `currentTitle`；`equip` 支持 `key===null` 卸下 200 |
| `server/routes/pvp.js` | 13-360 | **先查 `ledger/pvpRecords` 同 `requestId` 重放**（绑定 `username/target/isBot`）再判冷却/自挑战(409)；`POST /arena/settle` 需 `x-admin-token` 403；`GET /rewards`/`GET /season` 事务化 |
| `server/routes/worldboss.js` | 1-70 | `attack` 统一 `{success,data}` 兼容；`GET/active` 初始 spawn 也走事务 500 |
| `server/routes/cockfight.js` | 1-60 | `enter` 返回 `createdAt` 重入返原；`resolve` 接收 `createdAt` 重放；`GET` 跨日事务保存 |
| `server/routes/combat.js` | 124-135 | 售卖等直接 `store.save` 改 `safeSave()`，不纳入唯一入口 |
| `server/routes/strategy.js` | 25 | 策略切换 `fail` 默认 400 并 `store.save` 改 `safeSave()` |
| `server/routes/genesis.js` | 29,43 | 创世创建/删除改 `safeSave()` |
| `server/index.js` | 33-95 | 5s/30s/`settleDuePeriods`/启动补偿均调 `safeSave`，游标由 `meta.arenaCursors` 持有 |
| `server/engine/worldboss.test.js` | 497 | 移除 `settled=true` 预置 |
| `client/src/api.js` | 173,195,220 | `enterCockArena` 解析 `createdAt`；`resolveCockRound(username,bet,intervention,createdAt)`；`challenge(username,target,isBot,requestId)` 必传 `requestId`（`genUid()` 持有至成功，重试复用） |
| `client/src/components/CockfightArena.vue` | — | 接收并透传 `createdAt`/`requestId`（`enter`→`resolve` 持有 `pendingRequestId`） |
| `client/src/components/pvp/PvPView.vue` | — | `challenge` 持有 `pendingRequestId` 直至成功，网络失败重试复用同一 ID |
| `client/src/components/WorldBossView.vue` | 164,195 | 移除客户端 UTC，`attack` 读 `res.data` |
| `client/src/components/TitleModal.vue` | 112 | `equip(null)` 卸下 200 |
| `client/src/App.vue` | 225,301 | 解包 `data:{player,offlineSummary}` 兼容旧 `res.data` 当玩家对象与 `res.offlineSummary` |
| `docs/README/06-changelog.md` | — | 追加 v1.04 P0 条目 |
| `docs/specs/T-101-p0-stability-spec.md` | — | **本文件 v10** |
| `server/store.test.js`（新增） | — | 原子写/损坏回退（含 `null` 根对象与双损坏）/节流/`lastSaveError`/`finally` 清 timer + 非 2xx 回滚 + `arenaRewards` 保留上限 |
| `server/engine/settlement.test.js`（新增） | — | 幂等/强类型/宝箱 null/跨日/北京日/空占位/`pvp_challenge`/`cock createdAt`/重复 `enter`/绑定校验/`cost`/`CockResolveResult`/`PvpChallengeResult`/`BossSettlementResult` 无 any |
| `server/routes-settlement.test.js`（新增） | — | HTTP 矩阵 400/404/409/200 已处理/200 成功/500（含 `arena/settle` 鉴权 `x-admin-token`） |
| `server/timer-settlement.test.js`（新增） | — | `settleDuePeriods` 上一周期、空占位、失败不推进、启动多周期补结算（7/4/2，超界写空占位跳过至 `arenaSkipped`） |
| `server/restart-consistency.test.js`（新增） | — | `__setDbPath` 隔离真重启一致性 |
| `server/schema.test.js`（新增） | — | 根对象 schema 校验、双损坏重置 |

> 约束：遵循 `docs/README/00-code-style.md:9-17` — 300-500 理想，500-800 考虑拆分视内聚，>800 必须拆分。本期仅约束**新增/改动文件**保持 ≤500（`store.js≤135` 等）；历史例外 `client/src/components/GenesisView.vue:1190` 已超 800 列为历史遗留，下阶段拆分；`server/engine/pvp.js:557` 与 `client/src/App.vue:574` 本期虽改动但处 500-800 区间属“考虑拆分”不强制；`server/engine/player.js:646` 同属 500-800“考虑拆分”区间。

## 4. 数据与落点

```js
// player 扩展（migratePlayer 默认，全部可 JSON 持久化）
dailyQuests: [{id, progress, target, done, claimed}]
dailyResetAt: 'YYYY-MM-DD'
dailyChestClaimed: boolean
achievements: { [id]: {unlocked, claimed, unlockAt, grantedTitle?} }
questStats: { totalGoldEarned:number, affixSeen:string[], seenEquipTemplates:string[] }
titles: Record<string,true>
titleExpiry: Record<string,number>
currentTitle: string|null
reincPoints: number
tutorialStep: number
pvpStats: { wins,losses,draws,rating,streak,bestStreak,lastPvpAt }
cockfight: { points,wins,streak,played,loseStreak,dayKey,usedToday,banNext,current:{lineup:string[],createdAt:number}|null,history:Array<{createdAt:number,bet:number,champion:string,win:boolean,pointsDelta:number,played:number,fullResult:CockResolveResult}> }
lastBossAttackDay: 'YYYY-MM-DD'
lastBossAttackAt: number
reincarnHintShown: boolean
attrPresets: Array<{id,name,attributes,level,slot,createdAt}|null>
settlementLedger: Array<SettlementLedgerEntry> // ≤100

// meta
meta: {
  worldBoss: { id,name,hp,maxHp,atk,def,agi,spawnDayKey,expiresAt,damageLog,settled,expired,finalHitBy, settlementIds:string[] } | null
  arenaCursors: { daily:string, weekly:string, monthly:string }
  arenaSkipped: { daily:{[k]:{at:number,source:string}}, weekly:{}, monthly:{} }
  arenaRewards: { daily:{[periodKey]:{[user]:{tier,rank,coins}}}, weekly:{}, monthly:{} } // 各保留 30/12/12
  currentSeason: 'YYYY-S1..4', lastResetFrom, lastResetAt
  pvpRecords: Array<{id:string,time:number,attacker:string,defender:string,result:string,ratingChange:number,rewards:{gold:number,exp:number,coins:number},isBot:boolean,fullResult:PvpChallengeResult}>
  bossWeek: 'YYYY-MM-DD'
  genesis: { monsters:[], equips:[], chaos:[] }
  arenaBots: { [username]: {time,bots[]} }
}
```

- 日切：先 `refreshDailyIfNeeded` 再改状态；过期未领不补发。
- 发奖：本期结算路径（`claim*/settle*/pvp_challenge/cock_*/attackWorldBoss`）经 `withTransaction` 事务落盘；`idle.js` 挂机与 `items.js` 交易属挂机/交易路径，本期不纳入唯一入口约束。
- 存档校验：`store.load` 解析后若根非普通对象或 `accounts/players/meta` 非对象/数组/为 `null` 则视为逻辑损坏，走 `.bak` 回退；主备均损坏则重置为空并日志；`arenaRewards` 超 30/12/12 删最旧。
- 可追溯：`logs` 30/20 条、`pvpRecords` 200、`settlementLedger` 100 均截断。

## 5. 交互时序与 API 契约

```
// 轮询（5s）— data 统一包裹，兼容旧前端
GET /api/player/:username
  -> withTransaction: loadPlayer -> maybeResetWeeklyBossKills -> calculateIdle -> getOfflineSummary -> updateOfflineSnapshot
  <- { success:true, data: { player: getPlayerView(player), offlineSummary }, player, offlineSummary } // 兼容1版

// 领取（幂等，status 透传，事务）
POST /api/player/:username/quest/daily/:id/claim -> 400缺参 / 404未知/角色不存在 / 409未达成 / 200已处理 already:true / 200成功
POST /api/player/:username/quest/chest/claim     -> 400缺参 / 409需5项 / 200已处理 already:true / 200成功
POST /api/player/:username/quest/achievement/:id/claim -> 400缺参 / 404未知/角色不存在 / 409未达成 / 200已处理 already:true / 200成功
POST /api/player/:username/worldboss/attack { }  -> 400缺参 / 404角色不存在或无Boss / 409今日已挑战 / 200成功 / 500保存失败
POST /api/arena/challenge {username,targetUsername,isBot,requestId} -> 400缺参(含 requestId) / 404角色不存在/对手不存在 / 409自挑战/冷却或等级差或已刷新 / 200已处理 already:true(同 requestId) / 200成功 / 500保存失败
POST /api/arena/settle {period, periodKey?} + header x-admin-token -> 403鉴权失败 / 400缺参/无效周期或未结束周期 / 200已处理 already:true / 200成功 / 500保存失败
GET  /api/arena/rewards/:period?periodKey=&username= -> 400无效周期或超出保留窗口 / 200含 settled 判定（支持任意历史 periodKey）
GET  /api/arena/season?username=                  -> 200含赛季游标，重置写入走事务 500 失败
POST /api/player/:username/titles/equip {key}    -> key===null 卸下 200；否则 400缺参 / 404不存在/角色不存在 / 409未解锁或已过期 / 200成功 / 500保存失败
POST /api/player/:username/cockfight/enter       -> 404角色不存在 / 409次数用完 / 200返回 {chickens, createdAt}（重复 enter 返原 createdAt 200）
POST /api/player/:username/cockfight/resolve {bet,intervention,createdAt} -> 400缺参 / 404角色不存在 / 409未进场或参数非法或次数用完 / 200已处理 already:true(同 createdAt) / 200成功 / 500保存失败
POST /api/player/:username/cockfight/exchange    -> 400缺参 / 404不存在/角色不存在 / 409已拥有或积分不足 / 200成功 / 500保存失败
POST /api/player/:username/avatar {avatar}       -> 400缺参 / 404角色不存在 / 200成功

// 查询（可能触发写后保存，事务）
GET /api/player/:username/titles -> 先 migrate 再清过期并矫正 currentTitle，事务保存
GET /api/worldboss/active?username= -> ensureBossFresh 若结算(含初始 spawn)则事务保存失败 500
GET /api/player/:username/cockfight -> ensureState 跨日重置则事务保存；失败 500
GET /api/player/:username -> 同上，含 calculateIdle 事务

// 未匹配 /api -> 404 {success:false, message}
```

**HTTP 状态矩阵（本期强制，所有分支显式 400/404/409/500，409 不带 already）**

| 接口 | 400 | 404 | 409 | 200已处理 `already:true` | 200成功 | 500 |
|------|-----|-----|-----|--------------------------|---------|-----|
| `POST /quest/daily/:id/claim` | 缺参 | 未知id/角色不存在 | 未达成 | 已领取 | 发放 | 保存失败 |
| `POST /quest/chest/claim` | 缺参 | 角色不存在 | 需5项 | 已领取 | 标记 | 保存失败 |
| `POST /quest/achievement/:id/claim` | 缺参 | 未知id/角色不存在 | 未达成 | 已领取 | 发放 | 保存失败 |
| `POST /worldboss/attack` | 缺参 | 角色不存在/无Boss | 今日已挑战 | — | 战斗+奖励 | 保存失败 |
| `POST /arena/challenge` | 缺参(含 requestId) | 角色不存在/对手不存在 | 自挑战/冷却/等级差/已刷新 | 同 requestId 重试 | 战斗+ledger | 保存失败 |
| `POST /arena/settle` | 无效周期或未结束周期 | — | — | 已结算 | 结算 | 保存失败 |
| `GET /arena/rewards/:period` | 无效周期或超出保留窗口 | — | — | — | 含 settled | — |
| `GET /arena/season` | — | — | — | — | 含游标 | 游标重置保存失败 |
| `POST /titles/equip` | 缺参 | 不存在/角色不存在 | 未解锁/已过期 | — | 佩戴/卸下 | 保存失败 |
| `POST /cockfight/enter` | — | 角色不存在 | 次数用完 | 重复 enter 返原 | 成功 | 保存失败 |
| `POST /cockfight/resolve` | 缺参 | 角色不存在 | 未进场/参数非法/次数用完 | 同 createdAt 重试 | 成功 | 保存失败 |
| `POST /cockfight/exchange` | 缺参 | 不存在/角色不存在 | 已拥有/积分不足 | — | 成功 | 保存失败 |
| `GET /worldboss/active` | — | — | — | — | 含结算后(含初始 spawn) | 结算保存失败 |
| `GET /titles` | — | 角色不存在 | — | — | 含清理后 | 保存失败 |
| `GET /player` | — | 角色不存在 | — | — | 含 player | 保存失败 |
| `GET /player/:u/cockfight` | — | 角色不存在 | — | — | 含状态 | 保存失败 |

- 响应统一 `{ success: boolean, data?, message? }`；`GET /player` 本期 `data:{player,offlineSummary}` 同时保留顶层 `player/offlineSummary` 1 版兼容，前端 `App.vue:225,301` 优先读 `res.data.player || res.data`。
- `already:true` 仅 200 幂等已处理，409 仅业务拒绝不带 `already`；`_helpers.fail` 移除默认 200，调用方必须显式传 400/404/409/500/403。
- 唯一发奖路径本期为 `claim*/settle*/attackWorldBoss/pvp_challenge/cock_*`。

## 6. 验收标准

- [ ] 存档：原子写不截断；主档损坏回 `.bak`；**逻辑损坏**（根非普通对象/`null`/`players` 非对象/数组）双损坏重置空数据；`arenaRewards` 30/12/12 保留上限；`save()` 失败清 `.tmp` 且 `lastSaveError` 可读成功清零；**全状态事务**快照→变更→同步保存→失败完整回滚并 `finally` 清 `saveTimer`；404/409 非 2xx 回滚；异常转 500；`markDirty`/`5s`/`30s`/`safeSave` 均 `finally` 可重调度
- [ ] 轮询与重启一致：改头像/称号/装备/背包/属性点/PvP/Boss 后等待≥5s→刷新→`kill -9`→重启→再 `GET` 一致；`fs.writeFileSync` 抛错分支回滚
- [ ] 幂等与强类型审计：`assertSettlementReward`（`server/engine/settlement.js`）拒绝 `{}`/错组合/负数/空数组/`cost` 缺失；宝箱 `null` 仅 chest；`pvp_challenge` 保留 gold/exp/coins 并写判别联合 `fullResult`（含 `player.pvpStats`）完整结果；`cock:round` 用 `createdAt` 重试幂等，重复 `enter` 返原；`requestId` 持有至成功重试同 ID 且绑定 `username/target/isBot`（跨主体 409）；跨日过期作废；WorldBoss 同北京日内 409 不带 `already` 仅 200 重放带 `already:true`；竞技场同 `lastPeriodKey` 二次 200 `already:true` 含空占位；`ledger≤100`；`arenaRewards` 超界写 `arenaSkipped` 空占位跳过
- [ ] 时间口径：`getTodayKey` 与 `getBossDayKey` 各 2 用例覆盖北京 0 点前后 1 分钟与 UTC 边界；`remainingMs/challengedToday` 同源（含初始 spawn 事务）
- [ ] 称号：数组→对象迁移不丢；`titleExpiry` 数组视为非法→`{}` 并过滤非法值；过期清 `titles` 并同步 `currentTitle=null`；`migratePlayer` 过滤非法 key；`GET /titles` 先迁移；成就 `grantedTitle===key` 校验 11 键；`key===null` 卸下 200；`currentTitle` 必返；`getNow` 覆盖
- [ ] 移动端：320/360/375/390/414 下 12 页无溢出、TabBar 不遮挡、弹窗可点；PR 附 15 张截图
- [ ] 构建与检查：`npm run build` 通过；`git diff --check` 0（`git add -N ... && git diff --check; git reset`，`git diff --no-index` 返回 1 属正常应检查无输出）；`npm test` 全量通过（`package.json:11` 已改 `node --test server/**/*.test.js server/*.test.js`）
- [ ] 新增测试矩阵：
  - `server/store.test.js`：原子写/损坏回退（含 `null` 根对象与双损坏）/节流/`lastSaveError`/`finally` 清 timer + 非 2xx 回滚 + `arenaRewards` 保留上限
  - `server/engine/settlement.test.js`：幂等/强类型/宝箱 null/跨日/北京日/空占位/`pvp_challenge`/`cock createdAt`/重复 `enter`/绑定校验/`cost`/`CockResolveResult`/`PvpChallengeResult`/`BossSettlementResult` 无 any
  - `server/routes-settlement.test.js`：HTTP 矩阵 400/404/409/200 已处理/200 成功/500/403（含 `arena/settle` 鉴权）
  - `server/timer-settlement.test.js`：`settleDuePeriods` 上一周期、空占位、失败不推进、启动多周期补结算（7/4/2，超界写 `arenaSkipped` 跳过）
  - `server/restart-consistency.test.js`：`__setDbPath` 隔离真重启一致性
  - `server/schema.test.js`：根对象 schema 校验、双损坏重置
  - 手工：5断点12页 + 故障注入各 1 轮
- [ ] 文档：`docs/README/06-changelog.md` 追加 v1.04 P0 条目

## 7. 风险与回退

- 风险：北京日 vs 本地日 — 以 `getBossDayKey` 与 `getTodayKey` 各自口径为准，前端仅展示，`__setNow` 覆盖边界。
- 风险：`db.json` 膨胀 — `logs`30/20、`pvpRecords`200、`settlementLedger`100、`arenaBots` 按需、`arenaRewards` 30/12/12。
- 风险：保存失败 — 事务回滚并返 500，前端重试因幂等键命中返回 200 已处理，不二次发奖；异步 `safeSave` 失败仅记录 `lastSaveError` 不击穿进程（`finally` 清 timer 可重调度）。
- 回退：本期整次实现提交回滚方式为 `git revert <commit>`（含生产代码 `store/engine/routes/data/client/package.json`、迁移数据 `titleExpiry/settlementLedger/arenaCursors/arenaSkipped` 与新增 6 测试、`06-changelog.md`），老档 `migratePlayer` 自动补默认可前向兼容。
