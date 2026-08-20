# T-040 任务/委托系统 — 技术方案 Spec v4（待审核·修订版）

> 严格按 `GAMEPLAY_GUIDE.html:605` 范围，不扩展。v4 已与指南同步：装备图鉴 10/20、宝箱仅状态占位均在“完成5个领宝箱”范围内。

## 1. 背景与目标

- 现状：无任务/成就，玩家缺乏短期与长期目标；现有数据仅 `killCount/reincarnation`，无日常/成就进度。
- 目标：实现日常任务（6项各自奖励+完成5项额外宝箱，次日0点重置过期作废）与成就（永久10项，达成后需手动领取才发奖励/称号），前者在 `QuestView.vue` 展示与领取，后者永久记录。统一为**手动领取、幂等**语义。

## 2. 需求澄清（以指南为准）

**日常（6项各自可领取+完成5项额外宝箱，过期作废）**

| 任务 id | 目标 | 个体奖励（需done后手动领取，claimed幂等） |
|------|------|-------------------------------------------|
| hunt50 | 击杀 50 | 500 金币 |
| battle20 | 完成 20 场战斗（calculateIdle win/lose/timeout均计1） | 200 经验（领取时触发升级） |
| alloc1 | 分配 1 次属性点 | 100 金币 |
| affix1 | 装备/卸下 1 个词条 | 1 随机初级材料（池：`INITIAL_MATERIAL_POOL=[草药,兽皮,兽骨,青铜矿]` 随机1，已剔除 Lv.30 海灵石） |
| enchant1 | 完成 1 次附魔 | 300 金币 |
| buy1 | 商店购买 1 件 | 50 金币 |

- 额外宝箱：`daily_chest`，条件：6项中已领取（claimed）≥5，`dailyChestClaimed` 每日1次幂等，次日0点随日常一起重置；**奖励内容未在指南定义，遵循范围约束本次仅实现领取状态与幂等，不发放额外数值**（待 `GAMEPLAY_GUIDE` 修订宝箱奖励后再补发放逻辑）；未领取的个体奖励与宝箱**过期作废**不补发。
- 6项个体奖励各自 `progress/target/done/claimed`，完成即 `done=true` 可领取，未领取跨日不保留。

**成就（永久）**

| 成就 | 条件 | 奖励 | 称号 |
|------|------|------|------|
| 初次冒险 | 创建角色成功 | 100 金币 | 冒险者 | 创建即 unlocked，可领取 |
| 百战不殆 | 击杀 100 | 500 金币 | 战士 | `killCount>=100` |
| 千斩之锋 | 杀 1000 | 5000 金币+精良装备 | 百人斩 | 精良池：`bronze_sword/iron_spear/iron_armor/crystal_ring` 随机1（已剔除普通 `leather_armor`/`beast_tooth`） |
| 万军之破 | 杀 10000 | 50000+史诗 | 万军破 | 史诗池：`thunder_lance/sea_armor/holy_blade/light_wings/knight_blade/golem_armor` 随机1 |
| 满级达成 | Lv.100 | 10000 金币 | 百级强者 | `level>=100` |
| 登神之路 | 完成登神（任一阶） | 50000+传说 | 半神/神灵 | 传说池：`dragon_slayer/void_blade/dragon_armor/abyss_cloak/dragon_eye` 随机1；称号按 `godhood`=`demigod→半神`/`god→神灵` 发放于领取时 |
| 词条大师 | 累计装备过 50 种不同词条 | 大师随机词条 | 词条大师 | 大师池：`AFFIX_TREE[4]` 随机1（修正 `AFFIX_LEVELS[4]` 为配置对象） |
| 财富自由 | 累计获得 100 万金币（totalGoldEarned，含战斗/出售/任务奖励所有金币流入） | 100000 金币 | 金主 | |
| 转生者 | 完成 1 次转生 | 转生点 1（新增 `reincPoints`，与 `reincarnation` 次数分离） | 轮回者 | |
| 收集者 | 装备图鉴 50%（定义：`distinct equips collected / 20 模板 >=0.5`，按 `EQUIP_TEMPLATES` 20计，需10种；已与指南“装备图鉴 10种”同步） | 5000 金币 | 收藏家 | 去重按 `templateId`，含 `calculateIdle` 掉落与商店/任务获得 |

- 领取语义：达成→`unlocked=true`，需 `POST /quest/achievement/claim` 手动领取后 `claimed=true` 才发奖励/称号（称号写入 `player.titles[]` 并 `currentTitle` **必返**，初始 `null`，领取后 `currentTitle||=title`）；幂等，已领取重复请求返回 200 不重复发放。
- 迁移：`migratePlayer` 时对老存档执行 `checkAchievements` 补发 `unlocked`（初次冒险按 `createdAt` 存在即解锁）；历史 `totalGoldEarned/affixSeen/seenEquipTemplates` **不补算**，仅按当前 `killCount/level/godhood/reincarnation` 等可还原状态补 `unlocked`，后续增量才计入。

## 3. 涉及文件（严格限定，v4）

- `server/data.js` — 新增 `DAILY_QUESTS`、`ACHIEVEMENTS`、`DAILY_CHEST`、`INITIAL_MATERIAL_POOL`、精良/史诗/传说池、`AFFIX_TREE[4]` 相关常量与奖励池注释。
- `server/engine.js` — `migratePlayer` 追加 `dailyQuests/dailyResetAt/dailyChestClaimed/achievements/questStats:{totalGoldEarned, affixSeen: string[], seenEquipTemplates: string[]}/titles: string[]/currentTitle: string|null/reincPoints`，每日 `refreshDailyQuests`（`getNow` 0点），进度落点见§4，新增 `claimDaily/claimChest/claimAchievement/checkAchievements/grantExpWithLevelUp`，`createCharacter` 初始日常与初次冒险解锁。
- `server/index.js` — **固定** `POST /api/player/:username/quest/daily/:id/claim`、`POST /api/player/:username/quest/chest/claim`、`POST /api/player/:username/quest/achievement/:id/claim`；`GET /api/player/:username` 返回 `questView:{dailyQuests, chest:{need,claimed,canClaim,reward:null}, achievements:[{id,name,unlocked,claimed}], titles, currentTitle}`（`titles/currentTitle` 在 `questView` 内必返，与 `playerView` 顶层一致）。
- `server/store.js` — 无结构变更，仅 `player` 字段持久化（`Set` 已改为数组可 `JSON.stringify`）。
- `client/src/components/QuestView.vue` — 新建，全屏替换，4 列 12/页 底部翻页器（复用排行/策略样式），日常/成就两 Tab，进度条与领取按钮。
- `client/src/style.css` — 新增 `--quest-*` 若需，否则复用现有 `--lb-*`/`--accent`。
- `client/src/App.vue` / `client/src/api.js` — TabBar 新增“任务”入口与对应 `api` 方法。
- `server/quest.test.js` / `server/engine.quest.test.js` / `server/quest.route.test.js` — 新增日常重置/领取幂等/成就触发单测。
- 不新增其他系统。

## 4. 数据与落点（v4 明确可持久化与触发闭合）

```js
// data.js（静态）
DAILY_QUESTS = [{id:'hunt50', name:'每日狩猎', target:50, reward:{gold:500}}, {id:'battle20',...}, ... 6项]
DAILY_CHEST = { need:5 } // 需5项claimed，奖励待指南修订，本次仅状态
ACHIEVEMENTS = [{id:'first', name:'初次冒险', cond:{always:true}, reward:{gold:100}, title:'冒险者'}, ... 10项]

// player 扩展（migratePlayer 默认，全部可 JSON 持久化，字段名统一）
dailyQuests: [{id, progress, target, done, claimed}], dailyResetAt: 'YYYY-MM-DD', dailyChestClaimed: false,
achievements: { [id]: {unlocked:bool, claimed:bool, unlockAt:number, grantedTitle?:string} } // 所有称号领取时持久化，ascend 防漂移，展示固定为领取时称号,
questStats: { totalGoldEarned:number, affixSeen: string[], seenEquipTemplates: string[] }, // 数组去重，非 Set
titles: string[], currentTitle: string|null, reincPoints: number // grantedTitle 所有称号领取时持久化，ascend 防漂移
```

- 每日重置：`getTodayKey(getNow())` 按服务器 0 点 `YYYY-MM-DD`，**所有会更新日常状态或领取奖励的入口** `migratePlayer/getPlayerView/calculateIdle/allocateAttributes/equipAffix/unequipAffix/enchantItem/buyItem/equipItem/sellMaterial/sellEquip/claimDaily/claimChest/claimAchievement` 均先执行 `refreshDailyIfNeeded(player)` 再更新进度，避免跨零点操作被重置覆盖；成就检查 `checkAchievements` 则在 `grantGold/equipItem/buyItem/sell*/attemptAscension/doReincarnate` 等状态变更后立即执行；重建时 `dailyQuests` 6项 `progress=0/done=false/claimed=false` 并 `dailyChestClaimed=false`，过期未领取不补发。
- 进度更新落点（显式，含金币口径与立即解锁）：
  - `createCharacter`：初始化日常、当日 `dailyResetAt=today`、解锁 `first` 成就 `unlocked=true`，`questView` 初始化 `currentTitle=null`。
  - `grantGold(player, amount)` 统一入口：所有金币流入（`calculateIdle` 击杀金币、`sellMaterial/sellEquip` 出售、`claimDaily/claimAchievement` 金币奖励）均经此累加 `questStats.totalGoldEarned += amount` 并立即 `checkAchievements(player)`（财富自由 100万）。
  - `calculateIdle`：击杀数 `hunt50`、战斗场次 `battle20`（win/lose/timeout 均计1）、经 `grantGold` 累加、掉落装备经 `seenEquipTemplates` 去重、触发 `checkAchievements`（kill/level/gold/收集）。
  - `allocateAttributes`：`alloc1` 完成一次即 `done`，并 `checkAchievements`。
  - `equipAffix/unequipAffix`：`affix1` 完成一次；`affixSeen` 数组去重追加 `affixId`，用于 `词条大师` 50 去重计数，追加后立即 `checkAchievements`。
  - `enchantItem`：`enchant1`，完成后 `checkAchievements`。
  - `buyItem`：`buy1`，购买成功后 `seenEquipTemplates` 去重追加并 `checkAchievements`（收集者 10/20 立即解锁）。
  - `equipItem`（含 `calculateIdle` 掉落与 `buyItem` 装备分支）：`seenEquipTemplates` 去重追加 `templateId`，追加后立即 `checkAchievements`，无需等下一次挂机。
  - `sellMaterial/sellEquip`：经 `grantGold` 累加并 `checkAchievements`。
  - `attemptAscension`：登神后立即 `checkAchievements` 解锁 `登神之路`。
  - `doReincarnate`：转生后立即 `checkAchievements` 解锁 `转生者`，`reincPoints+=1` 于领取时发放（与 `reincarnation` 分离）。
  - 经验类奖励（`battle20` 200exp）通过 `grantExpWithLevelUp(player, exp)` 复用 `calculateIdle` 同款升级循环（`expToNext`、属性点、职业进阶日志），并于升级后 `checkAchievements`（满级）。
- 奖励领取（幂等，HTTP语义见§5）：`claimDaily(player,id)` 校验 `done&&!claimed` → 发放（金币/经验/材料）→ `claimed=true`；`claimChest` 校验 `claimedCount>=5 && !dailyChestClaimed`（本次仅标记已领取）；`claimAchievement` 校验 `unlocked&&!claimed` → 发放（金币/装备/词条/转生点）+ 写入 `titles` 并 `currentTitle||=title`；重复领取返回 200 不二次发放。

## 5. 交互时序与 API 契约（固定）

- 轮询：`GET /api/player/:username` 返回 `questView:{ dailyQuests:[{id,name,progress,target,done,claimed,reward}], chest:{need:5, claimed:dailyChestClaimed, canClaim, reward:null}, achievements:[{id,name,desc,unlocked,claimed,reward,title}], titles, currentTitle }`，`refreshDailyQuests` 已在服务端完成。
- 领取：`POST /api/player/:username/quest/daily/:id/claim` / `POST .../quest/chest/claim` / `POST .../quest/achievement/:id/claim` → 后端原子校验：未知id 404，未达成 409，已领取 200（幂等）→ 返回 `questView` 与 `playerView` → 前端刷新。
- 时序：挂机/操作 → `engine` 同步更新 `dailyQuests.progress`→ `done` → 前端轮询感知可领取 → 点击领取 → 发放并置 `claimed`。

## 6. 验收标准（v4）

- [ ] 日常 6 项各自 `progress/done` 实时更新，`done` 后可领取，次日 0 点重置且过期作废；所有变更入口均先日切
- [ ] 完成 5 项已领取后额外宝箱可领取（每日1次幂等，奖励待指南修订本次仅状态）
- [ ] 成就 10 项满足条件 `unlocked`，需手动领取后才发奖励/称号（`currentTitle` 必返回），重复领取 200 幂等；称号显示于角色名旁
- [ ] `totalGoldEarned` 含战斗/出售/任务所有流入；`affixSeen` 数组持久化 50 去重；`seenEquipTemplates` 去重 10/20 判定收集（含掉落）；经验奖励触发升级
- [ ] `QuestView.vue` 全屏替换，4 列 12/页、底部翻页器、遮罩关闭、`var(--*)` 动效与颜色
- [ ] `pnpm build`/`git diff --check` 通过，单测 `server/quest.test.js`（日常重置/领取409/已领取200/跨日过期）、`server/engine.quest.test.js`（奖励池/升级/收集10/20/迁移补发）与 `server/quest.route.test.js`（路由 404/409/200 via app.handle）

## 7. 风险与回退

- 风险：日常重置时区差异——以服务器 `getNow()` 0 点为准，前端仅展示。
- 回退：删除 `DAILY_QUESTS/ACHIEVEMENTS` 与 `QuestView` 入口即可。
