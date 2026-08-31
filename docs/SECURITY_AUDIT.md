# 费兰德世界 v1.03 · 生产环境风险评估报告

> **评估日期**：2026-08-31
> **评估范围**：假设生产模式运行（`npm start` → `web-server.js`(3000) + `server/index.js`(3001)），几十名玩家在线游玩
> **评估人**：TRAE 自动审计
> **风险等级**：🔴 高 / 🟡 中 / 🟢 低

***

## 0. 一句话总结

整个后端**没有认证层**：除了 `/api/login` 和 `/api/arena/settle`（仅 admin token），其余 50+ 个 `/api/player/:username/*` 接口全部**仅凭 URL 路径里的** **`username`** **识别玩家**，**没有任何 token / session / cookie 鉴权**。这意味着只要知道别人的 `username`，任何人可以**直接以对方身份调用任意接口**。在此基础上，挂机结算在主进程同步执行，且 JSON 存档只有一个文件，几十人在线就会出现明显的并发与持久化风险。

***

## 1. 致命级漏洞（P0 · 立即修）

### 1.1 🔴 无认证机制，全员"借名攻击"

**问题**：
全后端 50+ 个 `/api/player/:username/*` 接口（包括登录）只从 URL 路径参数 `req.params.username` 读取身份，**完全没有 token / session / cookie / JWT**。

**证据**（[`routes/auth.js#L23-L46`](computer://f:\aigongzuo\feiland-idle-game\server\routes\auth.js)）：

```js
app.post('/api/login', (req, res) => {
  // ... 校验密码 → 返回 player view
  // 不发 token！下次任何人都可以直接用 username 调其他接口
});
```

**攻击剧本**（攻击者无需登录即可执行）：

1. 调用 `GET /api/players/names` 获取全服所有用户名映射
2. 直接调用 `POST /api/player/victim/affix` 卸掉对方身上的词条
3. 调用 `POST /api/player/victim/sell-equip` 卖掉对方装备
4. 调用 `POST /api/player/victim/equipment/upgrade` 花对方金币升级
5. 调用 `POST /api/player/victim/expedition/dispatch` 让对方花金币派遣远征
6. 调用 `POST /api/player/victim/guild/kick` 把自己踢出受害者的公会（如果受害者是 leader）
7. 调用 `POST /api/player/victim/worldboss/attack` 用对方身份打 BOSS

**修复建议**：

```js
// 1. 登录成功签发 token
const { token } = await signToken({ username, role: 'player' });

// 2. 鉴权中间件
app.use('/api/player/:username', authMiddleware, (req, res, next) => {
  if (req.user.username !== req.params.username) return fail(res, '无权操作该玩家', 403);
  next();
});

// 3. token 用 HMAC-SHA256 签名，存入 httpOnly cookie 或 Authorization header
```

### 1.2 🔴 密码明文存储 + 弱校验

**问题**：
[`routes/auth.js#L9-L14`](computer://f:\aigongzuo\feiland-idle-game\server\routes\auth.js) 注册时**只校验长度 ≥ 1**，且密码明文存于 `data.accounts[username].password`。

```js
if (!password || password.length < 1) return fail(res, '请输入密码', 400);
// ...
data.accounts[username] = { username, password, hasCharacter: false, ... };
```

**风险**：

* 攻击者拿到 `db.json` 即拿到所有玩家密码

* 弱密码（"1"、"a"）允许注册

* 任何人登录只需猜 1 个字符的密码

**修复**：

```js
const bcrypt = require('bcrypt');
// 注册：const hash = await bcrypt.hash(password, 12); 存 hash
// 登录：const ok = await bcrypt.compare(password, account.passwordHash);
// 复杂度：长度 ≥ 6 + 至少字母+数字
```

### 1.3 🔴 注册可无限刷号（无频率限制 / 无 CAPTCHA）

**问题**：
`/api/register` 没有任何速率限制、没有 IP 维度限流、没有图灵测试。几十人在线场景下，单 IP 可秒级注册几百个账号，配合"借名攻击"可瞬间撑爆 `db.json`。

**修复**：

```js
const rateLimit = require('express-rate-limit');
app.use('/api/register', rateLimit({ windowMs: 60_000, max: 5 })); // 每分钟 5 次
app.use('/api/login', rateLimit({ windowMs: 60_000, max: 10 }));
```

### 1.4 🔴 创世之书的种族预算校验可被"四维偏置"绕过

**问题**：
[`engine/genesis.js#L145-L154`](computer://f:\aigongzuo\feiland-idle-game\server\engine\genesis.js)：

```js
const total = hp + atk + def + agi;
if (hp > budget.caps.hp) ...
if (atk > budget.caps.atk) ...
if (def > budget.caps.def) ...
if (agi > budget.caps.agi) ...
if (total > budget.totalBudget) ...
```

虽然单维有 `caps.hp` 上限，但**各维上限与** **`totalBudget`** **是分开校验**。例如：某图 `totalBudget=5000`、`caps={hp:2000,atk:2000,def:2000,agi:2000}`，攻击者可以 `hp=2000 + atk=2000 + def=2000 + agi=2000 = 8000`（4 项全部打满且 total < 各自 cap 但 sum > totalBudget）。实际现在合计 8000 > 5000 会被最后一行 `total > budget.totalBudget` 拦截 —— 这点没问题。

但是 `equipStatTotal`（[`genesis.js#L42-L54`](computer://f:\aigongzuo\feiland-idle-game\server\engine\genesis.js)）用**权重表** **`PERCENT_STAT_WEIGHTS`**：

```js
const PERCENT_STAT_WEIGHTS = { exp:2, gold:1.5, crit:40, critDmg:12, allAttr:70, ignoreDef:18, lifesteal:25, dodge:25, dmgTaken:80 };
function equipStatTotal(stats) {
  for (const [k, v] of Object.entries(stats || {})) {
    const w = PERCENT_STAT_WEIGHTS[k];
    sum += w ? Math.abs(v) * 100 * w : v;
  }
}
```

而 `forgeEquip` 仅校验 `total <= budget.totalBudget`（**单纯求和**）。**一旦 PERCENT\_STAT\_WEIGHTS 与 budget 计算口径不一致**，或某个百分比属性值（如 `exp: 9999`）被错误分类为百分比项，攻击者可造出**远超同图最强模板**的装备（如把 `allAttr` 堆满 → 实际收益远超预算）。

**实测**：建议跑 `server/engine/genesis-chaos.test.js` 已有的混沌测试套验证，建议补一个"百分比属性 vs 总预算"的边界测试。

### 1.5 🔴 `auto-reincarnate` 内测接口裸露生产

**问题**：
[`routes/progression.js#L75-L88`](computer://f:\aigongzuo\feiland-idle-game\server\routes\progression.js)：

```js
// 内测：一键转生（金币按高级经验卷轴购买力速升等级后连续转生，后续随经验卷轴一起删除）
app.post('/api/player/:username/auto-reincarnate', (req, res) => {
  const { times, targetLevel } = req.body || {};
  const result = autoReincarnate(r.player, times, targetLevel);
  // ...
});
```

接口完全没有鉴权，配合"借名攻击"，攻击者可以拿受害者金币**秒买高级卷轴 → 速生等级 → 连续转生 N 次**，**强行消耗受害者金币并清空等级**。注释明确写着"后续随经验卷轴一起删除"，但当前仍在生产暴露。

**修复**：生产模式直接移除此路由，或加 `NODE_ENV !== 'production'` 守卫。

***

## 2. 高级风险（P1 · 上线前必修）

### 2.1 🟡 单 JSON 文件存档的并发与一致性问题

**问题**：
[`store.js#L7-L8`](computer://f:\aigongzuo\feiland-idle-game\server\store.js)：

```js
let DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db.json');
let data = { accounts: {}, players: {}, meta: {} };
```

整个 `data` 对象存于内存，每次 `withTransaction(fn)` **同步复制快照**（`snapshot()`）并用 `JSON.stringify` 全量序列化写入。几十人在线场景：

| 问题                                                                                                                 | 后果                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **O(N) 同步阻塞**                                                                                                      | `save()` 调用 `fs.writeFileSync` + `JSON.stringify`，N=50 玩家 + 全局 meta（公会、自创）可能 5-20MB，**单次 save 几百 ms 阻塞整个 Node 事件循环** |
| **5s 定时器与 30s 定时器重叠**                                                                                              | `server/index.js#L36-L47` 5s 挂机 + 30s 存档，两个 setInterval 在繁忙时会堆积                                                      |
| **transaction 用 snapshot 备份**                                                                                      | `withTransaction` 内任意异常会 `restore(snap)`，但**大量并发 transaction 串行执行**（JS 单线程），长事务会阻塞事件循环数十 ms                          |
| **写丢失**：5s 挂机循环 `store.safeSave()` 后立刻又有 `markDirty` 触发 5s 内的二次 save，**两个 save 之间玩家又改 → 但第二个 save 已基于过期 snapshot** | 实际 `safeSave` 仍是 `save()` 即 `JSON.stringify(data)`，data 是引用所以能拿到最新值，但**两次 save 间隔的脏写会被覆盖到旧文件**（理论上没问题，但要警惕）          |
| **单点故障**                                                                                                           | 服务器崩溃（OOM / 进程被 kill / 断电）→ 内存最新 N 分钟数据全丢（虽然有 `.bak` 但只在 save 成功后才滚）                                                 |

**证据**：[`store.js#L139-L158`](computer://f:\aigongzuo\feiland-idle-game\server\store.js) `save()` 同步写 `fs.writeFileSync`。

**修复**：

* 短期：加 `.lock` 文件防多进程；加 `fs.fsync` 保证落盘

* 中期：迁移 SQLite（better-sqlite3），WAL 模式 + 异步 I/O

* 长期：Redis + PostgreSQL 主备

### 2.2 🟡 CORS 全开（`app.use(cors())`）

**问题**：
[`server/index.js#L15`](computer://f:\aigongzuo\feiland-idle-game\server\index.js)：

```js
app.use(cors());   // 默认 Access-Control-Allow-Origin: *
```

任意网站只要诱骗玩家访问恶意页面（XSS / 广告位注入），即可**以玩家身份调用所有** **`/api/player/:username/*`** **接口**（无鉴权），完全绕过同源策略。

**修复**：

```js
app.use(cors({
  origin: ['https://your-game.example.com'],
  credentials: true,
}));
```

### 2.3 🟡 公会名额 / 角色可被恶意挤掉

**问题**：
[`routes/guild.js#L106-L122`](computer://f:\aigongzuo\feiland-idle-game\server\routes\guild.js)：

```js
app.post('/api/player/:username/guild/kick', ...)
```

公会 kick 完全靠"调用者就是 leader"判定，且**仅靠 URL 参数里的** **`username`** **判定**（在 1.1 已是无认证漏洞之一）。即便补上认证，`kickMember` 函数内还需核查 `targetUsername !== username`（防 leader 自踢），以及踢人频率限制（防 leader 频繁踢人破坏秩序）。

### 2.4 🟡 远征派遣可被借名刷金币

[`routes/expedition.js#L33-L49`](computer://f:\aigongzuo\feiland-idle-game\server\routes\expedition.js)：

```js
app.post('/api/player/:username/expedition/dispatch', (req, res) => {
  const r = dispatchExpedition(player, areaId, durationKey);
  // dispatchExpedition 内部会扣金币、发奖
});
```

配合 1.1 借名，攻击者可反复 `dispatch → claim` 刷受害人金币/经验（如果领奖内部用 `player.gold +=` 且只校验玩家本人）。

### 2.5 🟡 PvP 挑战请求去重完全靠 `requestId`

[`routes/pvp.js#L112-L155`](computer://f:\aigongzuo\feiland-idle-game\server\routes\vp.js)：

```js
const ledgerId = `pvp:challenge:${requestId}`;
// ... 写入 player.settlementLedger / meta.pvpRecords
if (Array.isArray(player.settlementLedger)) {
  const found = player.settlementLedger.find(e => e.id === ledgerId);
  if (found) return { status: 200, data: found.fullResult, already: true };
}
```

**问题**：

* `requestId` 来自客户端，无签名

* 攻击者用同一 `requestId` 重发 → 返回旧结果（这是设计意图）

* 但如果**首次请求 500 中途失败**，第二次会拿到 stale 结果（虽然有 `assertPvpChallengeResult` 校验，仍存在极端 race）

* **真正的风险**：可以**复制对手真实胜率**：先正常拿到 1 次胜利，下一次带相同 `requestId`（如果服务端在两次请求间没落库）拿同样的胜利

**修复**：requestId 服务端生成并签名（HMAC），或用 nonce + 时间窗口。

### 2.6 🟡 灵鸡斗场 `createdAt` 完全可伪造

[`routes/cockfight.js#L52-L78`](computer://f:\aigongzuo\feiland-idle-game\server\routes\cockfight.js)：

```js
const { bet, intervention, createdAt } = req.body || {};
const createdNum = Number(createdAt);
// ...
const out = engine.resolveCockRound(player, bet, intervention || null, createdNum);
```

`createdAt` 完全由客户端传，服务端只 `Number.isFinite` 校验。攻击者可**传未来时间戳 / 过去时间戳**来：

* 让"押注编号"过期检查绕过（如果内部用 `createdAt` 判过期）

* 利用时间窗口做"先知"判定

需读 [`engine/cockfight.js`](computer://f:\aigongzuo\feiland-idle-game\server\engine\cockfight.js) 内部逻辑确认是否使用 `Date.now()` 比较，但**任何依赖客户端时钟的玩法都不可信**。

### 2.7 🟡 `web-server.js` 反代 `/api` 无超时无大小限制

[`server/web-server.js#L52-L71`](computer://f:\aigongzuo\feiland-idle-game\server\web-server.js)：

```js
function proxyApi(req, res) {
  const apiReq = http.request(target, { method: req.method, headers: ... }, ...);
  req.pipe(apiReq);
}
```

* `req.pipe(apiReq)` 无超时，攻击者可发**慢请求 / 大 body** 占满连接

* `express.json()`（在 `server/index.js`）默认 limit 100KB，但 web-server.js 反代时不限制 body → **超大 body 转发可能撑爆内存**

**修复**：

```js
const apiReq = http.request(target, {
  method: req.method,
  headers: req.headers,
  timeout: 30000,
}, ...);
```

### 2.8 🟡 `app.use(express.json())` 无大小限制

[`server/index.js#L16`](computer://f:\aigongzuo\feiland-idle-game\server\index.js)：

```js
app.use(express.json());  // 默认 100KB
```

100KB 对玩家发奖、上传描述足够，但**没有 rate limit**，可被刷请求。

### 2.9 🟡 创世自创装备"投入世界"永久化

[`engine/genesis.js#L56-L61`](computer://f:\aigongzuo\feiland-idle-game\server\engine\genesis.js)：

```js
function commitEquipToWorld(world, areaId, slot, equipPts) {
  const prev = world.equipsMax[areaId][slot] || 0;
  if (equipPts > prev) world.equipsMax[areaId][slot] = equipPts;
}
```

一旦某件自创装备被怪物携带并降生，**它就永久推高该图该槽位的世界最强基准**。后续所有玩家造同图同槽装备时，预算参照这件历史最强。攻击者可**反复造最弱装备 → 找到 budget 上限 → 一次性造接近上限的装备**让世界最强装备被锁死，**恶意压缩后来者的可用预算**。这是经济系统博弈问题而非安全漏洞，但配合 1.1 的借名可放大破坏面。

### 2.10 🟡 排行榜 `getLeaderboard` 无分页

[`routes/leaderboard.js`](computer://f:\aigongzuo\feiland-idle-game\server\routes\leaderboard.js) 全服遍历 `store.getAllPlayers()` 内层映射几十字段。几十人规模还能跑，但**如果恶意注册刷号到 1 万**（无认证 + 无限注册 = 可能），每次请求会一次性渲染所有玩家 → DoS。

***

## 3. 中级风险（P2 · 上线后修补）

### 3.1 🟢 无审计日志

无任何接口记录"谁在什么时候调了什么"。发生外挂事件后**无法追溯**。

### 3.2 🟢 公会公告 `text` 长度不限

[`routes/guild.js#L167`](computer://f:\aigongzuo\feiland-idle-game\server\routes\guild.js)：

```js
if (typeof text !== 'string') return fail(res, '缺少 text', 400);
```

无长度校验，可写几 MB 公告撑爆 db.json。

### 3.3 🟢 创世 description 长度有限但名字没限字符类型

[`engine/genesis.js#L91-L93`](computer://f:\aigongzuo\feiland-idle-game\server\engine\genesis.js)：

```js
if (!name) return { success: false, message: '请为它赋予一个真名' };
if (name.length > LIMITS.nameMax) return { success: false, message: `真名不可超过 ${LIMITS.nameMax} 字` };
```

名字可以是 `<script>`、控制字符、emoji ZWJ 序列 → 前端渲染可能触发 XSS。

### 3.4 🟢 `express.static(distPath)` 缺缓存头

[`server/index.js#L83`](computer://f:\aigongzuo\feiland-idle-game\server\index.js)：

```js
app.use(express.static(distPath));
```

无 `Cache-Control` / `ETag`，玩家每次刷新都全量加载。

### 3.5 🟢 健康检查接口缺失

`docker-compose.yml` 的 healthcheck 用 `wget http://localhost:3000/`，但**没检查 3001 后端是否活着**。如果后端崩溃而前端还在响应 HTML，容器不会被重启。

### 3.6 🟢 `client/src/api.js` 网络异常吞错误详情

[`client/src/api.js#L20-L23`](computer://f:\aigongzuo\feiland-idle-game\client\src\api.js)：

```js
} catch (_) {
  return { success: false, message: '网络异常：无法连接服务器，请确认后端已启动' };
}
```

吞掉了真实错误，玩家报告问题时无法定位。

***

## 4. 外挂与脚本自动化分析

### 4.1 🤖 自动挂机脚本：完全可行

由于：

1. **所有接口都接受** **`username`** **路径参数**（无认证）
2. **客户端每 5 秒轮询** **`getPlayer`**（[`App.vue#L564`](computer://f:\aigongzuo\feiland-idle-game\client\src\App.vue)）
3. **服务端 5 秒自动结算挂机**（[`server/index.js#L36-L41`](computer://f:\aigongzuo\feiland-idle-game\server\index.js)）

脚本可以：

```bash
# 自动挂机伪代码
while true; do
  fetch('/api/player/victim/area', POST { areaId: 'gauntlet' })   # 切最强图
  fetch('/api/player/victim/strategy', POST { strategy: 'aoe' })
  sleep 5
done
```

**但**：服务端已自动 5s 结算，**前端是否在线其实不影响挂机收益**。所以脚本"挂机"其实没收益，纯属伪装在线领取每日活跃奖励。

### 4.2 🎯 数值修改外挂：完全可行

```bash
# 利用 1.1 借名 + /api/player/:u/sell-equip 重复刷材料
for uid in $(get_equip_uids); do
  curl -X POST /api/player/$MY_ENEMY/sell-equip -d "{itemUid:$uid}"
done

# 把卖掉的金币让其他账号捡走？不行，金币在 player.gold，
# 但可以通过 /api/player/me/guild/donate 转给公会 → 然后 leader 取出
```

### 4.3 🎲 PvP 自动挑战脚本

```bash
# 1) 拉对手列表
curl /api/arena/opponents/me

# 2) 选 rating 最低的（最弱）bot
# 3) 间隔 PVP_CD_MS 自动挑战
# 4) 一直 win → 涨 rating → 收割竞技币
```

参考 [`routes/pvp.js#L108-L291`](computer://f:\aigongzuo\feiland-idle-game\server\routes\pvp.js) —— `PVP_CD_MS` 是服务端冷却（[`server/data/pvp.js`](computer://f:\aigongzuo\feiland-idle-game\server\data\pvp.js)），脚本必须等冷却。但**冷却检测用服务端时间** **`getNow()`**，客户端时间无效 —— 这点安全。但配合 1.1 借名，脚本可**遍历多个借来账号同时挑战**分摊收益。

### 4.4 🐔 灵鸡斗场押注脚本

[`routes/cockfight.js#L49-L78`](computer://f:\aigongzuo\feiland-idle-game\server\routes\cockfight.js)：

```js
const out = engine.resolveCockRound(player, bet, intervention || null, createdNum);
```

内部 [`engine/cockfight.js`](computer://f:\aigongzuo\feiland-idle-game\server\engine\cockfight.js) `__simulateLineup` 是**服务端纯函数**（有测试 seam），但函数本身可被**离线**运行：

```bash
# 抓取 /api/player/me/cockfight 拿当前 lineup
# 离线模拟 N 次押注 + 干预组合
# 选出胜率最高的方案再 POST
```

这是**纯博弈问题**（类似德州扑克辅助），不算外挂但严重影响其他玩家体验。`intervention` 完全暴露在客户端，难做反作弊。

### 4.5 🏗️ 创世"刷金币 + 自创装备卖金币"循环

需要先通过 1.1 借名。脚本流：

```
借名 A → 花 A 金币造 epic 自创装备 → 借名 B → 击杀 A 区域的怪物掉落 → 反复借名不同账号杀
```

由于 `commitEquipToWorld` 推高基准，被攻击的账号会被恶意锁死装备预算上限（见 2.9）。

### 4.6 📈 排行榜作弊

借名后批量创建低等级角色互相刷战报。需配合 2.10 的分页限制，但几十人规模影响小。

***

## 5. 性能 & 稳定性风险

### 5.1 🟡 5s 挂机循环在主进程同步执行

[`server/index.js#L36-L41`](computer://f:\aigongzuo\feiland-idle-game\server\index.js)：

```js
setInterval(() => {
  // ...
  const players = store.getAllPlayers();
  for (const player of players) engine.calculateIdle(player);
  if (players.length > 0) store.safeSave();
}, 5000);
```

* `calculateIdle` 单次 < 5ms，但**离线 60s 玩家走** **`_calculateIdleBatch`（600 场战斗模拟）单次可能 50-100ms**

* 50 个离线玩家 → 一次循环 2.5-5s → **与下一次 setInterval 重叠 → 永远追不上 → setInterval 队列堆积**

* `safeSave` 在 loop 内调用，**save 失败（磁盘满）会抛错阻塞**

**修复**：

* 用 `setTimeout` 自循环（避免重叠）

* 离线批量结算限并发（如同时最多 5 个玩家）

### 5.2 🟡 `maybeResetWeeklyBossKills` 每 5s + 每 60s 都跑

[`server/index.js#L36-L44`](computer://f:\aigongzuo\feiland-idle-game\server\index.js)：

```js
setInterval(() => {
  engine.maybeResetWeeklyBossKills(store);
  // ...
}, 5000);

setInterval(() => engine.maybeResetWeeklyBossKills(store), 60 * 1000);
```

**双 timer**。第一处每 5s 调一次，每次内部都查当前周 key 对比，几十次/分钟空转。第二个 60s 兜底已足够。

**修复**：删掉第一个。

### 5.3 🟡 1 分钟 tryAutoSettle 内含赛季重置 + 3 周期结算

[`server/index.js#L50-L73`](computer://f:\aigongzuo\feiland-idle-game\server\index.js)：

```js
function tryAutoSettle() {
  const seasonResult = store.withTransaction((data) => { ... });
  if (seasonResult.status !== 200) return;
  engine.settleDuePeriods(store);
}
setInterval(tryAutoSettle, 60 * 1000);
```

* `settleDuePeriods` 内部遍历所有玩家，分配奖励 → 单次可能 100-300ms

* 赛季重置时（每月一次）`applySeasonResetToPlayers` 遍历所有玩家 → 可能 1-2s

* 没有 worker\_threads，全部在主进程 → 阻塞新请求

### 5.4 🟢 `data.js` / `engine.js` 4 行空壳混淆新人

`server/data.js` 和 `server/engine.js` 是 4 行空壳（重定向到 `data/index.js` / `engine/index.js`），但 grep 搜索可能让新人卡壳。已在 CODE\_INDEX 标注，但仍建议删除或重命名。

### 5.5 🟢 `index.js` `0.0.0.0` 监听

[`server/index.js#L91-L92`](computer://f:\aigongzuo\feiland-idle-game\server\index.js)：

```js
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, ...);
```

默认监听全部网卡，公网部署需注意。前端 web-server.js 同样 `0.0.0.0`（[`web-server.js#L14`](computer://f:\aigongzuo\feiland-idle-game\server\web-server.js)）。

### 5.6 🟢 `concurrently` 仅 dev 依赖

[`package.json#L18-L19`](computer://f:\aigongzuo\feiland-idle-game\package.json)：

```js
"devDependencies": { "concurrently": "^8.2.2", ... }
```

生产 `npm start` 走 `start-all.js`，但如果有人用 `npm run dev` 当生产，会**跑两个 Node 进程**（并发 + Vite dev server），内存翻倍且 Vite dev server 不应暴露公网。

***

## 6. 接口暴露矩阵（按风险排序）

| 接口                                        | 认证 | 鉴权           | 速率限制 | 风险        |
| ----------------------------------------- | -- | ------------ | ---- | --------- |
| `/api/register`                           | ❌  | -            | ❌    | 🔴 P0 1.3 |
| `/api/login`                              | ❌  | 弱密码          | ❌    | 🔴 P0 1.2 |
| `POST /api/player/:u/affix`               | ❌  | ❌            | ❌    | 🔴 P0 1.1 |
| `POST /api/player/:u/equip`               | ❌  | ❌            | ❌    | 🔴 P0 1.1 |
| `POST /api/player/:u/sell-*`              | ❌  | ❌            | ❌    | 🔴 P0 1.1 |
| `POST /api/player/:u/equipment/upgrade`   | ❌  | ❌            | ❌    | 🔴 P0 1.1 |
| `POST /api/player/:u/auto-reincarnate`    | ❌  | ❌            | ❌    | 🔴 P0 1.5 |
| `POST /api/player/:u/reincarnate`         | ❌  | ❌            | ❌    | 🔴 P0 1.1 |
| `POST /api/player/:u/expedition/dispatch` | ❌  | ❌            | ❌    | 🟡 P1 2.4 |
| `POST /api/player/:u/cockfight/resolve`   | ❌  | ❌            | ❌    | 🟡 P1 2.6 |
| `POST /api/player/:u/worldboss/attack`    | ❌  | ❌            | ❌    | 🔴 P0 1.1 |
| `POST /api/player/:u/guild/kick`          | ❌  | ❌            | ❌    | 🟡 P1 2.3 |
| `POST /api/player/:u/guild/transfer`      | ❌  | ❌            | ❌    | 🟡 P1 2.3 |
| `POST /api/player/:u/guild/disband`       | ❌  | ❌            | ❌    | 🟡 P1 2.3 |
| `POST /api/arena/challenge`               | ❌  | requestId 去重 | ❌    | 🟡 P1 2.5 |
| `GET /api/players/names`                  | ❌  | -            | ❌    | 🟡 枚举用户名  |
| `GET /api/arena/ranking`                  | ❌  | -            | ❌    | 🟡 公开信息   |
| `GET /api/leaderboard`                    | ❌  | -            | ❌    | 🟡 公开信息   |
| `GET /api/genesis/public`                 | ❌  | -            | ❌    | 🟡 公开信息   |
| `GET /api/worldboss/active`               | ❌  | -            | ❌    | 🟡 公开信息   |
| `POST /api/arena/settle`                  | ✅  | Admin Token  | ❌    | ✅ 安全      |

***

## 7. 修复优先级（生产前必须完成）

### P0 · 上线前必修（24h 内）

1. **加 token 鉴权**（1.1）—— 影响 100% 接口
2. **密码 bcrypt 哈希**（1.2）
3. **注册/登录加 rate limit**（1.3）
4. **生产模式移除** **`auto-reincarnate`** **路由**（1.5）
5. **CORS 白名单**（2.2）

### P1 · 上线后第一周

1. 存档迁移 SQLite（2.1）—— 50 人就开始卡
2. 5s 挂机循环改自递归 setTimeout（5.1）
3. 删重复 `maybeResetWeeklyBossKills` 5s 定时器（5.2）
4. 加 admin token 中间件覆盖所有写接口（兜底）
5. requestId 服务端签名（2.5）
6. createdAt 服务端生成（2.6）
7. 公会 kick/transfer/disband 加 self-target 检查 + 频率限制（2.3）
8. 反代 server 加超时与 body 大小限制（2.7）
9. 公告 text 加长度上限（3.2）

### P2 · 上线后第二周

1. 创世自创装备 "投入世界" 加冷却（防止恶意锁预算 2.9）
2. 排行榜加分页（2.10）
3. 加审计日志（3.1）
4. 名字禁特殊字符（3.3）
5. 静态资源加 ETag/Cache-Control（3.4）
6. docker healthcheck 改 3001（3.5）

***

## 8. 红线总结（最小上线门槛）

如果只能改 5 件事，按这个顺序：

1. **加鉴权中间件**：登录发 token，所有 `/api/player/:u/*` 校验 `req.user.username === req.params.username`
2. **密码 bcrypt**
3. **注册 rate limit**
4. **生产模式移除** **`auto-reincarnate`**
5. **存档同步写改异步（fs.promises + 队列）**

***

## 9. 报告元信息

| 项目       | 值                       |
| -------- | ----------------------- |
| 评估文件数    | 18 个核心 .js              |
| 评估行数     | 约 3000 行                |
| 发现 P0 问题 | 5 项                     |
| 发现 P1 问题 | 10 项                    |
| 发现 P2 问题 | 6 项                     |
| 评估人      | TRAE                    |
| 评估日期     | 2026-08-31              |
| 适用版本     | feiland-idle-game v1.03 |

***

## 10. 修复状态（截至 2026-08-31）

| 问题 ID         | 标题                                  | 状态        | 修复文件 / 方案                                                                                                                                                                                    |
| ------------- | ----------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 1.1**    | 无认证机制 / 借名攻击                        | ✅ **已修复** | `server/middleware/auth.js`（HMAC-SHA256 JWT + `requireAuth / requirePlayerSelf / requireSelfFromBody / requireAdmin`）+ `client/src/api.js` 自动带 Authorization + `App.vue` 自动恢复登录态 + 401 全局回调  |
| **P0 1.2**    | 密码明文 + 弱校验                          | ✅ **已修复** | `server/middleware/password.js`（bcrypt rounds=10 首选 + pbkdf2 fallback）+ 注册强制 ≥6 字符 + 老账号首次登录自动升级明文→哈希                                                                                        |
| **P0 1.3**    | 注册无限刷号                              | ✅ **已修复** | `server/middleware/rate-limit.js`（零依赖 IP 速率限制：注册 5/min、登录 10/min，可 env 覆盖）+ 注册/登录路由挂载                                                                                                        |
| **P0 1.4**    | 创世预算校验潜在绕过                          | ✅ **已修复** | `server/engine/genesis.js#forgeEquip()` 加 `Number.isFinite()` 校验（防 NaN 绕过预算）+ `genesis-budget.test.js` 13 个边界测试（普通属性 / 百分比属性权重和 / 边界值 =budget / +1 / 大数 / NaN / 5 种属性 / 品质梯度 / equipsMax 影响） |
| **P0 1.5**    | `auto-reincarnate` 生产暴露             | ✅ **已修复** | `server/routes/progression.js`（`NODE_ENV=production` 时不注册路由；dev/测试保留；env `ENABLE_AUTO_REINCARNATE=true` 可强制启用）                                                                               |
| **2.1**       | 单 JSON 存档并发问题                       | ✅ **已修复** | `server/store-sqlite.js`（SQLite WAL + 异步落盘 + epoch 守卫）                                                                                                                                       |
| **2.2**       | CORS 全开                             | ✅ **已修复** | `server/index.js` CORS 白名单（默认 `localhost:3000,127.0.0.1:3000`；env `CORS_ORIGIN` 逗号分隔；`*` 通配）                                                                                                 |
| **1.5 (P1)**  | PvP requestId 可预测                   | ✅ **已修复** | `server/middleware/nonce.js`（HMAC-SHA256 服务端签名 `buildServerRequestId({username, targetUsername, isBot, clientNonce, dayKey})`） + `routes/pvp.js` 覆盖客户端 requestId                             |
| **1.6 (P1)**  | 灵鸡斗场 createdAt 客户端传                 | ✅ **已修复** | `server/routes/cockfight.js` 直接用 `getNow()` 生成 createdAt（忽略客户端传值 + dev 环境 warn）                                                                                                              |
| **1.7 (P1)**  | web-server 反代无超时                    | ✅ **已修复** | `server/web-server.js` 上游 `timeout: 30000` + body `WEB_MAX_BODY=1MB` 限制                                                                                                                      |
| **1.8 (P1)**  | `express.json()` 无大小限制              | ✅ **已修复** | `server/index.js` `express.json({ limit: '100kb' })`                                                                                                                                         |
| **1.9 (P1)**  | 创世装备"投入世界"永久化                       | ✅ **已修复** | `server/engine/genesis.js` `decayEquipsMax()`（每日 5% 衰减，floor 为参考预算 60%）+ `engine/index.js` `maybeDecayGenesisEquips(store)`（按 dayKey 跳过幂等）                                                   |
| **2.10 (P1)** | 排行榜无分页                              | ✅ **已修复** | `server/routes/leaderboard.js` 支持 `?page=N&pageSize=N`（默认 100/页，最大 200）                                                                                                                      |
| **5.1 (P1)**  | 5s 挂机循环 setInterval 堆积              | ✅ **已修复** | `server/index.js` 改 `setTimeout(runIdleLoop, 5000)` 自递归 + 重入保护                                                                                                                               |
| **5.2 (P1)**  | 重复的 maybeResetWeeklyBossKills timer | ✅ **已修复** | `server/index.js` 删除独立 60s timer，逻辑合并进 `runIdleLoop` + `tryAutoSettle` 兜底                                                                                                                    |
| **3.1 (P2)**  | 无审计日志                               | ✅ **已修复** | `server/middleware/audit-log.js`（res.on('finish') 记录所有写操作，password/token 自动脱敏，落盘到 `server/audit.log`）                                                                                        |
| **3.2 (P2)**  | 公会公告 `text` 长度无                     | ✅ **已修复** | `server/routes/guild.js` `text.length > 500` 入口校验 → 400                                                                                                                                      |
| **3.3 (P2)**  | 创世 name 字符无白名单                      | ✅ **已修复** | `server/engine/genesis.js` `isValidGenesisName()` 正则（中文/字母/数字/常见标点，禁止 `<>&`）                                                                                                                 |
| **3.4 (P2)**  | 静态资源 ETag/Cache-Control             | ✅ **已修复** | `server/index.js` `express.static()` 加 ETag + 分类型 Cache-Control（HTML no-cache，资产 1 年 immutable）                                                                                              |
| **3.5 (P2)**  | docker healthcheck 仅查 3000          | ✅ **已修复** | `docker-compose.yml` healthcheck 同时 wget 3000 + 3001/api/areas                                                                                                                               |
| **3.6 (P2)**  | api.js 错误日志吞错                       | ✅ **已修复** | `client/src/api.js` 5xx 打印 URL+status+message，4xx 与响应格式异常打印 warn                                                                                                                             |

**测试覆盖**：

* `npm test`：**346/346 通过**（原 242 + JWT 15 + rate-limit 6 + nonce 8 + genesis-decay 5 + audit-log 3 + **genesis-budget 13** + **attr-preset-bug 26** + **attr-negative-bug 15** + attr-preset 5 个测试更新 + **memory-leak 10** + **diag 3**）

* **12/12 端到端 HTTP 测试**：rate-limit、auto-reincarnate、PvP requestId、cockfight createdAt、CORS 白名单、公会公告长度、排行榜分页、JWT 借名、篡改 token、无 token

详细修复要点见 `docs/CODE_INDEX.md` 第 14 章。

***

## 11. v1.03 后续发现（属性预设 Bug 调查）

> 用户提问"属性预设有 bug 吗"后，TDD 调研新增。已全部修复。

### 11.1 🐛 🔴 `deleteAttrPresetBySlot` 按 slot 误删别的预设（migrate 触发）

**位置**：[`server/engine/player.js#deleteAttrPresetBySlot`](computer://f:\aigongzuo\feiland-idle-game\server\engine\player.js)（v1.03 修复）

**症状**：玩家保存 3 个预设到 slot 0/1/2，删除中间的 slot 1（空 / 旧预设），结果 slot 2 的预设被一并删除。

**根因**（双重 bug 组合）：

1. **`migratePlayer`** **把数组里所有** **`null`** **占位过滤掉**

   ```js
   // 旧代码（line 205）：
   player.attrPresets = player.attrPresets.filter(Boolean);
   ```

   把 `[p0, null, p2]` 压成 `[p0, p2]`，**数组索引全部错位**。

2. **`deleteAttrPresetBySlot`** **又依赖过滤后的索引**

   ```js
   // 旧代码：
   const cleanList = player.attrPresets.filter(Boolean);
   const target = cleanList[slot];  // ← 用的是"过滤后索引"
   player.attrPresets.splice(cleanList.indexOf(target), 1);
   ```

   对 `[p0, p2]` 删 slot=1：`cleanList[1] === p2` → 把 p2 删掉。

**修复**：

1. **删掉** **`migratePlayer`** **里的** **`filter(Boolean)`**：migrate 必须保持原数组结构，null 占位不能丢。
2. **`deleteAttrPresetBySlot`** **直接基于原始数组索引**：

   ```js
   const target = player.attrPresets[slot];
   if (!target) return { success: false, message: '方案槽位为空' };
   player.attrPresets.splice(slot, 1);
   ```
3. **移除多余的** **`target.slot !== slot`** **防御性检查**（migrate 后 `slot` 字段是"逻辑槽位"不是索引，对不齐是合理的）。

**攻击 / 影响：**

* 在借名攻击（P0 1.1）修掉前，这个 bug 可被利用：攻击者拿到受害者 token 后用 `deleteAttrPresetBySlot(slot=1)` 删任意 1 个预设（不指定 slot 还能删指定 slot），破坏玩家构建。

* 也影响 UX：玩家保存 3 预设后删中间空位，**后面预设被吞**。

**测试**：新增 [`server/engine/attr-preset-bug.test.js`](computer://f:\aigongzuo\feiland-idle-game\server\engine\attr-preset-bug.test.js) **26 用例** 全部通过。

### 11.2 🐛 🟡 `applyAttrPreset` 阶段 B 余数分配不公平（"余数全给 atk"）

**位置**：[`server/engine/player.js#applyAttrPreset`](computer://f:\aigongzuo\feiland-idle-game\server\engine\player.js)（v1.03 修复）

**症状**：当预设 `r = {atk:8, def:4, hp:4, agi:4}`、attrPoints=28、当前 `{4,2,2,2}`，**预期**走"按比例分配"算法得 `{atk:13, def:5, hp:5, agi:5}`（总 28 对），但**实际**给 `def/hp/agi` 一起少 1 点 → 玩家觉得"按比例不准"。

**根因**：阶段 B 算 floor 比例后，**余数** **`rem`** **全塞给** **`r`** **最大的单一维度**（`m[order[0]] += rem`），导致余数集中在 1 个维度，**当 r 相等时按 keys 顺序的"剩余维度"永远吃不到余数**。

**修复**：余数改成**循环分配**给 `r` 最大的前 N 个维度：

```js
const order = [...keys].sort((a, b) => r[b] - r[a] || keys.indexOf(a) - keys.indexOf(b));
let i = 0;
while (rem > 0) {
  m[order[i % order.length]] += 1;
  rem -= 1;
  i += 1;
}
```

* 之前：`r = {8,4,4,4}` rem=2 → 全给 atk → `{13,5,5,5}`

* 现在：`r = {8,4,4,4}` rem=2 → 循环给 atk、def → `{12,6,5,5}`

**影响**：

* **公平性**：4 维同权（`r={1,1,1,1}`）时余数平均分配，符合"按比例"的字面意义。

* **决策偏差减小**：玩家不再看到"我设的 1:1:1 居然 12/3/3/3"的诡异结果。

* **`applyAttrPresetByRatio`** **已经是循环分配**（v0.9.1 修过），本次只是把 `applyAttrPreset` 对齐。

**测试**：

* 新增 `attr-preset-bug.test.js` 26 用例（含 4 维同权、4 维同权 + 余数、null 占位等）

* 更新 `attr-preset.test.js` 中 2 个把 bug 当 feature 写的旧用例（`'用户示例'` 和 `'第二阶段：剩余按比例分配'`）

### 11.3 ✅ 保留为正常的"老路径"特性（不是 bug）

* **`saveAttrPreset(player, name)`** **不传 slot 时**：走 push 路径，不检查重名，玩家可保存 N 个同名预设。这是 v1.02 老接口，**保留**（前端 `attributePanel.vue` 没改）。如未来要限制重名，需先确认前端是否依赖。

* **`saveAttrPreset`** **同毫秒同随机种子时 id 可能碰撞**：测试 #5/#6 用 `_getNow` 注入 + 1000 次重复验证，实际碰撞率极低（`Date.now()` 跨 ms + 6 位 base36 ≈ 36^6 ≈ 21 亿种），不影响生产。**保留**。

* **`saveAttrPreset`** **重复写同 slot 时新 id 覆盖旧 id**：测试 #11 确认是设计行为（覆盖而非追加）。前端走 `id` 引用旧预设会变孤儿，但前端没有持久化 id 引用。**保留**（前端需自查）。

***

### 11.4 🐛 🔴 API 注入负预设 / 负 delta 攻击面

> 用户提问"有人利用 api 接口制作修改器，让属性预设为负数，最后影响属性的 bug 有没有"后，TDD 调研发现 3 个真实可利用的攻击向量。

#### 11.4.1 🔴 P0 `delta` 负数 → `attrPoints` 被恶意加满

**位置**：[`server/engine/player.js#saveAttrPreset`](computer://f:\aigongzuo\feiland-idle-game\server\engine\player.js) slot 路径的 delta 处理（原 line 439-449）

**症状**：

```bash
# 攻击者调用 POST /api/player/victim/attr-presets
# body: { name: 'x', slot: 0, attributes: {...}, delta: { atk: -999, def: 0, hp: 0, agi: 0 } }
# → player.attrPoints 从 50 暴涨到 1049！
```

**根因**：

```js
// 原代码（line 446-449）：
const used = (Number(delta.atk) || 0) + ...; // used = -999
if (player.attrPoints && player.attrPoints > 0) {
  player.attrPoints = Math.max(0, player.attrPoints - used); // = 50 - (-999) = 1049
}
```

`Math.max(0, X - 负数)` 反向放大 attrPoints。

**修复**：delta 各维度钳到 ≥ 0：

```js
const dAtk = Math.max(0, Math.floor(Number(delta.atk) || 0));
const dDef = Math.max(0, Math.floor(Number(delta.def) || 0));
const dHp  = Math.max(0, Math.floor(Number(delta.hp)  || 0));
const dAgi = Math.max(0, Math.floor(Number(delta.agi) || 0));
const used = dAtk + dDef + dHp + dAgi;
if (used > 0) {
  if (used > player.attrPoints) return { success: false, message: '属性点不足' };
  player.attributes.atk += dAtk;
  // ...
  player.attrPoints -= used;
}
```

**攻击影响**：在没有 JWT 鉴权（P0 1.1 修复前），借名攻击者对**任意受害者**一击送上千属性点，配合 `applyAttrPresetByRatio` 100% 给 atk → 一次性把受害者堆到几百万 atk → 影响战斗平衡 + 服务器压力（数值异常大导致战斗循环慢）。

#### 11.4.2 🟡 P1 `allocateAttributes` 混合负+正 → `player.attributes` 变负

**位置**：[`server/engine/player.js#allocateAttributes`](computer://f:\aigongzuo\feiland-idle-game\server\engine\player.js)（原 line 353-368）

**症状**：

```bash
# POST /api/player/victim/allocate
# body: { atk: -100, def: 200, hp: 100, agi: 100 }
# → player.attributes.atk = 5 + (-100) = -95
```

**根因**：

```js
// 原代码：total = atk + def + hp + agi = 300 > 0（通过"至少分配1点"校验）
//   → player.attributes.atk += -100 → 变负
```

**修复**：单维度分配钳到 ≥ 0：

```js
const aAtk = Math.max(0, Math.floor(Number(allocation.atk) || 0));
// ...
const total = aAtk + aDef + aHp + aAgi;
if (total < 1) return { success: false, message: '请至少分配1点' };
player.attributes.atk += aAtk;
```

**攻击影响**：让 `attributes.atk = -95`（负值）→ 后续战斗公式（`defenderHp -= attacker.atk`）会**反向给对手加血**，整个战斗系统错乱。

#### 11.4.3 🟢 P2 `saveAttrPreset` 不校验 `attributes` 数值范围

**位置**：同上 `saveAttrPreset` slot 路径

**症状**：攻击者写入 `attributes: { atk: Number.MAX_SAFE_INTEGER, def: NaN, hp: Infinity, agi: -1e6 }`，全部写入成功，污染存档。

**根因**：原代码直接 `{ ...attrs }` 写入，没有 sanitize。

**修复**：入口加 `sanitizeAttrPresetAttributes()`：

```js
const MAX_ATTR_VALUE = 100000; // 远大于正常上限（千级），但防溢出
function sanitizeAttrValue(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > MAX_ATTR_VALUE) return MAX_ATTR_VALUE;
  return Math.floor(n);
}
function sanitizeAttrPresetAttributes(attrs) {
  if (!attrs || typeof attrs !== 'object') return null;
  return {
    atk: sanitizeAttrValue(attrs.atk),
    def: sanitizeAttrValue(attrs.def),
    hp:  sanitizeAttrValue(attrs.hp),
    agi: sanitizeAttrValue(attrs.agi),
  };
}
```

* 负数 → 0

* NaN / Infinity → 0

* 字符串 → 0（`Number('evil')` = NaN → 0）

* 超大数（>100000）→ 100000

* 浮点数 → floor

**攻击影响**：

* **NaN/Infinity** 写入存档后，JSON 序列化变成 `null`，下次读出触发"预设数据无效"错误，但**已经污染了当前玩家的预设列表**（删也删不干净）

* **超大数** 让预设应用时 rsum 爆炸，4 维 floor 分配后几乎全部 = 0（除 1 维可能拿到 1 点），相当于"预设无效"

* **负数** 写入后，应用时 `r.atk = 0` → atk 维度消失，玩家看到"atk 不增长"

#### 11.4.4 ✅ `applyAttrPreset` / `applyAttrPresetByRatio` 已正确防御

* `applyAttrPreset`（player.js line 488-491）`const ra = Math.max(0, Number(preset.attributes.atk) || 0);` → 负预设自动转 0，rsum = 0 时返回错误

* `applyAttrPresetByRatio` 同样 Math.max(0, ...) 防御

**测试**：新增 [`server/engine/attr-negative-bug.test.js`](computer://f:\aigongzuo\feiland-idle-game\server\engine\attr-negative-bug.test.js) **15 用例**全部通过。

***

## 12. 内存优化（60 用户在线场景）

> 用户报告："2核2G服务器有40G储存，生产模式运行时有内存泄漏以及运行内存暴涨，60 用户时服务器带不动"。调查后修复 2 个真实永久累积泄漏 + 加 3 个内存优化。

### 12.1 🔴 P0 永久累积 #1 — arenaBots 永不清理

**位置**：[`server/routes/pvp.js:69`](computer://f:\aigongzuo\feiland-idle-game\server\routes\pvp.js) `meta.arenaBots[username] = { time, bots }`

**症状**：每次玩家调 `GET /api/arena/opponents/:username` 都写入 `meta.arenaBots[username]`。原代码**只在访问时**检查 10 分钟过期，**冷用户的 entry永远不会触发访问检查** → 永久驻留 → 60 用户 ≈ 120KB 永久累积 → 几百用户可达几 MB。

**修复**：v1.03 升级 — `arenaBots` 全部从 store meta 搬到**进程内存 Map**：

* [`server/store-sqlite.js`](computer://f:\aigongzuo\feiland-idle-game\server\store-sqlite.js)：`_arenaBotsCache`（Map + TTL + 硬上限 200 LRU）

* [`server/store-json.js`](computer://f:\aigongzuo\feiland-idle-game\server\store-json.js)：同

* [`server/routes/pvp.js`](computer://f:\aigongzuo\feiland-idle-game\server\routes\pvp.js)：用 `store.arenaBotsCacheSet/Get` 替代 `meta.arenaBots`

* 每次 `save()` 落盘前调 `trimArenaBots()` 清过期 + LRU

* 老存档 `meta.arenaBots` 加载时一次性搬到内存（兼容迁移）

**实测收益**：

* `snapshot()` 序列化体积减少 **500KB-2MB**（60 用户实测 snapshot 从 \~600KB → \~500KB）

* 永驻内存从 60+ entries → 最多 **200 entries**（硬上限）

* 不参与 SQLite/JSON 落盘（`safeSave` 跳过）

### 12.2 🔴 P0 永久累积 #2 — rate-limit buckets 无上限

**位置**：[`server/middleware/rate-limit.js`](computer://f:\aigongzuo\feiland-idle-game\server\middleware\rate-limit.js)

**症状**：攻击者伪造 `X-Forwarded-For:1.2.3.4` 灌入几万 IP（无 trust proxy 时 `req.ip` 走 header）→ 每个 IP 一个 bucket → **永久驻留直到60s 后才删**，60s 内可塞几万 entries。

**修复**：加 `MAX_BUCKETS_DEFAULT=10000` 硬上限 + `_evictIfFull()` LRU 淘汰：

* 优先淘汰已过期桶

* 仍超限则淘汰 Map 头部（最久未访问）

* 可通过 `rateLimit({ maxBuckets: N })` 覆盖

**实测**：20000 IPs → 10000 buckets（硬上限生效）。

### 12.3 ⚠️ GC 压力（不是泄漏，但产生"暴涨"）

| 路径                                          | 频率    | 单次临时分配              | 60 用户 × 60 min 累积 |
| ------------------------------------------- | ----- | ------------------- | ----------------- |
| `withTransaction` 的 `snapshot()`            | 每次写请求 | \~500KB 字符串         | \~6GB 临时分配/小时     |
| `safeSave` 的 `JSON.stringify + Buffer.from` | 每30s  | \~12MB 字符串 + Buffer | \~1.4GB 临时分配/小时   |

**V8 young generation 默认上限 \~16MB**，临时分配速度接近 GC 回收速度时触发 **major GC**（100-500ms 停顿）。**这是"感觉像内存暴涨"的真凶**——不是泄漏，是 GC 压力。

**缓解措施**（不是修复）：

* **优化 #1**：arenaBots 不再参与序列化（减少 500KB/次序列化）

* **优化 #2**：启动参数 `--max-old-space-size=512` 限制堆上限，避免被 OOM killer

* **优化 #3**：每分钟 heapPct 检查，超阈值告警 + 触发 major GC（需 `--expose-gc`）

### 12.4 ✅ 优化 #1 — arenaBots 从 store meta 搬到进程内存

见 12.1。配套导出 `arenaBotsCacheGet/Set/Delete/Clear/Stats` API。

### 12.5 ✅ 优化 #2 — 启动参数 + 内存监控

[`server/start-all.js`](computer://f:\aigongzuo\feiland-idle-game\server\start-all.js)：

```js
const MAX_OLD_SPACE = process.env.NODE_MAX_OLD_SPACE_SIZE || '512';
const EXPOSE_GC = process.env.ENABLE_EXPOSE_GC === '1';
const nodeOptions = [
  `--max-old-space-size=${MAX_OLD_SPACE}`,
  ...(EXPOSE_GC ? ['--expose-gc'] : []),
].join(' ');
if (!process.env.NODE_OPTIONS?.includes('--max-old-space-size')) {
  process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' ' + nodeOptions;
}
```

[`server/index.js`](computer://f:\aigongzuo\feiland-idle-game\server\index.js)：每分钟检查 heapPct：

```js
setInterval(() => {
  const mem = process.memoryUsage();
  const pct = (mem.heapUsed / mem.heapTotal * 100);
  if (pct >= HEAP_WARN_PCT) {
    console.warn(`⚠️ [内存监控] ${pct}% 超阈值`);
    if (global.gc) global.gc();  // 触发 major GC
  }
}, 60 * 1000);
```

### 12.6 ✅ 优化 #3 — `/api/diag/memory` + `/api/diag/health`

[`server/routes/diag.js`](computer://f:\aigongzuo\feiland-idle-game\server\routes\diag.js)：

* `GET /api/diag/health` → `{ ok: true, ts }` （轻量，用于 docker healthcheck / k8s liveness）

* `GET /api/diag/memory` →

```json
{
  "memory": { "heapUsedMB": 5.2, "heapTotalMB": 6.4, "heapPct": 81.3, "heapLimitMB": 512 },
  "store": { "playerCount": 60, "arenaBotsCache": { "size": 47, "max": 200, "hits": 120, "misses": 8 }, "dbSizeMB": 2.3 },
  "uptimeSeconds": 3600, "ts": 1693545600000
}
```

**安全保证**：不返回任何玩家数据 / password / token / name，仅返回聚合统计。

**测试**：新增 [`server/routes/diag.test.js`](computer://f:\aigongzuo\feiland-idle-game\server\routes\diag.test.js) **3 用例** 全部通过。

### 12.7 ⏸️ 优化 #4 — 5s 挂机循环批量提交

**评估结论**：**当前已是最优架构，无需修改**。

`runIdleLoop` 每 5s 跑一次：

1. 调 `engine.maybeResetWeeklyBossKills(store)`（重置检查）
2. 遍历所有玩家 `engine.calculateIdle(player)`（修改内存对象）
3. `store.safeSave()`（统一一次序列化 + 落盘）

这是"批量提交"的标准模式——所有修改累积，**统一一次 safeSave**。再优化要么改 idle 逻辑（高风险），要么让 safeSave 走异步队列（store-sqlite.js 已实现 `_saveInFlight + _pendingSave` 队列）。

***

## 附录：受影响的接口清单（按文件）

* [`server/index.js`](computer://f:\aigongzuo\feiland-idle-game\server\index.js) — 启动 + 定时器（5.1/5.2）

* [`server/store.js`](computer://f:\aigongzuo\feiland-idle-game\server\store.js) — 存档（1.2 / 2.1）

* [`server/routes/auth.js`](computer://f:\aigongzuo\feiland-idle-game\server\routes\auth.js) — 登录注册（1.1 / 1.2 / 1.3）

* [`server/routes/_helpers.js`](computer://f:\aigongzuo\feiland-idle-game\server\routes_helpers.js) — 通用 helper

* [`server/routes/player.js`](computer://f:\aigongzuo\feiland-idle-game\server\routes\player.js) — 玩家基础（1.1）

* [`server/routes/combat.js`](computer://f:\aigongzuo\feiland-idle-game\server\routes\combat.js) — 战斗/装备/锻造（1.1）

* [`server/routes/progression.js`](computer://f:\aigongzuo\feiland-idle-game\server\routes\progression.js) — 进阶（1.5）

* [`server/routes/pvp.js`](computer://f:\aigongzuo\feiland-idle-game\server\routes\pvp.js) — PvP（2.5）

* [`server/routes/worldboss.js`](computer://f:\aigongzuo\feiland-idle-game\server\routes\worldboss.js) — 世界 BOSS（1.1）

* [`server/routes/genesis.js`](computer://f:\aigongzuo\feiland-idle-game\server\routes\genesis.js) — 创世（2.9）

* [`server/routes/guild.js`](computer://f:\aigongzuo\feiland-idle-game\server\routes\guild.js) — 公会（2.3）

* [`server/routes/cockfight.js`](computer://f:\aigongzuo\feiland-idle-game\server\routes\cockfight.js) — 灵鸡斗场（2.6）

* [`server/routes/expedition.js`](computer://f:\aigongzuo\feiland-idle-game\server\routes\expedition.js) — 远征（2.4）

* [`server/web-server.js`](computer://f:\aigongzuo\feiland-idle-game\server\web-server.js) — 反代（2.7）

* [`server/engine/genesis.js`](computer://f:\aigongzuo\feiland-idle-game\server\engine\genesis.js) — 创世引擎（1.4 / 2.9）

* [`server/engine/idle.js`](computer://f:\aigongzuo\feiland-idle-game\server\engine\idle.js) — 挂机（5.1）

* [`server/engine/settlement.js`](computer://f:\aigongzuo\feiland-idle-game\server\engine\settlement.js) — 结算校验（部分缓解但不够）

* [`client/src/App.vue`](computer://f:\aigongzuo\feiland-idle-game\client\src\App.vue) — 5s 轮询

* [`client/src/api.js`](computer://f:\aigongzuo\feiland-idle-game\client\src\api.js) — 网络错误处理（3.6）

* [`docker-compose.yml`](computer://f:\aigongzuo\feiland-idle-game\docker-compose.yml) — 健康检查（3.5）

