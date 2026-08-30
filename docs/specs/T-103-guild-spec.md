# T-103 工会基础 — 技术方案 Spec v2.2（已放行·闭合 v2.1 评审 3 契约）

> 范围严格对应 `ai开发任务需求:37-61` 公会基础 + `ai开发任务需求:162-170` 统一原则 + `ai开发任务需求:185-186` 阶段03。
> 本阶段**仅做公会基础**（创建/加入/成员/职位/公告/贡献/等级），**不做**占点对战（`ai开发任务需求:62-87` 延期至 T-105）、暂缓公会聊天/语音/复杂外交/跨服（`ai开发任务需求:202`）。
> **明确 N/A（随 T-105 延后）：** 公会周任务/累计任务、赛季状态/赛季积分/赛季奖励、资源消耗类操作；背景中“赛季状态/资源库存”仅为展示库存，本期不含赛季模型。

## 1. 背景与目标

- 现状：已具备 `server/data/expedition.js:1-117` 4 区域远征、`server/engine/active.js` 每日活跃、`server/store.js:134` 全状态事务与 `server/engine/settlement.js:1-177` 唯一结算，但无 `ai开发任务需求:37-42` 所需的“长期协作容器”（查看成员/等级/贡献/公告；本期不含赛季）。
- 目标：按 `ai开发任务需求:45-52` 四级职位与权限、`ai开发任务需求:56-61` 贡献与等级，交付可创建/加入/管理/捐献/升级的最小闭环，为 F04 占点（报名/布防/异步进攻）与 F05 联动提供 `guildId/role/contribution` 底座。

## 2. 功能范围（按文档全量，不裁剪占点外）

**必须做：**
- 创建/解散/转让：校验金币消耗、名称唯一、二次确认与日志（`ai开发任务需求:49`）
- 加入/离开/踢出：单公会归属、人数上限、权限校验、操作者与时间日志（本期为**公开直接加入**，无申请/审核）
- 成员与职位：`leader/vice/officer/member` 四级（`ai开发任务需求:45-52`），招募/踢出/职位调整/公告编辑按表控权；资源使用权限本期 N/A（无消耗操作）
- 公告：`leader/vice/officer` 可编辑，长度≤200，展示最后编辑者与时间；**1 级即开放**（见 §3 等级说明）
- 贡献与等级：捐献金币/材料得 `contribution` + `guildExp`，等级 1-5 解锁人数（`ai开发任务需求:59-61`）；贡献来源本期以捐献为主，远征结算若已在公会同事务 +10 贡献（§5.3 一次且仅一次）
- 资源库存：`gold/material` 捐献入 `store`，仅日志与展示，本期不消耗（§4）
- 查询：公会列表分页摘要、我的公会详情、成员列表、日志与库存展示

**暂缓（按 `ai开发任务需求:202`）：** 公会聊天/语音/外交/跨服、据点报名/匹配/布防/耐久/赛季结算（F04）、公会周任务/赛季奖励（N/A，F05 再接入）

## 3. 静态配置 `server/data/guild.js`（新增，≤90行）

```js
GUILD_ROLES = { leader:'会长', vice:'副会长', officer:'官员', member:'成员' }
GUILD_ROLE_ORDER = { member:0, officer:1, vice:2, leader:3 }
GUILD_PERMS = {
  kick:     ['leader','vice'],               // 踢出（不能踢同级及以上，不能踢自己）
  promote: ['leader','vice'],                // 调整职位：leader 可任免 vice/officer/member；vice 仅可升降 officer<->member
  announce:['leader','vice','officer'],      // 编辑公告
  disband: ['leader'],                       // 解散
  transfer:['leader'],                       // 转让会长
  // invite / resourceUse 预留，本期不开放：invite 仅文档占位（join 为公开直接入会），resourceUse N/A
}
GUILD_LEVELS = [
  { level:1, exp:0,    maxMembers:10, name:'初创' },
  { level:2, exp:500,  maxMembers:15, name:'崛起' },
  { level:3, exp:2000, maxMembers:20, name:'鼎盛' },
  { level:4, exp:5000, maxMembers:30, name:'传奇' },
  { level:5, exp:10000,maxMembers:40, name:'不朽' },
] // 本期等级仅解锁人数；公告 1 级即开放，无额外等级门槛
GUILD_CREATE_COST = { gold:500 }
GUILD_NAME_RULE = { min:2, max:12, pattern:/^[\u4e00-\u9fa5a-zA-Z0-9_\u4e00-\u9fa5]+$/ }
DONATE_OPTIONS = [
  { id:'gold_small', label:'小额捐献', cost:{ gold:200 }, reward:{ guildExp:10, contrib:10 }, dailyLimit:5 },
  { id:'gold_large', label:'大力捐献', cost:{ gold:1000 }, reward:{ guildExp:60, contrib:50 }, dailyLimit:3 },
  { id:'mat_herb',   label:'草药捐献', cost:{ material:'草药', count:5 }, reward:{ guildExp:15, contrib:15 }, dailyLimit:5 },
]
MAX_GUILDS = 200
GUILD_LOG_LIMIT = 30
GUILD_ARCHIVE_LIMIT = 50
VICE_LIMIT_PER_GUILD = 1
OFFICER_LIMIT_PER_GUILD = 2
```

- `getGuildLevel(exp)` → 当前等级；`getNextLevelExp(level)` → 下一级阈值（5 级为 null）；`maxMembers` 由等级推导
- 名称校验：trim 后 `min~max` 且 `pattern`，全服唯一以 `lowerName` 索引大小写不敏感去重
- 权限补充：`vice` 全公会限 1、`officer` 限 2（按 Guild 计数，非全服）；禁止对 `leader` 操作、禁止自操作、禁止 `role` 升至 `leader`（必须走 `transfer`）

## 4. 数据模型

```js
// meta 扩展（store.js load 时补默认，JSON 持久化）
meta.guilds: Record<guildId, Guild> // ≤200
meta.guildNameIndex: Record<lowerName, guildId> // 辅助唯一校验，load 时重建
meta.guildArchive: Record<guildId, { id, name, disbandedAt:number, by:string, snapshot:Guild, logs:Array }> // ≤50，解散归档

type Guild = {
  id:string,              // genUid()
  name:string,
  level:number,           // 1-5，由 exp 推导
  exp:number,             // 累计
  announcement:string,    // ≤200
  announcementAt:number|null,
  announcementBy:string|null,
  createdAt:number,       // getNow()
  leaderUsername:string,  // 当前会长（转让后更新，非“创建者”）
  members:Array<Member>,
  store:{ gold:number, materials:Record<string,number> }, // 仅展示
  logs:Array<{ at:number, by:string, action:string, target?:string, detail?:string }>, // ≤30，写入即截断
}
type Member = {
  username:string,
  name:string,            // 实时投影自 data.players[username].name
  level:number,           // 实时投影自 data.players[username].level
  role:'leader'|'vice'|'officer'|'member',
  contribution:number,    // 本公会内累计贡献（与 player.guildContribution 同步累加）
  joinedAt:number,
}

// player 扩展（migratePlayer 默认）
player.guildId: string|null
player.guildRole: 'leader'|'vice'|'officer'|'member'|null // 冗余投影，与 Guild.members 同步
player.guildContribution: number // 生涯累计贡献（跨公会累计，不随离会/踢出清零）
player.guildDonateDaily: { dayKey:string, counts:Record<donateId,number> } // 每日捐献计数，跨日重置
player.guildJoinAt: number|null
```

### 4.1 全局状态进入引擎（闭合 v1 阻断 1 + v2 细节 1）

- **事实源：** `Guild.members` 为归属与权限唯一事实源；`player.guildId/Role/JoinAt` 为投影，**必须同事务双向同步**。
- **统一上下文：**
  ```ts
  type GuildCtx = { meta: Meta, players: Record<string, Player> } //  жив引用，非克隆
  ```
  - 写入路径：`store.withTransaction(data => guild.createGuild(player, name, data))`，`data` 即 `GuildCtx`（`data.meta.guilds`+`data.players`），引擎直接读写 `data`，失败回滚。
  - 读取路径：不走事务时构造只读 `ctx = { meta: store.getMeta(), players: store.__getRawData().players }`（同一内存实例，不另取分叉 store）；`listGuilds(ctx,...)`、`getMyGuild(player, ctx)`、`getPlayerView` 均用此 `ctx`，避免两套 `store` 实例读不一致。
  - `migratePlayer(player)` 保持单参兼容，内部懒取 `meta` 自愈（同 v2 代码），但新写路径以 `ctx` 为准；`view.js:getPlayerView(player)` 内部同样 `ctx = {meta: store.getMeta(), players: __getRawData().players}` 后同步 `members[].name/level` 投影与 `player.guildRole` 一致性（见 §4.2）。
  - `server/engine/index.js` 暴露 `_getStoreMeta()` / `_getRawData()` 供懒取，不新增 `getStoreMeta` 歧义分支。
- **store.load：** 补 `meta.guilds={}、meta.guildNameIndex={}、meta.guildArchive={}`，重建 `guildNameIndex`，`trim` logs/archive 至 30/50。

### 4.2 成员状态双向同步（闭合 v1 阻断 2）

- **写入时同步：** 创建 `members=[{username, name:player.name, level:player.level, role:'leader', contribution:0, joinedAt:getNow()}]`；加入追加 `{name:player.name, level:player.level, contribution:0, role:'member'}`；`player.guildId/Role/JoinAt` 同步；`guildContribution` 初始不拷入 `contribution`（新成员本会贡献从 0 起）。
- **离会/踢出/解散：** 清 `player.guildId=null, guildRole=null, guildJoinAt=null`，**保留** `guildContribution` 不清零；踢出遍历 `ctx.players[target]` 清投影；解散遍历 `guild.members` 逐一清投影并归档 `meta.guildArchive[id]`。
- **职位/转让：** `updateRole/transfer` 同事务更新 `Guild.members[].role` 与 `ctx.players[target].guildRole` 及 `guild.leaderUsername`。
- **实时投影：** `members[].name/level` 每次 `getMyGuild/getPlayerView/list` 读时 `for m of guild.members { const p=ctx.players[m.username]; if(p){ m.name=p.name; m.level=p.level; } }` 后再排序。
- **贡献同步：** `donate` 与 `expedition` 联动均 `guild.exp+=X, member.contribution+=X, player.guildContribution+=X` 三处同事务累加。
- **冲突自愈（v2 细节 4 + v2.2 硬约束 3）：** `Guild.members` 胜出——若 `player.guildId` 指向不存在公会则**同事务清理** `player.guildId/guildRole/guildJoinAt` 三字段（保留 `lifetimeContribution`）；若公会存在但 `player.username ∉ members` 则清三字段；若 `player.guildRole !== members[].role` 则以 `members` 为准重写 `player.guildRole`；自愈发生在 `migratePlayer`（懒取仅内存修正）与 `getMyGuild`（读时修正），**需要落盘的自愈必须走 `store.withTransaction` 持久化**，读路径不直接写盘。

### 4.3 日志截断（v2 细节 3）

- 统一 `appendGuildLog(guild, entry)`：`guild.logs.push({at:getNow(), ...entry}); if(guild.logs.length>GUILD_LOG_LIMIT) guild.logs.splice(0, guild.logs.length-GUILD_LOG_LIMIT);`
- 所有 `create/join/leave/kick/role/transfer/announce/donate/levelup/expedition` 均走此 helper；`store.load` 的 `trim` 仅作兜底。

## 5. 后端设计

### 5.1 模块 `server/engine/guild.js`（新增，≤450行，7 导出）

注入 `getNow/genUid/getTodayKey`，仅依赖 `ctx` 形状，无循环导入。导出 `createGuild/listGuilds/getMyGuild/joinGuild/leaveGuild/kickMember/updateRole/transferGuild/updateAnnouncement/donate/disbandGuild/ensureGuildConsistency/appendGuildLog/getGuildLevel/tryGuildLevelUp`（对外暴露 ≤7，按需聚合）。

- `createGuild(player, name, ctx)` — 同 v2，扣 500 金币，`GUILD_LOG_LIMIT` 走 `appendGuildLog`，写 `ctx.meta.guilds` 与 `guildNameIndex`，同步 `player` 投影，返回 `GuildDetail`
- `listGuilds(ctx, {q, page=1, pageSize=10})` — 读 `ctx.meta.guilds`，过滤 `q`、排序 `level desc, exp desc, createdAt asc`，分页 map 为 `GuildSummary`（§6），`pageSize` 限 10-20
- `getMyGuild(player, ctx)` — 先 `ensureGuildConsistency` 自愈，再同步 `members` 投影并按 `ROLE_ORDER desc, contribution desc` 排序，返回 `GuildDetail` 或 `null`
- `joinGuild(player, guildId, ctx)` — 校验 `!player.guildId` 409、`guild` 404、`members.length >= maxMembers` 409；追加 `member{role:'member',contribution:0}`，`appendGuildLog`，同步 player 三字段
- `leaveGuild(player, ctx)` — 同 v2，单成员会长走解散归档路径
- `kickMember(operatorPlayer, targetUsername, ctx)` — 同 v2，`ctx.players` 清投影
- `updateRole(operatorPlayer, targetUsername, newRole, ctx)` — 同 v2，`vice` 全会限 1/`officer` 限 2
- `transferGuild(operatorPlayer, targetUsername, ctx)` — 同 v2
- `updateAnnouncement(operatorPlayer, text, ctx)` — 同 v2
- `donate(player, donateId, ctx)` — 校验在会 409、`donateId` 404、日限 409、资源充足 409；扣资源、`guild.exp/store/member.contribution/player.guildContribution` 三处累加、日计数+1、`appendGuildLog`、`tryGuildLevelUp`，返回 `{guild: GuildDetail, reward, viewer}`（§6）
- `disbandGuild(operatorPlayer, ctx)` — 同 v2，归档截断 50
- `ensureGuildConsistency(player, ctx)` / `appendGuildLog` / `tryGuildLevelUp` 私有 helper

全部写操作由 `server/routes/guild.js` 以 `store.withTransaction(data=>{ const p=data.players[username]; return fn(p, ..., data); })` 包裹，失败 500 回滚；读列表/详情用只读 `ctx` 不走事务（`ensureGuildConsistency` 若需持久化则必须走事务路径）。

### 5.2 时间与去重

- 全部 `Date.now()`→`getNow()`，`dayKey` 走 `getTodayKey()`，与 `daily.js` 同口径；跨日 `migratePlayer` 已重置 `guildDonateDaily`
- 名称唯一以 `lowerName` 索引；`join/leave/kick` 以 `username+guildId` 为幂等键（重复 join 同会 409，重复 leave 404，不引入 `already:true`）

### 5.3 联动：远征一次且仅一次（闭合 v1 阻断 6）

- `server/engine/expedition.js:claimExpedition(player, expeditionId, data)` 签名扩展可选第三参 `data`（`GuildCtx`）；`server/routes/expedition.js:78` 同步改为 `store.withTransaction(data=>{ const p=data.players[u]; const r=claimExpedition(p, expeditionId, data); ... })` 将 `data` 传入（实施步骤已列入 §10）。
- 契约：仅当 `r.success && !r.already` 且 `p.guildId && data.meta.guilds[p.guildId]` 时，在**同一事务内** `guild.exp+=10, member.contribution+=10, p.guildContribution+=10, appendGuildLog guild {action:'expedition'}` 并 `tryGuildLevelUp`；`already:true` 重放不二次加。
- 失败策略：公会累加失败视为事务失败整体回滚；若 `guildId` 指向不存在公会则**同事务清理** `p.guildId/guildRole/guildJoinAt` 三字段后不加贡献但远征结算仍成功（自愈保留 `lifetimeContribution`）。

## 6. API 契约 `server/routes/guild.js` → `registerGuildRoutes(app,store)` 在 `routes/index.js` 注册

统一响应 `{success:boolean, data?:any, message?:string}`（与 `T-101` 一致，`_helpers.fail` 显式码）。

```ts
type GuildSummary = { id:string, name:string, level:number, exp:number, nextLevelExp:number|null, maxMembers:number, memberCount:number, announcement:string, announcementAt:number|null, announcementBy:string|null, createdAt:number, leaderUsername:string, leaderName:string, leaderLevel:number }
type GuildDetail  = { id:string, name:string, level:number, exp:number, nextLevelExp:number|null, maxMembers:number, memberCount:number, announcement:string, announcementAt:number|null, announcementBy:string|null, createdAt:number, leaderUsername:string, members:Array<{username:string,name:string,level:number,role:string,contribution:number,joinedAt:number}>, store:{gold:number,materials:Record<string,number>}, logs:Array<{at:number,by:string,action:string,target?:string,detail?:string}> }
type GuildViewer  = { role:string|null, currentContribution:number, lifetimeContribution:number, donateDaily:{dayKey:string, counts:Record<string,number>}, joinAt:number|null } // current=本会 member.contribution，lifetime=player.guildContribution
```

| 方法 | 路径 | 入参 | 成功 `data` | 失败 |
|------|------|------|-------------|------|
| GET | `/api/guilds?q=&page=&pageSize=` | query `q` 可选 | 200 `{list:GuildSummary[], total, page, pageSize}` | 500 |
| GET | `/api/player/:u/guild` | — | 200 `{guild: GuildDetail\|null, viewer: GuildViewer}`（无会则 `guild:null`，`viewer` 仍返空投影，`currentContribution=0`） | 404 角色不存在 / 500 |
| POST | `/api/player/:u/guild/create` | `{name:string}` | 200 `{guild: GuildDetail, viewer: GuildViewer}` | 400 名称非法/缺参 / 404 角色不存在 / 409 已在公会/重名/全服上限/金币不足 / 500 |
| POST | `/api/player/:u/guild/join` | `{guildId:string}` | 200 `{guild: GuildDetail, viewer: GuildViewer}` | 400 缺参 / 404 公会/角色不存在 / 409 已在公会/已满 / 500 |
| POST | `/api/player/:u/guild/leave` | — | 200 `{success:true}` | 404 不在公会/角色不存在 / 409 会长需先转让 / 500 |
| POST | `/api/player/:u/guild/kick` | `{targetUsername:string}` | 200 `{guild: GuildDetail}` | 400 缺参 / 403 无权限 / 404 目标/公会不存在 / 409 同级及以上/自踢 / 500 |
| POST | `/api/player/:u/guild/role` | `{targetUsername:string, role:'vice'|'officer'|'member'}` | 200 `{guild: GuildDetail}` | 400 缺参/非法 role / 403 无权限 / 404 目标不存在 / 409 人数超限/层级不足 / 500 |
| POST | `/api/player/:u/guild/transfer` | `{targetUsername:string}` | 200 `{guild: GuildDetail}` | 400 缺参 / 403 仅会长 / 404 目标不存在 / 409 同会校验/自转 / 500 |
| POST | `/api/player/:u/guild/announcement` | `{text:string}` | 200 `{guild: GuildDetail}` | 400 超长/缺参 / 403 无权限 / 404 公会不存在 / 500 |
| POST | `/api/player/:u/guild/donate` | `{donateId:string}` | 200 `{guild: GuildDetail, viewer: GuildViewer, reward:{guildExp:number, contrib:number}}` | 400 缺参/非法 donateId / 404 角色/公会不存在 / 409 不在公会/资源不足/日限 / 500 |
| POST | `/api/player/:u/guild/disband` | — | 200 `{success:true}` | 403 仅会长 / 404 公会不存在 / 500 |

- 列表 `GET /guilds` 仅返 `GuildSummary`，不带 `members/logs/store`；
- 详情 `GET /player/:u/guild` 与创建/加入/捐献均同时返回 `viewer`（含 `currentContribution/lifetimeContribution/donateDaily`），前端捐献 `x/n` 直接取 `viewer.donateDaily.counts[donateId]`，无需二次拉取；其他 `POST` 成功后前端显式 `GET /player/:u/guild` 刷新或复用返回 `guild`。
- `getPlayerView`（`GET /player/:u` 轮询）仅透出轻量 `guild: GuildSummary|null`（与 `GET /guilds` 同形，不含 `members/store/logs`），**不透出** `GuildDetail`；完整 `members/store/logs/viewer` 只由 `GET /player/:u/guild` 返回，前端按需拉取。

## 7. 前端 `client/src/api.js` + `GuildView.vue`

- 入口：**地图侧边抽屉“公会大厅”**（复用 `MapView.vue:258` 抽屉），点击进 `GuildView.vue` 全屏替换；`App.vue` 新增 `activeTab==='guild'`，`tabOrder` 追加 `'guild'`，但**不入** `mainTabs` 5 Tab；`GET /player` 轮询已含 `guild` 摘要，无新增轮询，按需 `GET /player/:u/guild` 拉详情与 `viewer`
- `GuildView.vue` 双态：
  - **未入会**：顶部创建卡片（名称输入+500金币提示+创建按钮）、搜索框 `q`、公会列表（`GuildSummary`：名称/等级/人数`m/n`/会长名·等级/公告摘要/加入按钮）、分页
  - **已入会**：公会头（名称/等级/经验进度条 `exp/nextLevelExp`（5 级 `nextLevelExp=null` 满级）/人数/会长 `leaderUsername`）、公告区（展示 `announcement`+`By/At`，编辑仅 `announce` 权限，弹窗二次确认）、成员表（用户名/等级/职位/**本会贡献**/加入时间，操作列：踢出/升降/转让，仅有权限且 `ROLE_ORDER` 控制，转让/踢出二次 `modalConfirm`）、捐献区（3 选项卡片+日限 `x/n` 取 `viewer.donateDaily`+捐献按钮）、库存区（`store.gold/materials` 只读）、日志区（近 30 条 `action/by/target/at`）、个人信息区（**本会贡献** `viewer.currentContribution` 与 **生涯累计** `viewer.lifetimeContribution`）、离开/解散按钮（`leave/transfer/disband` 均 `modalConfirm` 二次确认）
- `api.js` 新增 `getGuilds(q,page,pageSize)/getMyGuild/createGuild/joinGuild/leaveGuild/kickMember/updateRole/transferGuild/updateAnnouncement/donate`，均透传 `{success,data,message}`；捐献成功用返回 `viewer` 直接刷新 `x/n` 与贡献，无需二次 `GET`
- 失败 409/403 透传后端 `message`，`toast.error`

## 8. 验收（闭合 v2.1 后）

- [ ] 创建：名称 2-12 且正则、重名 409（大小写不敏感）、金币不足 409、已在公会二次创建 409、成功扣 500 且 `guildId/Role=leader` 与 `members[0].role=leader` 双向一致，`MAX_GUILDS` 200 达限 409
- [ ] 列表：`GET /guilds` 仅返 `GuildSummary`（无 members/logs/store），分页与 `q` 过滤，排序 `level desc, exp desc`，`pageSize` 限 10-20
- [ ] 加入/离开/重入：未入会可加入，未满可入、已满 409；离开清 `guildId/Role/JoinAt` 但保留 `lifetimeContribution`，重入新会 `currentContribution=0`；单成员会长离开即归档解散，会长带成员离开 409 需转让
- [ ] 成员状态双向同步与自愈：`updateRole/transfer/kick/leave` 后 `members[].role` 与 `players[target].guildRole` 一致；`members[].name/level` 实时投影；`Guild.members` 缺失成员时清 player 投影、role 不一致时以 `members` 为准重写
- [ ] 踢出/职位/转让：`vice` 仅可踢 `member/officer` 且仅可升降 `officer<->member`，`leader` 可任免 `vice(限1)/officer(限2)`；禁止自操作/改 leader/改同级及以上；`vice/officer` 上限按公会计数；二次确认覆盖 `leave/transfer/disband`
- [ ] 公告：仅 `leader/vice/officer` 可编辑，超 200 400，空串可清，展示 `By/At`，1 级即开放
- [ ] 捐献：3 选项日限 5/3/5，`viewer.donateDaily` 返 `x/n`，资源不足 409，成功 `guild.exp/store` + `member.currentContribution` + `viewer.lifetimeContribution` 三处同事务累加，`viewer` 同步刷新，达阈值自动升级，写入即截断 `logs≤30`；跨日 `counts` 重置；5 级 `nextLevelExp=null` 进度满
- [ ] 等级：阈值 0/500/2000/5000/10000，捐献与远征贡献均可触发 `tryGuildLevelUp` 循环升级
- [ ] 远征联动一次且仅一次：首次 `claimExpedition` 成功且 `!already` 时同事务 +10 贡献/经验并升级，`already:true` 重放不二次加；公会不存在自愈不回滚远征
- [ ] 日志与库存展示：已入会 UI 展示近 30 日志（写入即截断）与 `store` 库存；解散归档至 `meta.guildArchive≤50`
- [ ] 重启一致：创建/加入/捐献/远征贡献后等 5s 落盘→重启→`GET /player/:u/guild` 一致；`store.load` 重建 `guildNameIndex`，坏档已解散则 `guildId` 自愈 `null`
- [ ] 范围 N/A 明确：无公会任务/赛季字段
- [ ] `npm run build` 通过；单测从简但必覆盖：创建/重名大小写/满员/权限（vice 升降边界、上限、自踢拦截）、双向同步与自愈、离会重入生涯保留、捐献日限与 `viewer` 刷新、升级阈值、写入截断、远征重放不重复贡献、日志/库存/归档

## 9. 风险与回退

- `db.json` 膨胀：`guilds≤200、members≤40/会、logs≤30、archive≤50` 截断；列表分页
- 解散追溯：`guildArchive` 保留快照与日志
- 回退：`git revert` 删除 `data/guild.js/engine/guild.js/routes/guild.js/GuildView.vue` + `player.js/view.js/index.js/store.js/routes/expedition.js` 迁移字段，老档 `migratePlayer` 自动补 `null` 可前向兼容

## 10. 实施步骤

1. `data/guild.js` + `engine/guild.js` + `engine/player.js` 迁移与 `engine/index.js` 注入 + `engine/view.js` 投影 + `store.js` 补 `meta.guilds/nameIndex/archive`
2. `routes/guild.js` + `routes/index.js` + `server/engine/expedition.js` 同事务联动 + **`server/routes/expedition.js:78` 传入 `data`**
3. `api.js` + `GuildView.vue` + `MapView.vue` 入口 + `App.vue` 注册
4. `npm test` + `npm run build` + `06-changelog.md` v1.06

