# 版本历史

> 📖 主入口：[../README.md](../README.md)

## v1.04 · 2026-08-30

### 🛡 P0 稳定性底座（事务 · 结算 · 缝合加固）

#### 存档与事务
- **全状态事务**：`server/store.js` 新增 `snapshot / restore / withTransaction / safeSave / getLastSaveError / cancelSaveTimer`，`snapshot → fn → save → 成功清错/清 timer / 失败回滚`，非 2xx 回滚并 `cancelSaveTimer`，异常转 500；`save()` 本体捕获 `lastSaveError` 并 throw 供事务感知，`markDirty` 与 5s/30s 定时器均调 `safeSave` 且 `finally { saveTimer=null }` 可重调度
- **原子写与回退**：原子写 `db.json.tmp → rename`，双保险 `.bak`，主备均损坏重置为空；`arenaRewards` 按 30/12/12 保留上限由 store 层清理；`GET /player`、`GET /worldboss/active`、`GET /cockfight`、`GET /titles`、`GET /arena/season` 均走事务，失败返 500
- **调用面收敛**：`server/routes/combat.js:124,135`、`strategy.js:25`、`genesis.js:29,43`、`pvp.js:250`、`daily.js:253`、`idle.js` 等所有直接 `store.save()` 改为 `safeSave()`（非结算）或 `withTransaction`（结算），全仓 `rg "store.save("` 仅剩 `store.js` 内部

#### 统一奖励唯一结算（强类型审计）
- **载体**：`player.settlementLedger: Array<SettlementLedgerEntry>` ≤100，`meta.arenaRewards[period][periodKey]` 全局分类账（空排名也占位），`meta.arenaSkipped[period][periodKey]: {at,source}` 独立跳过记录（无 source 字段混用）
- **强类型**：新增 `server/engine/settlement.js` 导出 `assertSettlementReward(type, reward)`，按 `daily/chest/achievement/boss_participation/boss_settle/arena_*/pvp_challenge/cock_round/cock_exchange` 精确白名单校验（`cock_exchange` 缺 `cost` 必拒，宝箱仅 `null`，成就组合白名单等）
- **幂等键**：
  - 日常/宝箱/成就：`daily:${today}:${id}` / `chest:${today}` / `ach:${id}` 凭 `claimed + ledger` 200 `already:true`
  - 世界 Boss 参与：`boss:participation:${bossDayKey}:${id}:${u}` 同北京日内二次 409；排名结算：`boss:settle:${spawnDayKey}:${id}` + 子 `rank`，`boss.settled` + `settlementIds` 必写
  - 竞技场挑战：`pvp:challenge:${requestId}` 客户端 `genUid()` 生成、页面 `pendingRequestId` 持有至成功、重试复用，服务端四态判别（ledger 命中且 `fullResult` 完整 200 重放 / 命中但 `fullResult` 缺失 500 / ledger 未命中但 `pvpRecords` 命中 200 重放 / 二者皆无走 NEW 校验），绑定 `username/target/isBot` 跨主体复用 409
  - 灵鸡对局：`cock:round:${today}:${createdAt}`，`enter` 返 `createdAt` 重复 enter 返原 200 不覆盖，`resolve` 先查重放（优先 `ledger.fullResult` 次选 `history.fullResult`）命中缺失 500
  - 灵鸡兑换：`cock:exchange:${key}` 已拥有 409

#### 竞技场周期语义
- **游标**：`meta.arenaCursors:{daily,weekly,monthly}` 持久化最后已结算周期，`nextKey = nextPeriodKey(cursors[period])` 且 `< curKey` 时在 `withTransaction` 内结算并推进，失败不推进
- **启动补偿**：若游标缺失初始化为两周期前（昨天/上周/上月可补），循环 `while(nextKey < curKey)` 依次补结算（每日最多 7 次/每周 4 次/每月 2 次），超界区间为每个被跳过 `periodKey` 在事务内写 `arenaRewards[period][periodKey]={}` + `arenaSkipped[period][periodKey]={at,source:'skip:gap'}` 并推进
- **手工结算**：`POST /api/arena/settle` 仅 `x-admin-token` 或 `isTestMode()` 放行否则 403，`periodKey` 必须为已结束周期（weekly 需周一、monthly 需 YYYY-MM）否则 400，不传则结算 `nextKey`，仅当 `periodKey===nextKey` 才推进游标
- **查询**：`GET /arena/rewards/:period?periodKey=&username=` 支持任意历史 `periodKey`，超出保留窗口先查 `ledger/arenaSkipped` 否则 404

#### 称号与时间缝
- **结构**：`player.titles: Record<string,true>`、`titleExpiry: Record<string,number>`、`currentTitle: string|null`，`createCharacter` 默认补齐，`migratePlayer` 数组→对象迁移并过滤非法 key/非法 expiry 值（非有限数或 ≤0 删除），非法 `currentTitle` 置 null
- **来源**：`ALL_TITLES = JOB_TITLES(20)+WORLD_BOSS_TITLES(3)+ARENA_SHOP_TITLES(2)+COCKFIGHT_DISPLAY_TITLES(6)+ACHIEVEMENT_TITLES(11)` 共 42，`isValidTitleKey` 统一校验
- **缝**：所有过期判定与日常/周/月/赛季/BOSS 日键均走 `getNow()` seam，替换 `Date.now()`→`getNow()`，`GET /titles` 先迁移再清过期并矫正 `currentTitle` 后事务保存；`POST /titles/equip` 支持 `key===null` 卸下 200，非法 404，未解锁/已过期 409
- **前端**：`WorldBossView.vue` 移除客户端 UTC 判定改为仅 `attackedToday` 服务端值；`attack` 响应兼容 `res.data.battle` 与顶层 `res.battle`；倒计时仅用服务端 `remainingMs` 递减

#### 前端适配（本期新增）
- `client/src/api.js:173,195,220`：`challenge(username,target,isBot,requestId)` 必传 `requestId`，`resolveCockRound(username,bet,intervention,createdAt)` 必传 `createdAt`，`enterCockArena` 解析 `createdAt`；全部仍走 `request` 封装
- `CockfightArena.vue`：持有 `pendingCreatedAt`，`enter` 存 `res.data.createdAt || res.createdAt`，`resolve` 透传；兼容 `already:true` 重放
- `PvPView.vue`：持有 `pendingRequestId`（`Math.random+Date.now` 生成），`challenge` 复用至成功，网络失败保持同一 ID
- `App.vue:225,301`：`GET /player` 解包 `data:{player,offlineSummary}` 兼容 `res.data.player||res.data` 与 `res.offlineSummary`，`prevLevel` 基于 `p.level`，离线弹窗兼容双层
- `TitleModal.vue:112`：`equip(null)` 卸下透传 `null` 200

#### 测试与构建
- 新增 `server/store.test.js`、`server/engine/settlement.test.js`、`server/routes-settlement.test.js`、`server/timer-settlement.test.js`、`server/restart-consistency.test.js`、`server/schema.test.js`，覆盖原子写/损坏回退/事务回滚/`assertSettlementReward`/幂等/`arenaSkipped`/时区/重启一致性
- `npm run build`（vite）通过，`npm test` 全量通过

---

## v1.05 · 2026-08-31

### 🗺️ 远征探索（T-102 v4 全量）

#### 静态配置
- 新增 `server/data/expedition.js`：4 区域（丰饶边境 Lv.1/古代遗迹 Lv.15/深渊裂隙 Lv.30/巨龙巢穴 Lv.50，差异化 `gold/exp/drops/goldLoss/bossChance`）· 10 事件（战斗/商人/遗迹/救援/天气/路线全覆盖，各 2 选项含 `risk/rewardHint/timeDelta`）· 3 档时长（30m/2h/8h，`MIN 10m`）· 百分比时长（`-10%`）派遣时解析为固定 ms 持久化

#### 引擎与结算
- 新增 `server/engine/expedition.js`：`CombatSnapshot` 快照（`getCombatStats` 固化）、`simulateExpeditionBossBattle(snapshot,boss,5): ExpeditionBossBattleResult` 扁平战力接口、`dispatch/choose/claim/status` 全链路、`baseGoldLoss {chance:0.4,rate:0.3}` 深渊预骰与 `boss {baseChance,roll}` 延期判定、`timeDelta` 负值下界 `startAt+10m`、`lossGold=floor(baseGold*(baseGoldLossRate+ΣlossRate))` 非负、`finalChance=clamp(base+ΣbossChanceDelta)`、`totalGold=max(0,base+ΣgoldDelta-loss+BossGold)`，仅 `win` 发首领奖励与 `bossKills`
- 幂等：`settlementId=expedition:${id}`，`ledger` 首查重放 200 `already:true`/`500` 损坏，未命中再校验当前远征，`expeditionId` 必填 400，`choiceChangeCount` 每事件限改 1 次、仅 `ongoing` 可选 409，`withTransaction` 事务化

#### 数据与视图
- `server/engine/player.js`：`expedition/expeditionHistory≤20/expeditionReports≤20/expeditionCodex` 迁移与截断；`view.js` 透出 `expedition/history/reports/codex`
- `server/engine/index.js`：注入 `grantGold/grantExpWithLevelUp` 与 `updateDailyProgress/checkAchievements`，导出远征 4 接口
- `server/engine/settlement.js`：新增 `expedition` 校验 `{gold,exp,materials?,equips?}` 最终非负

#### 路由与前端
- 新增 `server/routes/expedition.js`：`GET /expedition/config`、`GET /player/:u/expedition`、`POST dispatch/event/choose/claim`（`claim` 必带 `expeditionId`），注册至 `routes/index.js`
- `client/src/api.js`：`getExpedition* / dispatch / choose / claim`
- 新增 `client/src/components/ExpeditionView.vue`：地图侧边抽屉“远征营地”入口（`MapView.vue`）、4 区域卡片、3 时长、倒计时与进度条、事件 2 选项（风险/收益/时长）、`ready` 领取、报告（含首领 5 回合战报）、历史与图鉴；`App.vue` 新增 `expedition` Tab

#### 构建
- `npm run build` 通过，`npm test` 213 例通过（存量），远征 4-6 例单测从简按 v4 验收覆盖

---

## v1.03 · 2026-08-29

### 🆕 新增功能

#### 🐔 灵鸡斗场（完全独立玩法）
- **地图 → 侧边抽屉 → 灵鸡斗场**，与主游戏资源完全隔离：不消耗金币/体力/属性/转生点，不影响挂机收益与转生平衡，唯一产出**斗鸡积分**（仅兑换外观称号）
- **每日 20 次**参赛机会（北京时间 0:00 重置）
- **每局 6 只灵鸡**（8 只池中随机抽取）：每只显示名号 + 3 条状态线索（如"羽毛倒竖/眼神凌厉/不停扑翅"），5 项隐藏数值（攻/防/速/体/暴击）
- **押注 1~6 号**（纯免费）+ **临场干预三选一**（可跳过）：
  - 🍗 投喂仙豆：己方攻击 ×1.3（无风险）
  - 🧊 撒铁蒺藜：随机对手速度 ×0.6（30% 被发现 → 己方速度 ×0.6）
  - 🩸 激将法：己方暴击率 +50%（本局输了 → 下局强制换掉这只鸡）
- **擂台赛**：1v1 逐场 5 回合，守擂者保留血量，战报逐行动画输出
- **积分规则**：押中 +1 分；连胜第 3/6/9…局额外 +1；连错 5 局弹安慰彩蛋"今天手气不好，要不去挂会儿机？"
- **称号兑换**：斗鸡新人(5) / 灵鸡骑士(15) / 百鸡斩(30) / 斗战圣鸡(50) / 万鸡之王(80·隐藏)；累计参与 250 局自动获得成就称号**斗鸡狂魔**
- 新增 `server/data/cockfight.js`、`server/engine/cockfight.js`、`server/routes/cockfight.js`、`client/src/components/CockfightArena.vue`

#### 🌑 混沌图鉴（全服共享）
- 创世系统中**被抹除**的生物与装备不再凭空消失：删除前深拷贝快照归档到 `meta.genesis.chaos`（记录 `erasedAt / erasedBy / erasedReason`）
- 图鉴新增 **"混沌"页签**（子分类：被抹除的生物 / 被抹除的装备），全服所有玩家可见
- 混沌对象永不回流普通图鉴，不再注册进 `EQUIP_TEMPLATES`

#### 📊 图鉴装备排序
- 图鉴装备列表支持按 **11 项属性**（攻击/防御/生命/敏捷等）升序/降序排序
- 纯前端实现：对列表副本排序后分页，不写背包持久化、不影响服务器排序

#### 👑 竞技场永久称号
- 竞技场商店新增**永久称号专区**：不朽星灵 / 轮回之主（各 10000 竞技币，金色边框卡片，购买后显示绿色"已拥有"）
- 排行榜 / TopBar 称号解析链补齐，佩戴后正常显示名称与颜色
- 称号弹窗完整展示全部称号（未拥有的永久/限时称号显示锁定来源提示）

#### 🎛 属性预设系统
- 转生页支持保存多套属性分配预设（名称 + 四维比例）
- **保存与应用分离**：保存预设不自动加点；应用走两段式算法——先对齐预设比例，再把剩余点数按比例分配
- 传 `presetId` 而非索引，确保后端正确查找

#### ⚡ 一键转生（内测工具）
- 转生 tab 新增内测按钮：输入转生次数(1-999) + 目标等级(100-6000)，自动用金币按高级经验卷轴（800 金币/3000 经验）购买力拉级后连续转生
- 金币不足时停在断点返回已完成轮数；代码标记"内测，后续随经验卷轴一起删除"（搜索 `autoReincarnate` / `AUTO_REINC` 定位）

### 🔧 系统调整

#### 转生系统 v4/v6/v9
- **转生点公式 v6**：首次转生固定 **10 点**（激励），后续 `floor(等级 / 50)`（100 级→2 点，500 级→10 点，1000 级→20 点）
- **永久加成统一累加 v4**：经验/金币每次 +1%（封顶 **60%**），基础四维每次 +1 —— 与转生商店"经验祝福·微"同速率
- **v9 属性之魂增幅保留**：转生时 `baseAtkPercent / baseDefPercent / baseHpPercent / baseAgiPercent` 商店增幅不再被清零
- **实际增量显示**：`nextBuffs` 返回距封顶的真实增量（封顶后显示 +0%）
- 永久加成面板显示转生累计的**基础攻击/防御/生命/敏捷 +N**

#### 世界 BOSS 奖励 v3.1/v3.2
- **去掉材料奖励**（参与奖/最后一击奖均不再发材料），基础奖励只剩金币/经验按伤害占比发放
- **前 3 名等级进度奖**：`levelBonus = floor(boss.hp × 0.01)`，按 50% / 30% / 20% 比例分配
- **4~20 名固定排名奖**：上限 = BOSS 基础 gold/exp × 1.0
- **BOSS 数值锚点改用全服中位数**（70% 模板 + 30% 中位数），防单个超强玩家拉爆数值

#### 种族加成调整（v1.02 后续）
- 灵巧(spi) 改为 flat HP（+100/+200）；魅力(cha) 改为移速增幅（每 2 点 = 1% 敏捷，10 点 = +5%，30 点 = +15%）

#### 背包排序全面持久化
- 挂机掉落 / 商店购买 / 装备合成 / 竞技商店购买装备**全部按"排序插入"**进背包（武器→护甲→饰品，类别内最高属性降序），而非 push 到末尾
- 5 秒轮询刷新后顺序不再被打回原形，服务端持久化

### 🐛 Bug 修复

#### 称号购买不固化（严重）
- **根源**：老存档 `player.titles` 是**数组**，而竞技场/斗鸡/BOSS 称号按**对象**写入（`titles[key] = true`）——数组上的字符串键属性被 `JSON.stringify` 静默丢弃，购买记录存盘即消失；且 `migratePlayer` 会把对象强转回空数组
- **修复**：`titles` 全链路统一为对象结构（key → true）：`createCharacter` 初始化 / `migratePlayer` 数组→对象迁移（中文成就名以名字为键保留）/ 成就发称号 / 视图读取
- 已为受影响存档补偿丢失的永久称号

#### 世界 BOSS 每日一次判定时区错位（严重）
- **根源**：BOSS 重生/过期用**北京时间**（本地 0 点），但 `spawnDayKey` 与玩家"今日已挑战"（`lastBossAttackDay`）用 **UTC 日期**（比北京晚 8 小时），两套日期错位导致：
  - 北京 0:00-8:00 打过的玩家，8 点 UTC 翻日后**同一天能再打一次**（每日变成两次）
  - 昨天打过的玩家，今天新 BOSS 0 点重生后在 0:00-8:00 窗口**反而被拒**（要等到 8 点）
  - BOSS 在北京 8 点（UTC 翻日）被误判"跨日"而**额外重生一次**（每天两只）
- **修复**：新增 `getBossDayKey()`（UTC+8 北京日期，不依赖机器时区）统一 4 处判定（spawnDayKey / 跨日重生 / 每日一次 / 路由层 challengedToday 按钮状态）；`getTodayMidnight()` 同步改走北京时间 + `getNow()` 时间 seam
- 新增 `worldboss-daily.test.js` 4 个时区场景测试

### ✅ 测试
- 新增 16 个测试文件 / 38 个用例，全量 **153 个测试全部通过**：灵鸡斗场（16）、混沌图鉴归档、称号结构迁移（6）、属性预设、一键转生、种族加成、转生封顶/累加/点数/保留、背包排序、竞技场称号、世界 BOSS（数值 19 + 每日一次时区 4）

---

## v1.02 · 2026-08-28

### 🆕 新增功能

#### 世界 BOSS 全面重构
- **BOSS 数值 = 全服当前最强玩家 × 10 倍**，按生命 5 : 攻击 3 : 防御 1 : 敏捷 1 分配到 BOSS
  - 计算公式：`hp = strongest.hp × 5`，`atk = strongest.atk × 3`，`def = strongest.def × 1`，`agi = strongest.agi × 1`（共 5+3+1+1=10 倍拆解）
  - 锚点评估函数 `getStrongestPlayer` 按 `hp/10 + atk + def*2 + agi + level*5` 取最高分；找不到玩家时退回模板数值
- **每日刷新**：BOSS 在每日 0 点强制死亡结算（无论是否被打死），次日 0 点重生；`expiresAt` 字段实时记录过期时间，前端倒计时 HH:MM:SS
- **每日 1 次挑战**：玩家 `lastBossAttackDay` 字段按当日键判定；次数用完后按钮变为"今日次数已用完 · 等待次日重生"
- **一次挑战 = 一次 5 回合战斗**：新增 `simulateBossBattle(player, boss, 5)` 战斗模拟器，5 回合上限，按 hit/defence/agi 比动态行动次数；返回战报含每回合 actions / pHp / mHp
- **伤害前三 24h 称号奖励**：
  - 🥇 第一名 【天命弑神者】
  - 🥈 第二名 【深渊征服者】
  - 🥉 第三名 【暗影屠戮者】
  - 存入 `player.titleExpiry`，下次 `/api/titles` 拉取时自动剔除过期
  - 称号 UI 在 BOSS 战报下方金色"称号奖励"卡片即时展示

#### 称号系统（贯穿游戏）
- **后端 `server/data/titles.js`**：扫描 `JOB_TREE[].stages` 自动派生 5 职业 × 4 阶段 = 20 个职业阶段称号（key 形如 `thunder:御雷者`），加上 3 个世界 BOSS 限时称号
- **职业称号解锁规则**：仅当玩家 `jobPath === meta.jobId` 且 `level >= meta.requiresLevel` 时才可佩戴
- **限时称号有效期**：24 小时（`titleExpiry[key] = Date.now() + 86400000`）
- **API**：
  - `GET /api/player/:username/titles` → 返回 `currentTitle / unlocked / active(限时未过期) / all`
  - `POST /api/player/:username/titles/equip` → 佩戴 / 卸下（key=null）
  - `GET` 接口顺手清理过期称号 + 持久化
- **角色页职业名称位置改为 currentTitle**：未佩戴时回退显示 `player.job`，佩戴后显示金色 / 银 / 铜三色限时称号
- **角色页右侧折叠栏新增"称号"按钮**（与进阶/任务并列）：点击弹出 `TitleModal.vue`，按职业分组列出 4 个阶段（未解锁显示锁 + Lv.N），下方展示限时称号及剩余时间
- 新增 `client/src/components/TitleModal.vue`、`server/data/titles.js`、`server/routes/titles.js`

#### 背包整理按钮
- 装备栏右上增加紫色"✨ 整理"按钮（在"一键合成"左侧）
- 点击后按 **装备类别（武器→护甲→饰品）+ 类别内按最高属性降序** 重新排序
- 前端乐观更新（玩家 equips 数组直接重排），后端保持不动（`props.player.equips` 即时生效，下次轮询会被覆盖前已排序好）
- 前端 `client/src/App.vue` 增加 `handleInventorySort` 接收子组件 emit

### 🔧 后端引擎
- `server/engine/combat.js` 新增 `simulateBossBattle(player, boss, maxRounds=5)`，复用 `calcDamage` / `getActionCount`
- `server/engine/worldboss.js` 重写：移除旧版模板数值生成，改为按全服最强玩家 × 10 倍；新增 `ensureBossFresh` 处理跨日强制结算；移除 `setRecalcMaxStatsHandler` 旧 seam
- `server/engine/index.js` 新导出 `simulateBossBattle / getBossExpiresAt / getStrongestPlayer`，同步移除 `worldboss.setRecalcMaxStatsHandler` 调用
- `server/routes/worldboss.js` 重构：active 路由增加 `expiresAt / challengedToday / remainingMs`，攻击路由返回完整 `battle / rewards / player`，移除旧 5 秒冷却

---

## v1.01 · 2026-08-27

### 🆕 新增功能

#### 界面风格换肤系统（纯前端，不动任何数值）
- **三种风格**：原·星夜风（默认）/ 暗金风（玄黑鎏金）/ 羊皮纸风（古卷褐墨·浅色主题）
- **入口**：角色页职业栏下方新增"设置"栏 → "界面风格" → 弹出选择弹窗
- **即时生效**：点击选项立刻换肤（弹窗本身也跟随换肤，所见即所得），选择自动保存 `localStorage`（key: `ferland-theme`），重启自动恢复
- **实现机制**：35 个文件里 85 处硬编码 `rgba()` 颜色统一改为 CSS RGB 三元组变量（`--panel-rgb / --panel2-rgb / --violet-rgb / --gold-rgb`），默认值与原色完全一致 → **原风格视觉零变化**；新主题只覆盖变量，不改动任何原有样式规则
- **新增文件**：`client/src/themes.css`（主题定义）/ `client/src/theme.js`（切换+持久化）/ `client/src/components/ThemeModal.vue`（选择弹窗）
- 登录页保持星夜氛围不跟随换肤（有意设计）

### 🐛 Bug 修复

- **登录页白屏（ReferenceError）**：`watch` 引用了在其后声明的 `agreedToLaws` → 声明移到 `watch` 之前，恢复初始化顺序
- **注册成功却提示"契约未成"**：当前 Vue 版本的 `emit` 不会回传父组件处理函数的返回值，`res` 恒为 `undefined` 恒走失败分支 → 改为 `defineExpose` 暴露 `setRegisterResult()`，App.vue 注册完成后主动回传结果（成功翻神谕面板 / 失败留页显示 inline 错误）
- **"契约成立"过渡面板星标一闪一闪**：去掉 `✦` 星标的 `rune-pulse` 循环缩放爆光动画，改为静止常亮（圆环旋转保留）

### ⚖️ 数值调整（创世系统 v2.6 / v2.7）

- **图鉴显示真实掉率**：自创装备的 `sources` 从硬编码 `rate: 0` 改为反查"绑定了该装备的自创怪"的真实掉率，并列出来源怪物名与造物主；`pending` 阶段兜底显示投放地图
- **玩家造怪物不再自定义掉率**：统一用全局默认常量——自创装备 3% / 自创材料 5%（防刷）
- **全局掉率压缩**（挂机放置类，等级越高装备越稀有）：装备掉率梯度 Lv1-30 约 1% → Lv200-250 约 0.05%（每升 1 级约 ×0.85），材料掉率统一砍半