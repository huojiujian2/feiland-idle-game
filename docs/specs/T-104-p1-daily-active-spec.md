# T-104 每日活跃 — 技术方案 Spec v2（待审核·已闭合 v1 评审 4P0）

> 范围对应 `ai开发任务需求:142-144` 每日活跃 + `ai开发任务需求:146` 远征报告复用展示语言。基于 `T-102` 已落地的 `expedition1` 每日任务与 `T-101` 结算底座，工程从简。v2 闭合 v1 的 4 个 P0 合约缺口与 5 项 P1 建议。

## 1. 背景与目标

- 现状：已有 7 项每日任务（`hunt50/battle20/alloc1/affix1/enchant1/buy1/expedition1`）各自领取，但无汇总活跃层，玩家完成低/高投入无阶梯反馈。
- 目标：在已有任务上加 **每日活跃**，累计 `领取挂机收益/完成任务/挑战PvP/攻击Boss/完成远征` 等行为，设 3 档阶段奖励，低/高活跃均有反馈，沿用 `withTransaction/getNow/settlementLedger`。

## 2. 范围

**做：**
- 活跃来源 5 类（均服务端计数，避免前端刷）：
  - `idle_claim` 领取挂机/离线收益（每次 `calculateIdle` 有收益时 +5，**批量离线结算按 1 次 +5**，不按战斗场数；登录时的离线结算与 5 秒定时沿用既有 `safeSave` 路径，不强制改事务，见 §5.2）
  - `daily_claim` 领取任意每日任务/宝箱（每次领取 +10，仅首次成功加分，重放不加分）
  - `pvp` 完成 1 次竞技场挑战（`server/routes/pvp.js:109-288` 首次成功结算前 +15，`already:true` 重放不加分，胜/负/平均算 1 次）
  - `boss` 攻击世界Boss 1 次（`server/routes/worldboss.js:attack` 首次成功 +15，重放不加）
  - `expedition` 完成 1 次远征结算（`server/engine/expedition.js:claimExpedition` 首次成功 +20，重放不加）
- 3 档阈值 `20 / 50 / 100`，各自独立领取，次日 0 点重置，`points` 封顶 100，`progressPct = min(100, floor(points/100*100))`
- 奖励以软性为主：`20→100金币 / 50→200经验+草药×2 / 100→3 次独立随机材料（合并同名）`（复用 `INITIAL_MATERIAL_POOL`，抽取结果写入 `ledger`，重放不变）
- 事务与幂等：`settlementId=daily_active:${today}:${tier}`，`ledger` 重放 `already:true`

**不做：**
- 公会贡献计入活跃（F03 再接入）、活跃商店、周活跃

## 3. 静态配置 `server/data/active.js`（新增）

```js
DAILY_ACTIVE_TIERS = [
  { tier:1, need:20,  reward:{ gold:100 } },
  { tier:2, need:50,  reward:{ exp:200, materials:[{name:'草药',count:2}] } },
  { tier:3, need:100, reward:{ materials: null /* 占位，首次领取时 3 次独立抽取生成 */ } },
];
DAILY_ACTIVE_SOURCES = {
  idle_claim:5, daily_claim:10, pvp:15, boss:15, expedition:20,
};
```

- `tier3` 奖励不在配置写死材料名，首次领取时 `3 次独立抽取 INITIAL_MATERIAL_POOL` 并合并同名（如 `草药×2 + 兽皮×1`），生成的 `materials` 写入 `ledger.reward` 与 `fullResult`，后续重放返回同一 `materials`，不重新随机。

## 4. 数据模型

```js
// player 扩展（migratePlayer 默认）
dailyActive: { points:number, claimed:Array<number>, lastResetAt:string, rewards:Record<tier,reward> } // claimed 1/2/3 去重，rewards 持久化 tier3 随机材料（ledger 100 条淘汰后仍可重放）
dailyQuests/dailyResetAt/dailyChestClaimed 复用既有日切
settlementLedger: 追加 { id:`daily_active:${today}:${tier}`, at, type:'daily_active', reward:{gold?,exp?,materials?}, source:'daily_active', fullResult:{tier,need,points,reward} }
// view 透出
// getPlayerView 追加 questView.dailyActive:{points, claimed, tiers:[{tier,need,reward,canClaim,claimed}], progressPct}
// 已领取 tier3 的 rewards 快照写入 dailyActive.rewards[tier]，旧存档首次展示时从 ledger 回填
```

- `migratePlayer`：缺字段补 `{points:0,claimed:[],lastResetAt:getTodayKey(),rewards:{}}`，`points` 非有限数或 <0 置 0 且封顶 100；`claimed` 过滤非 1/2/3、去重、排序；`lastResetAt` 非字符串仅规范化不清空进度；`rewards` 非对象置 `{}`；旧存档已领取 tier3 若 `rewards[3]` 缺失则下次 `getDailyActiveView` 从 `ledger` 回填
- `getPlayerView` 新增 `questView.dailyActive` 与顶层 `dailyActive`（同视图，避免前端破坏性变更，见 §6）

## 5. 后端设计

### 5.1 模块 `server/engine/active.js`（新增，≤160行，含 5 导出）

- `getDailyActiveView(player)` — 计算 `tiers` 视图（含 `canClaim=points>=need && !claimed.includes(tier)`，`progressPct`）
- `addActivePoints(player, source, inc=1)` — `DAILY_ACTIVE_SOURCES[source]*inc` 累加并封顶 100，`refreshIfNeeded` 先日切（`lastResetAt !== today` 则重置 `points=0,claimed=[]`）
- `claimActive(player, tier)` — 校验 `tier 1-3`、未领取、积分达标；若 `tier===3` 且首次领取则 3 次独立抽取 `INITIAL_MATERIAL_POOL` 生成 `materials`（合并同名），否则沿用配置 `reward`；`assertSettlementReward('daily_active', reward)` 校验其一组合；`grantGold/grantExpWithLevelUp` + 材料 `inventory`；写 `ledger` 幂等；`claimed.push(tier)` 排序去重
- `refreshIfNeeded(player)` — 日切重置，与 `refreshDailyIfNeeded` 同 `getTodayKey()` 口径

### 5.2 埋点与事务边界（闭合 P0-1）

| 位置 | 事务 | 调用 | 备注 |
|------|------|------|------|
| `server/engine/idle.js:calculateIdle` 末尾有 `exp/gold` 收益后 | 沿用既有：5 秒定时 `server/index.js:35-41` 与策略切换 `server/routes/strategy.js:34-61` 走 `safeSave`，**不强制改事务**；登录时的离线结算经 `GET /api/player/:u`（`T-101` 已事务化 `server/routes/player.js:19`）则走 `withTransaction` | `addActivePoints(p,'idle_claim',1)` 仅 1 次/调用（批量离线也 +5，不按场数） | 明确：批量离线一次 +5，避免一次离线刷满 |
| `server/engine/daily.js:claimDaily/claimChest` 成功后（已在 `store.withTransaction` 内） | `withTransaction` | `addActivePoints(p,'daily_claim',1)` 仅首次成功，重放 `already:true` 分支不加分 |  |
| `server/routes/pvp.js:109-288` `POST /arena/challenge` 首次成功、构造 `fullResult` 前 | `withTransaction` | `addActivePoints(p,'pvp',1)` 仅首次成功，重放不加分 | 落点纠正：原 `pvp.js:challenge` 为引擎层，实际落点为路由层 |
| `server/routes/worldboss.js` `POST /worldboss/attack` 首次成功 | `withTransaction` | `addActivePoints(p,'boss',1)` |  |
| `server/engine/expedition.js:claimExpedition` 首次成功、写 `ledger` 前 | `withTransaction` | `addActivePoints(p,'expedition',1)` |  |

- `addActivePoints` 仅累加，不直接发奖；发奖走 `claimActive` 统一校验与 `ledger`
- 跨日与重启由 `migratePlayer`+`getPlayerView` 触发 `refreshIfNeeded` 保障

### 5.3 幂等与事务（闭合 P0-2/P0-4）

- `settlementId=daily_active:${getTodayKey()}:${tier}`，`ledger` 命中 → 200 `already:true` 重放（`fullResult` 含首次抽取的随机材料，不重新随机）
- `claimActive` 走 `store.withTransaction`，`GET /api/player/:u` 读视图若触发日切写回则走事务（失败 500）
- `tier3` 随机材料在首次 `claimActive` 时生成并持久化至 `ledger.reward.materials` 与 `fullResult.reward`，重放直接读 `ledger`

### 5.4 校验与导出（闭合 P0-2/P1 建议）

- `server/engine/settlement.js:23` 新增 `daily_active` 类型精确规则：
  - 允许键 `gold/exp/materials`，至少含其一
  - 组合白名单：`{gold}`（tier1）、`{exp,materials}`（tier2，`materials` 非空）、`{materials}`（tier3，3 次抽取合并后非空）
  - `gold/exp` 非负，`materials` 元素 `{name,count}` 合法
- `server/data/index.js` 追加导出 `DAILY_ACTIVE_TIERS/DAILY_ACTIVE_SOURCES`
- `server/engine/settlement.js` 判别联合追加 `{id,at,type:'daily_active',reward:{gold?,exp?,materials?}, source, fullResult:{tier,need,points,reward}}`

## 6. API 契约（闭合 P0-3 前端破坏性变更）

`server/routes/active.js` → `registerActiveRoutes(app,store)` 在 `server/routes/index.js` 注册

| 方法 | 路径 | 成功（统一返回完整 `getPlayerView`） | 失败 |
|------|------|--------------------------------------|------|
| POST | `/api/player/:u/daily-active/claim` | 200 `{success:true, data: getPlayerView(player), reward:{gold?,exp?,materials?}, dailyActive: questView.dailyActive }` / 200 `{success:true, data: getPlayerView(player), already:true, dailyActive}` | 400 缺参/非法 tier / 404 角色不存在 / 409 积分不足 / 500 保存失败 |

- `POST body {tier:1|2|3}`，`tier` 必填 400
- 统一 `{success,data?,message?,already?,reward?,dailyActive?}`，其中 `data` 恒为完整 `getPlayerView(player)`（保持 `QuestView.vue:120` `res.data` 与 `App.vue:48` `player=$event` 的现有契约），`dailyActive` 同时写入 `questView.dailyActive` 供轮询
- **轮询来源唯一：** 前端继续以 `GET /api/player/:u` 为唯一轮询，不新增 `GET /daily-active` 独立轮询（删除 v1 的二选一表述，避免双轮询漂移）

## 7. 前端

- `client/src/api.js` 新增 `claimDailyActive(username,tier)`（`getDailyActive` 不新增，复用 `getPlayer`）
- `QuestView.vue:120` 领取后 `const p = res.data; if(p) emit('refresh', p)` 保持不变，顶部插入 **每日活跃** 卡片（进度条 `points/100`、3 档奖励格、领取按钮，`canClaim` 高亮），读取 `player.questView.dailyActive` 或 `player.dailyActive`，复用 `dailyQuests` 卡片样式，无新 Tab；`claimDailyActive` 成功后 `toast` 显示 `reward` 摘要
- `App.vue` 无新增 Tab，无新增轮询

## 8. 验收（精简）

- [ ] 5 来源各 +5/+10/+15/+15/+20 累加至 `dailyActive.points`（封顶 100，`progressPct` 取整），批量离线仅 +5，次日 0 点重置，`already:true` 重放不二次加分
- [ ] 3 档 `20/50/100` 各自独立领取，未达标 409，已领取二次 200 `already:true` 不重发，`ledger` 最终奖励非负，`tier3` 3 次随机材料合并且重放不变
- [ ] 领取接口返回完整 `getPlayerView`，`QuestView.vue:120` 与 `App.vue:48` 不破坏，`GET /player` 为唯一轮询
- [ ] `server/routes/pvp.js:109` 落点正确，PvP 输/赢/平局均计 1 次挑战
- [ ] 跨日与重启持久化：活跃积分与领取状态落盘不丢，`claimed` 仅 1/2/3 去重
- [ ] `npm run build` 通过；单测从简但覆盖：5 来源真实调用链、幂等重放不加分、tier3 随机重放不变、跨日/重启持久化、领取返回完整 view
