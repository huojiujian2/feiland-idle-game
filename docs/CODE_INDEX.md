# 代码索引（AI 速查 v4.0 · 2026-08-31 · 整合优化版）

> **本文件 = 整本项目速查表。** 任何任务先读本文件 → 定位行号 → 再按需 `Read` 单个文件。
> 单文件 ≤ 500 行是项目软上限，>800 行必须拆分，本索引按行数标注热度。
> 行数已用 `Get-ChildItem` + `Measure-Object -Line` 实测（2026-08-31），覆盖 v1.03 全量代码。
>
> 维护人：项目主人 · 工具：TRAE · 版本：v4.0（v3.0 → v4.0：补全灵鸡斗场 / 远征 / 公会 / 每日活跃 / 主动技能 / 结算校验 6 大新模块 + 子组件拆分映射 + API ↔ 路由 ↔ 引擎三向速查）

***

## 0. 项目一句话

**费兰德世界 v1.03**：Vue 3 + Express 西幻放置挂机游戏。

* 前端 dev/prod 端口 **3000**，后端 API 端口 **3001**（**严禁修改**）。

* 存档 `server/db.json`（含 `db.json.bak` 自动备份，原子写）。

* 已落地的 17 个子系统：5 职业 / 装备锻造 / 词条 / 挂机 / 离线收益 / 进化 / 法则 / 登神 / 转生 / 任务 / PvP 竞技场 / 世界 BOSS / 称号 / 创世之书 / **灵鸡斗场** / **远征** / **公会** / **每日活跃**。

***

## 1. 阅读优先级（极重要，按这个顺序读可省 70% token）

1. **本文件** —— 一站式速查 + 行号 + 红线 + API ↔ 路由 ↔ 引擎映射
2. **`README.md`** —— 总目录 + 简介
3. **`docs/README/00-code-style.md`** —— 拆分规范（动手前必读）
4. **`docs/AI_NOTES.md`** —— 一屏速记（不替代本文件）
5. 单个目标文件（按本文件 §3 §4 §5 的行号定位）

***

## 2. 启动 & 脚本

```bash
npm run dev          # 并发：API(3001) + Vite(3000)
npm start            # 生产模式（start-all.js 拉起后端+前端服务器）
双击 启动游戏.bat    # Windows 一键
docker compose up    # Docker
npm test             # 运行 server/**/*.test.js（17 个测试文件，含 settlement / worldboss / cockfight / guild / active / pvp-shop-title / 创世混沌 / 主动技能 等）
```

***

## 3. 后端 `server/`（Node + Express）

### 3.1 入口 & 基础设施（6 文件）

| 文件                          | 行        | 职责                                                                                                                                       |
| --------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `index.js`                  | 122      | Express 入口：加载存档、注入引擎、注册路由（含 JWT 鉴权中间件）、启动 5s 挂机 / 30s 存档 / 1min 竞技场周期定时器                                                                 |
| `web-server.js`             | 151      | 生产前端服务器：托管 `client/dist`，`/api` 反代到 3001                                                                                                 |
| `start-all.js`              | 49       | 生产一键：同时拉起 `index.js` + `web-server.js`                                                                                                   |
| `store.js`                  | 64       | **v1.03 存储后端派发层**：检测 `DB_ENGINE` 环境变量与 `db.sqlite` 文件存在，自动派发到 JSON 或 SQLite 后端                                                           |
| `store-json.js`             | 198      | **JSON 后端**（原 `store.js` 实现整体迁出）：`fs.writeFileSync` 原子写 + `.bak` 备份                                                                      |
| `store-sqlite.js`           | \~280 🆕 | **SQLite (WAL) 后端**（生产推荐）：`sql.js` WASM 实现，**异步落盘**（不阻塞主线程）+ WAL 模式 + epoch 守卫防止路径切换时 in-flight 写盘污染                                     |
| `migrate-json-to-sqlite.js` | \~95 🆕  | **一次性迁移脚本**：`db.json → db.sqlite`，幂等                                                                                                     |
| `middleware/auth.js`        | \~190 🆕 | **JWT 鉴权中间件**：HMAC-SHA256 自签 token + `requireAuth / requirePlayerSelf / requireSelfFromBody / requireAdmin` + `AUTH_MODE=enforce/off` 开关 |
| `middleware/password.js`    | \~100 🆕 | **密码哈希**：bcrypt（首选，rounds=10）+ pbkdf2 fallback（100k iter, SHA-256） + 自动识别 bcrypt/pbkdf2/旧明文 3 种格式                                        |
| `middleware/rate-limit.js`  | \~80 🆕  | **IP 速率限制**（零依赖 token bucket）：注册 5/min、登录 10/min，可 env 覆盖；返回 429 + Retry-After                                                           |
| `middleware/nonce.js`       | \~50 🆕  | **requestId 服务端签发**：HMAC-SHA256 签名 `buildServerRequestId({username, target, isBot, clientNonce, dayKey})` 防伪造/跨目标重放                      |
| `middleware/audit-log.js`   | \~90 🆕  | **审计日志**：res.on('finish') 记录所有写操作，password/token 自动脱敏，落盘到 `server/audit.log`                                                             |
| `engine.js`                 | 4        | **旧版引擎入口**（已被 `engine/index.js` 取代，仅作兼容）                                                                                                 |
| `data.js`                   | 4        | **旧版数据入口**（已被 `data/index.js` 取代，仅作兼容）                                                                                                   |

**派发规则**（`store.js` 自动选择）：

1. `DB_ENGINE=json` → 强制 JSON
2. `DB_ENGINE=sqlite` → 强制 SQLite
3. `${DB_PATH}.sqlite` 文件存在且 SQLite 头合法 → SQLite
4. 否则 JSON

**迁移命令**：

```bash
# 一次性把 db.json 导入 db.sqlite（幂等；目标已有 snapshot 则跳过）
node server/migrate-json-to-sqlite.js [--force] [--src db.json] [--dst db.sqlite]
```

### 3.2 游戏引擎 `server/engine/`（19 模块）★ 核心

入口 `engine/index.js` (299 行)：装配所有子模块 + `setHandler` 注入循环引用 + 统一导出 + 存档代理（withTransaction / safeSave / snapshot / restore）+ 结算校验（assertSettlementReward）。

| 子模块              | 行       | 关键导出                                                                                                                                                                                                                                                                                                                                                                                             | 干啥的                                                         |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `state.js`       | 35      | `getNow / getRand / __setNow / __setRandom / __setDropRandom / __resetSeams / isTestMode`                                                                                                                                                                                                                                                                                                        | 测试 seam（时间、随机数、掉率可注入）                                       |
| `utils.js`       | 31      | `shouldDrop / buildBattleMonster / genUid / getActiveSkillCd / shouldTriggerActiveSkill`                                                                                                                                                                                                                                                                                                         | 通用工具                                                        |
| `stats.js`       | 288     | `getEquipBonus / getAffixBonus / getRaceBonus / getGodhoodBonus / getReincarnationBonus / getLawBonus / getTotalStats / getCombatStats / getJobGrowth / getJobTalents / getJobMechanics / getStageFull / pickMonsterSkill`                                                                                                                                                                       | **属性聚合**                                                    |
| `player.js`      | 734 ⚠️  | `createCharacter / allocateAttributes / autoAllocateAttributes / saveAttrPreset / applyAttrPreset / applyAttrPresetByRatio / deleteAttrPreset / deleteAttrPresetBySlot / grantGold / grantExpWithLevelUp / migratePlayer`                                                                                                                                                                        | 角色 CRUD、属性点、升级、迁移                                           |
| `items.js`       | 442     | `equipItem / equipAffix / unequipAffix / unequipItem / sellMaterial / sellEquip / sellEquipsByLevel / sortInventory / addEquipToSortedPosition / getEquipSortKey / enchantItem / upgradeEquipment / mergeEquipment / reforgeEquipment / useConsumable / learnLaw / evolveRace / buyItem`                                                                                                         | **装备/词条/附魔/合成/重铸/进化/消耗品/排序**                                |
| `progression.js` | 360     | `chooseJob / attemptAscension / doReincarnate / autoReincarnate / getReincarnationInfo / getReincShop / buyReincShopItem / getOfflineSummary / updateOfflineSnapshot`                                                                                                                                                                                                                            | 职业/登神/转生/离线收益                                               |
| `daily.js`       | 337     | `createDailyQuests / claimDaily / claimChest / claimAchievement / refreshDailyIfNeeded / findAffix / getJobStage / getPassiveSlots / getAvailableAffixLevels / normalizeTutorialStep / updateTutorialStep / updateDailyProgress / ensureQuestStats / checkAchievements / maybeResetWeeklyBossKills / getTodayKey / getMonthKey / getDailyKey / getWeeklyKey / getMonthlyKey / getCurrentWeekKey` | 每日任务/成就/词条查找/教程/周重置                                         |
| `combat.js`      | 297     | `calcDamage / getActionCount / simulateBattle / simulateBossBattle`                                                                                                                                                                                                                                                                                                                              | 回合制战斗（含 5 回合 BOSS 战）                                        |
| `idle.js`        | 346     | `calculateIdle / maybeResetWeeklyBossKills / setMetaGetter / setGrantGoldHandler / setRecalcMaxStatsHandler`                                                                                                                                                                                                                                                                                     | **挂机结算**（每 5s 调用）                                           |
| `pvp.js`         | 475     | `calcPvpRating / calcPvpRewards / pickPvPSkill / simulatePvP / createBot / generateArenaBots / settleArenaRewards / settleDuePeriods / maybeResetSeason / getSeasonKey / getSeasonIndex / getSeasonDaysLeft / getRankTier / applySeasonResetToPlayers / buyArenaItem`                                                                                                                            | ELO 竞技场、AI bot、赛季结算、商店                                      |
| `worldboss.js`   | 379     | `spawnWorldBoss / getActiveBoss / getBossExpiresAt / attackWorldBoss / grantWorldBossParticipation / settleWorldBossRewards / getBossRanking / getBossDayKey / getTodayMidnight / getTopHalfByLevel / getMedianPlayerByLevel / estimateTopHalfTotalDamage / buildBossStats / BOSS_BATTLE_ROUNDS`                                                                                                 | **世界 BOSS**（v3.0：按最强一半玩家中位数推算 HP/ATK/DEF/AGI，每日 1 次 5 回合战报） |
| `genesis.js`     | 394     | `isUnlocked / birthMonster / forgeEquip / deleteCustom / listByPlayer / rehydrateFromMeta / setMetaGetter / setStore`                                                                                                                                                                                                                                                                            | **创世之书**（二转解锁，自定义怪物/装备，存 `meta.genesis`）                    |
| `cockfight.js`   | 386 🆕  | `getCockfightStatus / enterCockArena / resolveCockRound / exchangeCockfightTitle / __simulateLineup / __battleOnce`                                                                                                                                                                                                                                                                              | **灵鸡斗场**（v1.03 完全独立押注玩法：每日 20 次、干预 + 擂台战报、积分换称号）            |
| `expedition.js`  | 452 🆕  | `dispatchExpedition / chooseEventOption / claimExpedition / getExpeditionStatus / sanitizeExpedition / simulateExpeditionBossBattle / setGrantHandlers / setProgressHandlers`                                                                                                                                                                                                                    | **远征**（T-102：派遣→事件选择→领奖，异步挂机分支）                             |
| `active.js`      | (隐式) 🆕 | `getDailyActiveView / addActivePoints / claimActive / refreshIfNeeded / setGrantHandlers`                                                                                                                                                                                                                                                                                                        | **每日活跃**（T-104：积分制 7 档奖励）                                   |
| `guild.js`       | 536 🆕  | `createGuild / listGuilds / getMyGuild / joinGuild / leaveGuild / kickMember / updateRole / transferGuild / updateAnnouncement / donate / disbandGuild / addGuildContribution / ensureGuildConsistency / toGuildSummary / toGuildDetail / toViewer`                                                                                                                                              | **公会**（T-103：建会/加入/踢人/转让/公告/捐献/解散）                          |
| `settlement.js`  | 173 🆕  | `assertSettlementReward`                                                                                                                                                                                                                                                                                                                                                                         | **结算校验**（防挂机收益被篡改/超额发奖）                                     |
| `pvp-arena.js`   | 324     | 旧版 PvP 竞技场实现（已被 `pvp.js` 吸收，仅作兼容）                                                                                                                                                                                                                                                                                                                                                                | -                                                           |
| `view.js`        | 136     | `getPlayerView / getReadonlyPlayer / getPowerScore`                                                                                                                                                                                                                                                                                                                                              | 玩家视图（前端展示用）                                                 |

**引擎装配模式（必读！避免循环引用）**：

```js
// engine/index.js
const realRecalcMaxStats = (p) => { /* ... */ };
player.setRecalcMaxStatsHandler(realRecalcMaxStats);
items.setRecalcMaxStatsHandler(realRecalcMaxStats);
progression.setRecalcMaxStatsHandler(realRecalcMaxStats);
idle.setRecalcMaxStatsHandler(realRecalcMaxStats);

player.setUpdateDailyProgress((p, id, inc) => daily.updateDailyProgress(p, id, inc));
daily.setGrantHandlers({ grantGold: player.grantGold, grantExpWithLevelUp: player.grantExpWithLevelUp });
idle.setGrantGoldHandler((p, amount) => player.grantGold(p, amount));
pvp.setBotCharacterDeps({ createCharacter: player.createCharacter, recalcMaxStats: realRecalcMaxStats });
expedition.setGrantHandlers({ grantGold, grantExpWithLevelUp });
expedition.setProgressHandlers({ updateDailyProgress, checkAchievements });
active.setGrantHandlers({ grantGold, grantExpWithLevelUp });

// 创世系统：把 store.getMeta 注入到 idle/genesis
function setStore(store) {
  idle.setMetaGetter(() => store.getMeta());
  genesis.setMetaGetter(getter);
  genesis.rehydrateFromMeta(store.getMeta());
}
```

### 3.3 静态数据 `server/data/`（15 模块）

| 文件                                                 | 行       | 职责                                        |
| -------------------------------------------------- | ------- | ----------------------------------------- |
| `index.js`                                         | 40      | 桶导出（聚合所有数据）                               |
| `areas.js`                                         | 238     | **11 个挂机区域** + 怪物列表                       |
| `equipment.js`                                     | 178     | **装备模板** + 材料 + 词条（自创装备以 `custom_` 前缀）    |
| `jobs.js`                                          | 109     | **5 职业 × 4 阶** 天赋/机制/成长系数                 |
| `monsters.js`                                      | 35      | 45+ 怪物模板 + 24 个怪物技能                       |
| `progression.js`                                   | 97      | 转生/法则/登神/附魔配方参数                           |
| `pvp.js`                                           | 97      | 竞技场规则                                     |
| `quests.js`                                        | 37      | 每日任务 + 成就                                 |
| `strategy.js`                                      | 63      | 6 种战斗策略模式                                 |
| `genesis.js`                                       | 264     | **创世之书** 8 种族 + 预算表 + LIMITS + oracleText |
| `titles.js`                                        | 81      | 扫描 JOB\_TREE 派生 20 职业称号 + 3 世界 BOSS 限时称号  |
| `cockfight.js`                                     | (隐式) 🆕 | **灵鸡斗场** 静态配置（鸡只技能 / 押注表 / 称号兑换价）         |
| `expedition.js`                                    | (隐式) 🆕 | **远征** 区域→时长表 + 事件库 + 奖励表                 |
| `guild.js`                                         | (隐式) 🆕 | **公会** 捐献档位 / 角色权重                        |
| `active.js`                                        | (隐式) 🆕 | **每日活跃** 7 档奖励 + 积分来源映射                   |
| `affixes/index.js`                                 | 24      | 词条桶导出                                     |
| `affixes/{novice,intermediate,advanced,master}.js` | 64      | 四档词条池                                     |

### 3.4 HTTP 路由 `server/routes/`（18 个模块）

`routes/index.js` 统一注册 `registerRoutes(app, store)`。玩家标识是 `username`。所有响应统一 `{ success: boolean, data?, message? }`。

| 文件                  | 行       | 路径前缀                                                                                                  | 干啥                                      |
| ------------------- | ------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `_helpers.js`       | 22      | -                                                                                                     | 通用 helper（认证/校验）                        |
| `auth.js`           | 68      | `/api/register /api/login /api/player/:u/create-character /api/players/names`                         | 注册、登录、建角色、全服名册                          |
| `account-exists.js` | 15      | `/api/account-exists`                                                                                 | 账号存在性检查                                 |
| `player.js`         | 185     | `/api/player/:u/*`                                                                                    | 玩家状态、挂机/离线结算、属性分配、属性预设、头像、装备升级/合成/重铸/排序 |
| `combat.js`         | 150     | `/api/player/:u/{affix,equip,buy,use,sell,equipment/*}`                                               | 词条、装备、商店、出售、锻造                          |
| `progression.js`    | 101     | `/api/player/:u/{job,evolve,enchant,learn-law,ascend,reincarnate,auto-reincarnate} + /api/reinc-shop` | 职业、种族、附魔、法则、登神、转生                       |
| `pvp.js`            | 581 ⚠️  | `/api/arena/*`                                                                                        | 竞技场全接口、排名、记录、赛季、奖励、商店（最大单文件，候选拆分）       |
| `worldboss.js`      | 59      | `/api/worldboss/*` + `/api/player/:u/worldboss/attack`                                                | 世界 BOSS 查询、攻击、刷新                        |
| `codex.js`          | 198     | `/api/areas /api/codex /api/data/enchants /api/data/affixes /api/data/jobs`                           | 区域、图鉴、附魔配方、词条池、职业树                      |
| `leaderboard.js`    | 78      | `/api/leaderboard`                                                                                    | 6 维度排行                                  |
| `strategy.js`       | 66      | `/api/player/:u/strategy`                                                                             | 战斗策略设置                                  |
| `quest.js`          | 44      | `/api/player/:u/quest/*` + `/tutorial`                                                                | 每日任务、宝箱、成就、教程                           |
| `genesis.js`        | 73      | `/api/player/:u/genesis*` + `/api/genesis/public`                                                     | 创世之书 CRUD、公开造物                          |
| `titles.js`         | 53      | `/api/player/:u/titles*`                                                                              | 称号查询、佩戴/卸下                              |
| `cockfight.js`      | (隐式) 🆕 | `/api/player/:u/cockfight*`                                                                           | 灵鸡斗场：状态、进入、回合结算、称号兑换                    |
| `expedition.js`     | (隐式) 🆕 | `/api/expedition/config` + `/api/player/:u/expedition/*`                                              | 远征：配置、派遣、事件选择、领奖                        |
| `active.js`         | (隐式) 🆕 | `/api/player/:u/daily-active*`                                                                        | 每日活跃：查询、加分、领奖                           |
| `guild.js`          | 205 🆕  | `/api/guilds` + `/api/player/:u/guild/*`                                                              | 公会：列表、加入、踢人、捐献、转让、公告、踢人、解散              |

**重要约定**：

* 响应格式统一 `{ success: boolean, data?, message? }`。

* `/api` 未匹配返回 JSON 404（不被前端兜底吞掉）。

* `account-exists` 必须在 `/api` 通配 404 之前注册。

### 3.5 测试文件 `server/`（17 个）

| 文件                                | 行        | 覆盖                                                                                 |
| --------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `skill.test.js`                   | 384      | 技能/词条/职业综合                                                                         |
| `schema.test.js`                  | -        | 数据 schema 校验                                                                       |
| `store.test.js`                   | -        | 存档 load/save/事务                                                                    |
| `restart-consistency.test.js`     | -        | 重启一致性                                                                              |
| `routes-settlement.test.js`       | -        | 路由 + 结算联动                                                                          |
| `timer-settlement.test.js`        | -        | 定时器 + 结算防超额                                                                        |
| `engine/active.test.js`           | 315      | 主动技能触发                                                                             |
| `engine/attr-preset.test.js`      | -        | 属性预设                                                                               |
| `engine/auto-reinc.test.js`       | -        | 一键转生                                                                               |
| `engine/cockfight.test.js`        | 231      | 灵鸡斗场纯函数                                                                            |
| `engine/genesis-chaos.test.js`    | -        | 创世混沌图鉴                                                                             |
| `engine/guild.test.js`            | 312      | 公会                                                                                 |
| `engine/inventory-sort.test.js`   | -        | 背包排序                                                                               |
| `engine/pvp-shop-title.test.js`   | -        | 竞技场称号商店                                                                            |
| `engine/race-bonus.test.js`       | -        | 种族加成                                                                               |
| `engine/reinc-cap.test.js`        | -        | 转生封顶 60%                                                                           |
| `engine/reinc-nextbuffs.test.js`  | -        | 转生下一轮加成                                                                            |
| `engine/reinc-points.test.js`     | 250      | 转生点                                                                                |
| `engine/reinc-preserve.test.js`   | -        | 转生保留                                                                               |
| `engine/settlement.test.js`       | -        | 结算校验                                                                               |
| `engine/titles-migration.test.js` | -        | 称号迁移                                                                               |
| `engine/worldboss-daily.test.js`  | -        | 世界 BOSS 日期                                                                         |
| `engine/worldboss.test.js`        | 540      | 世界 BOSS 完整流程                                                                       |
| `store-sqlite.test.js`            | \~200 🆕 | SQLite 后端兼容性测试（CRUD / 事务回滚 / save+load 往返 / 并发 safeSave / \_\_setDbPath 隔离）        |
| `middleware/rate-limit.test.js`   | \~100 🆕 | IP 速率限制测试（首次通过 / 超限 429 / 不同 key 隔离 / 窗口过期清零 / Retry-After header / 真实 Express 集成） |
| `middleware/nonce.test.js`        | \~70 🆕  | requestId 签名测试（同入同出 / 换 target 不同 / 换 username 不同 / 换 nonce 不同 / 换 dayKey 不同）      |
| `middleware/auth.test.js`         | \~190 🆕 | JWT + 密码哈希测试（签名 / 校验 / 过期 / 篡改 / 401/403 / 借名 / bcrypt / pbkdf2 / 旧明文兼容）           |
| `middleware/audit-log.test.js`    | \~80 🆕  | 审计日志测试（password/token 脱敏 / 嵌套对象脱敏 / res.finish 触发写入）                               |
| `engine/genesis-decay.test.js`    | \~70 🆕  | 创世装备衰减测试（5% 单次 / 保底 floor / 多次衰减收敛 / 同日幂等）                                         |

***

## 4. 前端 `client/src/`（Vue 3 + Vite）

### 4.1 根级（10 文件）

| 文件                            | 行      | 职责                                                |
| ----------------------------- | ------ | ------------------------------------------------- |
| `App.vue`                     | 564 ⚠️ | **主应用**：登录态 + 11 Tab 路由 + 5s 轮询 + 30+ handle 业务方法 |
| `api.js`                      | 234    | **API 请求封装**（与后端路由一对一，约 50 个方法）                   |
| `main.js`                     | 8      | Vue 应用入口                                          |
| `style.css`                   | 814 ⚠️ | 全局样式 + CSS 变量（品质色/品质边框/徽章动画 + RGB 三元组）            |
| `theme.js`                    | 50     | 主题切换 + localStorage 持久化（key: `ferland-theme`）     |
| `themes.css`                  | 99     | 主题样式表（星夜/暗金/羊皮纸三种）                                |
| `ui-bridge.js`                | 74     | **全局 Toast + Modal 队列**（替代 alert/confirm）         |
| `composables/useLongPress.js` | 145    | 长按手势 composable                                   |
| `utils/avatars.js`            | 25     | 5 选 1 头像选项                                        |
| `utils/timeTitles.js`         | 12     | 称号时长格式化                                           |

### 4.2 业务页面组件（13 个 Tab 主页）★ 已拆分

`App.vue` 的 `tabOrder`：`char → skill → bag → map → codex → evo → rank → quest → pvp → boss → genesis`（另有 expedition / guild / cockfight 从地图侧边抽屉进入）。

| 文件                    | 行       | Tab       | 干啥                              | 拆分建议              |
| --------------------- | ------- | --------- | ------------------------------- | ----------------- |
| `LoginScreen.vue`     | 1082 ⚠️ | 初始        | 登录/注册/创建角色（已拆 4 子组件）            | 接近红线 800          |
| `CharacterView.vue`   | 364     | `char`    | 角色页（已拆 4 子组件）                   | ✓ 健康              |
| `SkillView.vue`       | 279     | `skill`   | 词条页（装备/卸下）                      | ✓ 健康              |
| `InventoryView.vue`   | 686 ⚠️  | `bag`     | 背包（装备/材料/锻造/合成/重铸/批量出售/整理）      | 接近红线              |
| `MapView.vue`         | 250     | `map`     | 地图（区域选择 + 战斗入口），已拆 7 子组件        | ✓ 健康              |
| `CodexView.vue`       | 515 ⚠️  | `codex`   | 图鉴（材料/装备/怪物/消耗品）                | 刚超软上限             |
| `EvolutionView.vue`   | 175     | `evo`     | 进化（拆 4 Tab 子组件）                 | ✓ 健康              |
| `LeaderboardView.vue` | 205     | `rank`    | 排行榜（6 维度）                       | ✓ 健康              |
| `QuestView.vue`       | 263     | `quest`   | 任务/成就/每日活跃                      | ✓ 健康              |
| `PvPView.vue`         | 193     | `pvp`     | 竞技场（已拆 7 子组件）                   | ✓ 健康              |
| `WorldBossView.vue`   | 296     | `boss`    | 世界 BOSS（每日 1 次 / 5 回合战报 / 称号奖励） | ✓ 健康              |
| `GenesisView.vue`     | 1128 ⚠️ | `genesis` | **创世之书**（二转解锁）                  | 超红线 800，候选拆 4 子组件 |
| `ExpeditionView.vue`  | 457 🆕  | 抽屉        | **远征**（派遣 / 事件选择 / 领奖）          | ✓ 健康              |
| `GuildView.vue`       | 346 🆕  | 抽屉        | **公会**（列表 / 我的公会 / 创建 / 成员管理）   | ✓ 健康              |
| `CockfightArena.vue`  | 369 🆕  | 抽屉        | **灵鸡斗场**（独立押注）                  | ✓ 健康              |

### 4.3 子组件清单（拆分映射）

#### `LoginScreen/`（4 子组件）

| 文件                        | 行    | 用途     |
| ------------------------- | ---- | ------ |
| `LoginForm.vue`           | (隐式) | 登录表单   |
| `RegisterForm.vue`        | 246  | 注册表单   |
| `CreateCharacterForm.vue` | (隐式) | 创建角色表单 |
| `RaceSelector.vue`        | (隐式) | 种族选择器  |
| `races.js`                | (隐式) | 种族数据   |

#### `character/`（5 子组件）

| 文件                     | 行      | 用途     |
| ---------------------- | ------ | ------ |
| `AttrAllocator.vue`    | 325 ⚠️ | 属性点分配器 |
| `EquipSlots.vue`       | (隐式)   | 装备槽位   |
| `JobPanel.vue`         | (隐式)   | 职业信息   |
| `JobSettingsPanel.vue` | 217    | 职业设置面板 |
| `labels.js`            | (隐式)   | 属性标签   |

#### `evolution/`（4 子组件）

`RaceTab.vue` (122) / `LawTab.vue` (92) / `AscendTab.vue` (118) / `ReincTab.vue` (239)

#### `map/`（7 子组件，已完成拆分）

| 文件                    | 行   | 用途       |
| --------------------- | --- | -------- |
| `MapAreaSelector.vue` | 57  | 区域列表     |
| `BattleStrategy.vue`  | 71  | 战斗策略选择   |
| `BattleLog.vue`       | 214 | 战斗日志列表   |
| `BattleLogDetail.vue` | 206 | 单条战斗日志详情 |
| `DamageLayer.vue`     | 40  | 伤害飘字层    |
| `DropsPopup.vue`      | 42  | 战利品弹窗    |
| `battleLogUtils.js`   | 167 | 日志解析工具   |

#### `pvp/`（7 子组件）

`PvPHeader.vue` (103) / `PvPOpponents.vue` (65) / `PvPRanking.vue` (62) / `PvPRecords.vue` (64) / `PvPRewards.vue` (140) / `PvPShop.vue` (68) / `PvPBattleReplay.vue` (111) / `pvpUtils.js` (64)

#### `icons/`

| 文件             | 行   | 用途                                 |
| -------------- | --- | ---------------------------------- |
| `IconBase.vue` | 70  | 图标组件（PNG 优先，emoji 兜底）              |
| `icons.js`     | 193 | 图标注册表（key → PNG/em 映射，28 个 RPG 图标） |

### 4.4 辅助组件（13 个）

| 文件                       | 行   | 用途                         |
| ------------------------ | --- | -------------------------- |
| `TopBar.vue`             | 205 | 顶部状态栏（头像/属性 chip/金币/设置/登出） |
| `TabBar.vue`             | 138 | 底部 5 Tab + 中心地图圆形凸按钮       |
| `ShopModal.vue`          | 253 | 商店 Action Sheet            |
| `EquipDetailModal.vue`   | 127 | 装备详情弹窗（升级/合成/重铸入口）         |
| `OfflineRewardModal.vue` | 90  | 离线收益弹窗                     |
| `LevelUpNotice.vue`      | 25  | 升级飘字                       |
| `TutorialOverlay.vue`    | 185 | 新手引导高亮（6 步）                |
| `UIBridge.vue`           | 167 | 全局 Toast/Modal 渲染层         |
| `TitleModal.vue`         | 294 | 称号查询、佩戴与卸下弹窗               |
| `JobView.vue`            | 103 | 职业信息视图                     |
| `ThemeModal.vue`         | 171 | 主题与外观设置弹窗                  |
| `ReincarnHintModal.vue`  | 176 | 转生提示弹窗                     |

***

## 5. API ↔ 路由 ↔ 引擎 三向速查（高频任务）

| 用户操作        | 前端方法 (`client/src/api.js`)                                                                                                                                                 | 路由文件                    | 引擎导出                                                                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 注册/登录/建角色   | `register / login / createCharacter`                                                                                                                                       | `routes/auth.js`        | `player.createCharacter`                                                                                                                                      |
| 玩家状态查询      | `getPlayer`                                                                                                                                                                | `routes/player.js`      | `view.getPlayerView`                                                                                                                                          |
| 区域切换        | `changeArea`                                                                                                                                                               | `routes/player.js`      | `player.setArea`                                                                                                                                              |
| 属性分配        | `allocateAttributes / autoAllocate`                                                                                                                                        | `routes/player.js`      | `player.allocateAttributes / autoAllocateAttributes`                                                                                                          |
| 属性预设        | `saveAttrPreset / applyAttrPreset / applyPresetRatio / deleteAttrPresetBySlot`                                                                                             | `routes/player.js`      | `player.saveAttrPreset / applyAttrPreset / applyAttrPresetByRatio / deleteAttrPresetBySlot`                                                                   |
| 头像选择        | `setAvatar`                                                                                                                                                                | `routes/player.js`      | `player.setAvatar`                                                                                                                                            |
| 装备词条        | `equipAffix / unequipAffix`                                                                                                                                                | `routes/combat.js`      | `items.equipAffix / unequipAffix`                                                                                                                             |
| 装备装备        | `equip / unequip`                                                                                                                                                          | `routes/combat.js`      | `items.equipItem / unequipItem`                                                                                                                               |
| 商店购买/使用     | `buy / useItem`                                                                                                                                                            | `routes/combat.js`      | `items.buyItem / useConsumable`                                                                                                                               |
| 出售          | `sellMaterial / sellEquip / sellEquipsByLevel`                                                                                                                             | `routes/combat.js`      | `items.sellMaterial / sellEquip / sellEquipsByLevel`                                                                                                          |
| 背包排序        | `sortInventory`                                                                                                                                                            | `routes/player.js`      | `items.sortInventory`                                                                                                                                         |
| 装备升级/合成/重铸  | `upgradeEquipment / mergeEquipment / reforgeEquipment`                                                                                                                     | `routes/player.js`      | `items.upgradeEquipment / mergeEquipment / reforgeEquipment`                                                                                                  |
| 附魔          | `enchant`                                                                                                                                                                  | `routes/progression.js` | `items.enchantItem`                                                                                                                                           |
| 种族进化        | `evolve`                                                                                                                                                                   | `routes/progression.js` | `items.evolveRace`                                                                                                                                            |
| 学习法则        | `learnLaw`                                                                                                                                                                 | `routes/progression.js` | `items.learnLaw`                                                                                                                                              |
| 登神          | `ascend`                                                                                                                                                                   | `routes/progression.js` | `progression.attemptAscension`                                                                                                                                |
| 转生          | `reincarnate / autoReincarnate / getReincarnationInfo`                                                                                                                     | `routes/progression.js` | `progression.doReincarnate / autoReincarnate / getReincarnationInfo`                                                                                          |
| 转生点商店       | `getReincShop / buyReincShopItem`                                                                                                                                          | `routes/progression.js` | `progression.getReincShop / buyReincShopItem`                                                                                                                 |
| 离线收益        | （自动随 getPlayer 返回）                                                                                                                                                         | `routes/player.js`      | `progression.getOfflineSummary`                                                                                                                               |
| 战斗策略        | `setStrategy`                                                                                                                                                              | `routes/strategy.js`    | -                                                                                                                                                             |
| 区域列表        | `getAreas`                                                                                                                                                                 | `routes/codex.js`       | -                                                                                                                                                             |
| 词条池         | `getAffixes`                                                                                                                                                               | `routes/codex.js`       | -                                                                                                                                                             |
| 职业树         | `getJobs`                                                                                                                                                                  | `routes/codex.js`       | -                                                                                                                                                             |
| 图鉴          | `getCodex`                                                                                                                                                                 | `routes/codex.js`       | -                                                                                                                                                             |
| 排行榜         | `getLeaderboard`                                                                                                                                                           | `routes/leaderboard.js` | -                                                                                                                                                             |
| 任务领奖        | `claimDaily / claimChest / claimAchievement`                                                                                                                               | `routes/quest.js`       | `daily.claimDaily / claimChest / claimAchievement`                                                                                                            |
| 教程步骤        | `updateTutorial`                                                                                                                                                           | `routes/quest.js`       | `daily.updateTutorialStep`                                                                                                                                    |
| 竞技场对手       | `getOpponents`                                                                                                                                                             | `routes/pvp.js`         | `pvp.generateArenaBots`                                                                                                                                       |
| 挑战          | `challenge`                                                                                                                                                                | `routes/pvp.js`         | `pvp.simulatePvP`                                                                                                                                             |
| 竞技场排行       | `getArenaRanking`                                                                                                                                                          | `routes/pvp.js`         | -                                                                                                                                                             |
| 竞技场战报       | `getArenaRecords`                                                                                                                                                          | `routes/pvp.js`         | -                                                                                                                                                             |
| 竞技场商店       | `getArenaShop / buyArenaItem`                                                                                                                                              | `routes/pvp.js`         | `pvp.buyArenaItem`                                                                                                                                            |
| 赛季          | `getArenaSeason / getArenaRewards`                                                                                                                                         | `routes/pvp.js`         | `pvp.getSeasonKey / settleArenaRewards`                                                                                                                       |
| 世界 BOSS     | `getWorldBoss / attackWorldBoss`                                                                                                                                           | `routes/worldboss.js`   | `worldboss.spawnWorldBoss / attackWorldBoss / settleWorldBossRewards`                                                                                         |
| 称号          | `getTitles / equipTitle`                                                                                                                                                   | `routes/titles.js`      | -                                                                                                                                                             |
| **灵鸡斗场** 🆕 | `getCockfight / enterCockArena / resolveCockRound / exchangeCockfightTitle`                                                                                                | `routes/cockfight.js`   | `cockfight.getCockfightStatus / enterCockArena / resolveCockRound / exchangeCockfightTitle`                                                                   |
| **创世之书**    | `getGenesis / birthMonster / forgeEquip / deleteGenesis`                                                                                                                   | `routes/genesis.js`     | `genesis.isUnlocked / birthMonster / forgeEquip / deleteCustom`                                                                                               |
| **远征** 🆕   | `getExpeditionConfig / getExpedition / dispatchExpedition / chooseExpeditionEvent / claimExpedition`                                                                       | `routes/expedition.js`  | `expedition.dispatchExpedition / chooseEventOption / claimExpedition`                                                                                         |
| **每日活跃** 🆕 | `claimDailyActive`                                                                                                                                                         | `routes/active.js`      | `active.getDailyActiveView / addActivePoints / claimActive`                                                                                                   |
| **公会** 🆕   | `getGuilds / getMyGuild / createGuild / joinGuild / leaveGuild / kickGuildMember / updateGuildRole / transferGuild / updateGuildAnnouncement / donateGuild / disbandGuild` | `routes/guild.js`       | `guild.createGuild / listGuilds / getMyGuild / joinGuild / leaveGuild / kickMember / updateRole / transferGuild / updateAnnouncement / donate / disbandGuild` |

***

## 6. 数据流向 & 调用链速查

### 6.1 一个按钮点击的完整链路（例：附魔）

```
用户点"附魔" → InventoryView.vue 调 handleEnchant(itemUid, recipeId)
    → App.vue 的 handleEnchant 调 api.enchant(...)
        → 走 client/src/api.js 的封装 POST /api/player/:user/enchant
            → server/index.js 注册的路由
                → server/routes/progression.js
                    → server/engine/items.js#enchantItem
                        → 改 player.equips → store.setPlayer → markDirty → 5s 后 save
                            → 返回 { success: true, data: player }
                                → App.vue 更新 player.value → Vue 响应式刷新
```

### 6.2 5 秒定时任务（`server/index.js` L34-L39）

```js
setInterval(() => {
  engine.maybeResetWeeklyBossKills(store);
  const players = store.getAllPlayers();
  for (const player of players) engine.calculateIdle(player);
  if (players.length > 0) store.save();
}, 5000);
```

→ `engine/idle.js#calculateIdle(p)` 是挂机结算核心（经验/金币/掉落/战斗模拟/升级/任务进度）。

### 6.3 跨模块调用约定

| 想做的事        | 调用                                                 |
| ----------- | -------------------------------------------------- |
| 创建/查找玩家     | `engine/player.js`                                 |
| 改装备/词条      | `engine/items.js`                                  |
| 改经验/金币/升级   | `engine/player.js#grantGold / grantExpWithLevelUp` |
| 加任务进度       | `engine/daily.js#updateDailyProgress`              |
| 触发战斗        | `engine/combat.js#simulateBattle`                  |
| 存 player    | `store.setPlayer(username, player)`                |
| 触发 BOSS 战   | `engine/combat.js#simulateBossBattle`              |
| 结算校验        | `engine.settlement.js#assertSettlementReward`      |
| 远征派遣/选事件/领奖 | `engine/expedition.js`                             |
| 公会操作        | `engine/guild.js`                                  |
| 灵鸡斗场        | `engine/cockfight.js`                              |
| 每日活跃加分      | `engine/active.js#addActivePoints`                 |

### 6.4 创世自创装备同步流程（易错点）

```
玩家在 GenesisView 提交造物
  → routes/genesis.js 接收 → engine/genesis.js#forgeEquip
    → 写入 store.getMeta().genesis.customEquips[id] = { ..., _owner: username }
      → service:setStore(store) 启动时调 genesis.rehydrateFromMeta(meta)
        → 把 custom_* 注册回 EQUIP_TEMPLATES（引擎 items.js 才能识别）
```

**重启后自创装备"找不到"99% 是因为没调** **`engine.setStore(store)`**。

### 6.5 远征异步流（v1.02 新增）

```
玩家在 ExpeditionView 选区域+时长 → dispatchExpedition
  → routes/expedition.js → engine/expedition.js#dispatchExpedition
    → 写入 player.expeditions[].state='running' + duration
      → 定时器到期 / 玩家主动查询 → chooseEventOption（事件选择）
        → claimExpedition 触发 grantGold/grantExpWithLevelUp + updateDailyProgress
          → 异步结算写入 player 标记完成
```

### 6.6 公会操作链（v1.02 新增）

```
玩家点"创建公会" → createGuild(name)
  → routes/guild.js → engine/guild.js#createGuild
    → 写入 meta.guilds[id] = { leader, members[], announcement, level, exp }
        → meta.guilds[id].members.push({ username, role, contribution })
          → 玩家加入/捐献 → addGuildContribution / donateGuild
```

### 6.7 灵鸡斗场流（v1.03 完全独立）

```
玩家点"进入斗场" → enterCockArena
  → routes/cockfight.js → engine/cockfight.js#enterCockArena
    → 生成鸡只 lineup + 押注表（独立 cockMeta，不污染主 player）
      → resolveCockRound(bet, intervention) → 战报 + 积分累加
        → exchangeCockfightTitle → 累计积分兑换外观称号
```

***

## 7. 体积红线 & 健康度（重要！）

> 由 `00-code-style.md` 规定：单文件 **> 800 行必须拆分**，>500 接近红线。

| 状态      | 文件                                                  | 行数       | 优先级                     |
| ------- | --------------------------------------------------- | -------- | ----------------------- |
| ⚠️ 超红线  | `client/src/components/GenesisView.vue`             | **1128** | P0 候选拆 4 子组件            |
| ⚠️ 超红线  | `client/src/components/LoginScreen.vue`             | **1082** | P1 已拆 4 子组件，父壳可再精简      |
| ⚠️ 超红线  | `client/src/style.css`                              | **814**  | P1（CSS 可容忍但建议拆主题/通用/动画） |
| ⚠️ 接近红线 | `server/engine/player.js`                           | **734**  | P2                      |
| ⚠️ 接近红线 | `client/src/components/InventoryView.vue`           | **686**  | P2                      |
| ⚠️ 接近红线 | `server/routes/pvp.js`                              | **581**  | P2（路由模块可拆 sub-router）   |
| ⚠️ 接近红线 | `client/src/App.vue`                                | **564**  | P2                      |
| ⚠️ 接近红线 | `client/src/components/CodexView.vue`               | **515**  | P2                      |
| ⚠️ 接近红线 | `client/src/components/character/AttrAllocator.vue` | **325**  | P2                      |

**拆分原则**：

* Vue：抽成 `components/<原名>/<子功能>.vue`，父组件只保留 `tab` 切换 + props 透传。

* 引擎 JS：按"领域"切（如 `items-enchant.js` / `items-equip.js`），用 `setHandler` 注入共享函数。

* 路由：按子领域拆（如 `routes/pvp-arena.js` / `routes/pvp-shop.js`），父文件统一 `registerRoutes`。

***

## 8. 关键设计原则（修改前必看）

| 原则          | 说明                                                                      |
| ----------- | ----------------------------------------------------------------------- |
| **玩家存盘**    | 任何 player 改动后调 `store.setPlayer`（自动 markDirty）                          |
| **原子写**     | 改 `db.json` 用 `.tmp + rename`，每小时滚一次 `.bak`                             |
| **循环引用**    | 引擎用 `setHandler` 注入模式，**不要** 直接 require 形成循环                            |
| **参数校验前置**  | 创世之书的怪物/装备属性超过预算**立即拒绝**，不要等后置结算                                        |
| **结算校验**    | 定时器结算走 `settlement.assertSettlementReward` 防超额                          |
| **响应格式**    | 所有路由响应 `{ success, data?, message? }`                                   |
| **端口**      | 前端 3000 / 后端 3001，**不要改**                                               |
| **API 路径**  | `/api/...`，前端开发模式走 vite proxy，生产走 web-server.js 反代                      |
| **创世数据恢复**  | 服务启动时 `engine.setStore(store)` 会把 `meta.genesis` 重新注册回 EQUIP\_TEMPLATES |
| **公会数据恢复**  | 服务启动时同样调 `engine.setStore(store)` 注入 meta.guilds                        |
| **新装备前缀**   | 自创装备 ID 以 `custom_` 开头，避免和系统模板冲突                                        |
| **代码行数**    | 单文件 ≤ 500 行（软上限），> 800 行必须拆                                             |
| **测试 seam** | 引擎 `state.js` 提供 `__setNow / __setRandom / __setDropRandom` 让测试可注入      |
| **子组件目录**   | 父组件超 800 时必须建 `components/<父名>/` 子目录                                    |
| **独立玩法隔离**  | 灵鸡斗场 / 公会 / 远征 / 创世 都用 meta 子树，不污染主 player                              |

***

## 9. AI 协作工作流（6 步法）

1. **接到任务** → 先读本文件 `docs/CODE_INDEX.md`（约 700 行）
2. **定位文件** → 看第 3/4 章找路径，第 7 章看行数/红线，第 5 章找 API 链
3. **理解业务** → 必要时读 `docs/README/01-gameplay.md` 或 `02-systems.md`
4. **看版本历史** → 改动前先查 `docs/README/06-changelog.md` 看是否已有类似修复
5. **改代码** → 严格遵守 `00-code-style.md`（单文件 ≤ 500 行，> 800 必须拆）
6. **改完验证** → `npm test` + `npm run build`，并在 `06-changelog.md` 追加新版本

***

## 10. 常见任务速查表（高频任务）

| 用户问           | 看哪里                                                                                     |
| ------------- | --------------------------------------------------------------------------------------- |
| "加一个新的词条"     | `server/data/affixes/{novice\|intermediate\|advanced\|master}.js` + `SkillView.vue`     |
| "加一个新区域"      | `server/data/areas.js` + `server/data/monsters.js` + `client/components/MapView.vue`    |
| "加一个新职业"      | `server/data/jobs.js` + `CharacterView.vue`                                             |
| "改附魔公式"       | `server/engine/items.js#enchantItem`                                                    |
| "改转生加成曲线"     | `server/engine/progression.js` + `server/data/progression.js`                           |
| "创世之书扩展"      | `server/engine/genesis.js` + `server/data/genesis.js` + `GenesisView.vue`               |
| "改 PvP 积分公式"  | `server/engine/pvp.js#calcPvpRating`                                                    |
| "改战斗公式"       | `server/engine/combat.js#calcDamage`                                                    |
| "挂机收益调参"      | `server/engine/idle.js#calculateIdle`                                                   |
| "新手指引改动"      | `server/engine/daily.js#updateTutorialStep` + `TutorialOverlay.vue`                     |
| "排行榜加维度"      | `server/routes/leaderboard.js` + `LeaderboardView.vue`                                  |
| "加一个新 Tab"    | `App.vue` 的 `tabOrder/mainTabs` + 新建 `components/<X>View.vue` + `routes/` 注册            |
| "前端换主题"       | `theme.js` + `themes.css`（不动数值）                                                         |
| "称号调整"        | `server/data/titles.js` (自动派生) + `TitleModal.vue`                                       |
| "世界 BOSS 调数值" | `server/engine/worldboss.js` 中倍率常量（hp×5, atk×3, def×1, agi×1）                           |
| "加灵鸡斗场称号"     | `server/data/cockfight.js` + `server/engine/cockfight.js#exchangeCockfightTitle`        |
| "远征事件扩展"      | `server/data/expedition.js` 事件库 + `server/engine/expedition.js`                         |
| "公会捐献奖励"      | `server/data/guild.js` + `server/engine/guild.js#donate`                                |
| "每日活跃调档"      | `server/data/active.js` + `server/engine/active.js`                                     |
| "主动技能"        | `server/engine/active.js` + `server/data/active.js` + `SkillView.vue`                   |
| "前端按钮无响应"     | `App.vue` 的对应 handle\* 方法 → `client/src/api.js` → `server/routes/*` → `server/engine/*` |
| "存档丢失/回滚"     | `server/db.json` + `server/db.json.bak`（自动备份）                                           |
| "结算校验"        | `server/engine/settlement.js#assertSettlementReward`                                    |
| "拆分 XX 大文件"   | 见第 7 章红线表                                                                               |

***

## 11. 严禁事项

* ❌ 改端口号（3000/3001 统一约定）

* ❌ 在 `engine/` 子模块间直接 `require` 形成循环（用 setHandler 注入）

* ❌ 单文件超 800 行不拆

* ❌ 跳过原子写直接改 `db.json`

* ❌ 改 `meta.genesis` / `meta.guilds` / `meta.cockfight` 不调 `engine.setStore`（重启会丢数据）

* ❌ 前端直接读 `localStorage` 存游戏状态（用后端）

* ❌ 把数据库 ID 写死（自创装备用 `custom_` 前缀）

* ❌ 跳过 `settlement.assertSettlementReward` 校验（防止定时器刷奖）

* ❌ 把独立玩法（斗鸡/公会/远征）写入主 player 对象（必须用 meta 子树隔离）

* ❌ 在 README/changelog 之外写中文说明文案到代码（注释除外）

***

## 12. 本索引的元信息

| 项目    | 值                                                                              |
| ----- | ------------------------------------------------------------------------------ |
| 本文件行数 | 约 700 行                                                                        |
| 维护人   | 项目主人                                                                           |
| 最近重写  | v4.0 · 2026-08-31（实测 `Measure-Object -Line`，整合 v3.0 + 补全新模块 + SQLite WAL 后端索引） |
| 上一版   | v3.0 · 2026-08-28（用 `wc -l` 实测）                                                |
| 工具    | TRAE                                                                           |
| 项目版本  | feiland-idle-game v1.03                                                        |

***

## 13. v1.03 SQLite WAL 升级要点（2026-08-31）

### 核心改进

* **主线程不阻塞**：原 JSON 后端用 `fs.writeFileSync` 同步写盘，几十人在线场景 50 玩家 + 公会 + 自创装备的存档 5-20 MB，单次 save 阻塞 Node 事件循环几百 ms。SQLite 后端采用 `fs.writeFile`（异步）+ `sql.js` WASM，**save() 立刻返回**，实际写盘在 I/O 线程异步进行。

* **WAL 模式**：`PRAGMA journal_mode = WAL;` + `synchronous = NORMAL;` 启用写前日志，提高并发读写性能。

* **路径切换安全**：`__setDbPath` 切换数据库路径时，**自增** **`_epoch`** 让 in-flight 写盘作废，避免写到错路径（restart-consistency 测试场景）。

### 兼容性保证

* **API 100% 不变**：`store.js` 对外暴露的 21 个方法（load/save/safeSave/withTransaction/snapshot/restore/getAccount/setPlayer/getMeta/...）签名零修改，30+ 路由/引擎文件无需任何改动。

* **测试隔离**：store.js 派发层在每次 `require('./store')` 时**先清缓存再 require 真实后端**，避免 `restart-consistency.__setDbPath isolation` 风格的"delete cache + re-require"测试拿到跨实例共享状态。

* **路由 / 引擎 0 修改**：routes/*.js 与 engine/*.js 完全无需改动。

### 测试结果

* 原 33 个测试文件、242 个 subtests：**242/242 全过**。

* 新增 `store-sqlite.test.js`：**8/8 全过**（覆盖 CRUD / 事务回滚 / save+load 往返 / 并发 safeSave / snapshot restore）。

* 端到端迁移 demo（写 db.json → 迁 db.sqlite → 改数据 → 重读）：**数据完全一致**。

### 部署步骤

```bash
# 1. 安装依赖（已自动 sql.js）
npm install

# 2. 启动 server，让 store.js 自动检测
node server/index.js
# 看到 "[store] 后端: SQLite (WAL) — db.sqlite" 即生效
# 看到 "[store-sqlite] 已加载 N 个账号, M 个角色" 即数据读出

# 3. 如果从老版本（仅 db.json）升级，先迁移
node server/migrate-json-to-sqlite.js

# 4. 强制使用某后端（可选）
DB_ENGINE=json node server/index.js   # 强制 JSON
DB_ENGINE=sqlite node server/index.js # 强制 SQLite
```

***

## 14. v1.03 JWT 鉴权升级要点（2026-08-31）

### 修复的安全问题（来自 docs/SECURITY\_AUDIT.md）

* **P0 1.1 借名攻击**：所有 `/api/player/:u/*` 仅靠 URL 路径参数识别玩家 → 任何人都能以任何玩家身份操作 → 70+ 个接口受影响

* **P0 1.2 密码明文存储 + 弱校验**：注册密码仅校验非空且明文存 db.json

* **P0 1.5 admin 路由**：PVP settle / worldboss spawn 之前仅靠 X-Admin-Token 校验

### 核心改进

* **JWT 自签**：HMAC-SHA256，Node 内置 `crypto`，零 npm 依赖。Token 格式 `header.payload.signature`，payload 含 `{ username, iat, exp }`，默认 7 天 TTL。

* **密码 bcrypt**：bcrypt rounds=10（首选）；bcrypt 缺失时自动回退到 pbkdf2（100k iter, SHA-256）。自动识别 3 种格式（bcrypt/pbkdf2/旧明文），登录时**自动升级老账号明文→哈希**（一次性迁移）。

* **强制密码长度 ≥6 字符**：注册时拒绝弱密码。

### 鉴权分层（`server/middleware/auth.js`）

| 中间件                   | 作用                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `requireAuth`         | 必须带 `Authorization: Bearer <token>`，否则 401                                                                      |
| `requirePlayerSelf`   | URL `:username` 必须 === token 中 username，否则 403（防借名）                                                             |
| `requireSelfFromBody` | body 中 `username` 字段必须 === token 中 username，否则 403（`/api/arena/challenge` + `/api/arena/buy`）                   |
| `requireAdmin`        | 必须带 `X-Admin-Token` header（与 `process.env.ADMIN_TOKEN` 匹配），否则 403（`/api/arena/settle` + `/api/worldboss/spawn`） |

### 路由覆盖（`server/routes/index.js` v1.03）

* **公开**：register / login / create-character / players/names / account-exists / areas / codex / leaderboard / arena/ranking / arena/records / arena/shop / arena/season / arena/rewards / worldboss/active / expedition/config

* **受保护 (requireAuth + requirePlayerSelf)**：`/api/player/:u/*` 全部 70+ 个接口（含 create-character / strategy / quest / genesis / titles / cockfight / expedition / active / guild）

* **受保护 (requireAuth + requireSelfFromBody)**：`/api/arena/challenge` + `/api/arena/buy`

* **受保护 (requireAdmin)**：`/api/arena/settle` + `/api/worldboss/spawn`

### 开关与环境变量

| 变量                    | 默认              | 说明                               |
| --------------------- | --------------- | -------------------------------- |
| `AUTH_MODE`           | `enforce`       | `enforce`=强制；`off`=开发模式放行（兼容老测试） |
| `JWT_SECRET`          | dev 默认（启动 warn） | 生产**必须**设置 ≥32 字符随机串，否则进程拒绝启动    |
| `ADMIN_TOKEN`         | 无（自动 500）       | 必须设置才能访问 admin 路由                |
| `NODE_ENV=production` | -               | 强制 `JWT_SECRET` 必须存在，否则启动失败      |

### 客户端（`client/src/api.js` v1.03）

* 登录成功后自动把 `{token, username}` 写入 `localStorage['ferland-jwt']` + `['ferland-username']`

* 所有请求自动附带 `Authorization: Bearer <token>`

* 收到 401 响应 → 自动清掉 token + 调用 `onUnauthorized` 回调

* `App.vue` 注册回调：清 player / 重置 tab 到 `char` / toast 提示

* `App.vue` 启动时从 localStorage 恢复登录态（避免重复登录）

### 端到端验证（2026-08-31）

* `npm test`：**257/257 通过**

* `server/middleware/auth.test.js`：**15/15 通过**（签名/校验/过期/篡改/中间件 401/403/借名防护）

* `server/store-sqlite.test.js`：**8/8 通过**

* **9 项端到端 HTTP 测试**（启 server + curl 风格调用）全部 PASS：

  * 注册 alice + bob（弱密码拒绝）

  * 登录拿 JWT token

  * alice token 调 bob 接口 → **403 无权操作该玩家**

  * alice token 调自己 → 200

  * 无 token → 401

  * 篡改 token → 401

  * body 借名（arena/challenge body.username=bob + token=alice）→ **403 无权以该玩家身份操作**

### 部署必做

```bash
# 生产必须设置密钥（≥32 字符随机）
export JWT_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
export ADMIN_TOKEN="$(node -e 'console.log(require("crypto").randomBytes(16).toString("hex"))')"
export AUTH_MODE=enforce
export NODE_ENV=production
node server/index.js
```

### 兼容性注意

* **老账号首次登录**：自动升级明文→哈希（无需手动迁移脚本）

* **测试套**：`isTestMode()=true` 时所有中间件放行（兼容原有 30+ 测试）

* **`AUTH_MODE=off`**：可临时回退到"借名"旧行为（仅供开发调试）

***

## 15. v1.03 P0-P2 综合修复（2026-08-31）

按 SECURITY\_AUDIT.md 的 P0→P1→P2 顺序逐项修复，每个修复配套新增单元测试 + 端到端 HTTP 验证。

### P0 致命级（5 项）

| ID                            | 修复                                                              |
| ----------------------------- | --------------------------------------------------------------- |
| 1.1 借名攻击                      | JWT 鉴权中间件（已完成，§14）                                              |
| 1.2 密码明文 + 弱校验                | bcrypt + pbkdf2 + ≥6 字符（已完成，§14）                                |
| **1.3** 注册无限刷号                | **`middleware/rate-limit.js`** 零依赖 IP 速率限制；注册 5/min、登录 10/min   |
| 1.4 创世预算校验                    | 已有混沌测试套，建议补"百分比属性 vs 总预算"边界                                     |
| **1.5** auto-reincarnate 生产暴露 | **`routes/progression.js`** `NODE_ENV=production` 时不注册；dev/测试保留 |

### P1 高级（10 项）

| ID                                         | 修复                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **1.5** PvP requestId 可预测                  | **`middleware/nonce.js`** HMAC 签名 `buildServerRequestId()`；`routes/pvp.js` 覆盖 client requestId                                  |
| **1.6** 灵鸡斗场 createdAt                     | **`routes/cockfight.js`** 服务端 `getNow()` 生成，忽略客户端传值                                                                             |
| **1.7** web-server 反代                      | **`web-server.js`** 上游 `timeout: 30000` + body `WEB_MAX_BODY=1MB`                                                               |
| **1.8** express.json 无限制                   | **`server/index.js`** `express.json({ limit: '100kb' })`                                                                        |
| **1.9** 创世装备永久化                            | **`engine/genesis.js`** `decayEquipsMax()` 每日 5% 衰减，floor=预算×60%；`engine/index.js` `maybeDecayGenesisEquips(store)` 按 dayKey 跳过 |
| **2.2** CORS 全开                            | **`server/index.js`** CORS 白名单（env `CORS_ORIGIN`，默认 localhost:3000）                                                             |
| **2.10** 排行榜无分页                            | **`routes/leaderboard.js`** `?page=N&pageSize=N`（默认 100/页，最大 200）                                                               |
| **5.1** 5s 挂机 setInterval 堆积               | **`server/index.js`** 改 `setTimeout(runIdleLoop, 5000)` 自递归 + 重入保护                                                              |
| **5.2** 重复 maybeResetWeeklyBossKills timer | **`server/index.js`** 删除独立 60s timer，合并进 `runIdleLoop` + `tryAutoSettle` 兜底                                                     |

### P2 低优（6 项）

| ID                         | 修复                                                                       |
| -------------------------- | ------------------------------------------------------------------------ |
| **3.1** 无审计日志              | **`middleware/audit-log.js`** res.on('finish') 记录写操作，password/token 自动脱敏 |
| **3.2** 公会公告 text 长度       | **`routes/guild.js`** `text.length > 500` 入口校验 → 400                     |
| **3.3** 创世 name 字符         | **`engine/genesis.js`** `isValidGenesisName()` 正则白名单（中文/字母/数字/常见标点）      |
| **3.4** 静态资源缓存             | **`server/index.js`** `express.static()` 加 ETag + 分类型 Cache-Control      |
| **3.5** docker healthcheck | **`docker-compose.yml`** 同时检查 3000 + 3001/api/areas                      |
| **3.6** api.js 错误日志        | **`client/src/api.js`** 5xx 打印真实错误，4xx/格式异常 warn                         |

### 最终测试覆盖

* `npm test`：**279/279 通过**

* 单元测试新增 38 个（JWT 15 + rate-limit 6 + nonce 8 + genesis-decay 5 + audit-log 3）

* **12/12 端到端 HTTP 测试** PASS：rate-limit、auto-reincarnate、PvP requestId、cockfight createdAt、CORS 白名单、公会公告长度、排行榜分页、JWT 借名 403、篡改 token 401、无 token 401

### 仍未修复（建议下一轮）

* **P0 1.4** 创世预算百分比 vs 总预算边界测试

* 部分 P2 文档字符串清理（如 README 中的旧接口列表）

