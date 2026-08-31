# v1.03 综合修订汇总 · 2026-08-31

> 本文档是 2026-08-31 针对费兰德世界 v1.03 进行的**所有修订**的**汇总**。
> 它不是详细的修复报告（详见 `SECURITY_AUDIT.md` / `CODE_INDEX.md` / `DEPLOY.md`），而是给你一个**全局视角**快速看清"改了什么、为什么改、怎么部署"。
>
> 详细信息请查看以下文档：
>
> | 文档 | 内容 | 行数 |
> |------|------|------|
> | [`docs/SECURITY_AUDIT.md`](SECURITY_AUDIT.md) | P0-P2 安全审计 + 内存优化 + 修复状态 | ~53KB |
> | [`docs/CODE_INDEX.md`](CODE_INDEX.md) | 代码索引（v4.0）+ JWT/SQLite/内存优化章节 | ~47KB |
> | [`docs/DEPLOY.md`](DEPLOY.md) | 部署升级指南（备份/JWT_SECRET/内存推荐/验证清单） | ~8KB |
> | [`docs/README/06-changelog.md`](README/06-changelog.md) | 版本历史（含 v1.03 修订章节） | - |
> | [`docs/AI_NOTES.md`](AI_NOTES.md) | AI 极速备忘 | ~3KB |

---

## 0. TL;DR

**今天我帮你做了 4 件事**：

| # | 主题 | 起因 | 主要产出 | 测试 |
|---|------|------|----------|------|
| 1 | **生产模式安全审计 + 修复** | "如果60 用户在线跑生产模式会出什么问题" | 修复 21 个问题（5 P0 + 10 P1 + 6 P2） | +63 用例 |
| 2 | **属性预设 Bug 调查** | "属性预设有 bug 吗" | 修复 2 个真 bug（误删 preset + 余数分配不公平） | +26 用例 |
| 3 | **API 注入负数攻击面调查** | "有人利用 API 修改器让预设变负数" | 修复 3 个真 bug（attrPoints 暴涨 + attributes 变负 + 不 sanitize） | +15 用例 |
| 4 | **生产环境内存泄漏调查 + 优化** | "60 用户内存暴涨服务器带不动" | 修复 2 个永久累积泄漏 + 3 个架构优化 | +10 用例 |

**测试结果**：从最初的 **242 通过** → **356 通过**（新增 **114 个** 测试用例覆盖所有改动）。

---

## 1. 安全审计与修复（最核心）

### 1.1 主要问题（修复前）

**核心安全漏洞**："后端没有任何鉴权层"——任何人都可以借任意用户名调任何接口。

```js
// 修复前：调用 /api/player/victim/affix 就能卸掉受害者的词条
// 修复后：必须带 JWT token，且 token.username 必须等于 :username
```

**21 个问题分布**：
- 🔴 P0 致命（5 项）：无 JWT 鉴权 / 密码明文 / 无限刷号 / 创世预算 NaN 绕过 / auto-reincarnate 生产暴露
- 🟡 P1 高级（10 项）：PvP 预测 / 时区错位 / 反代无超时 / body 无限制 / 创世装备永久 / 5s 循环堆积 / 重复 timer / CORS 全开 / 公会权限 / 排行榜无分页
- 🟢 P2 中级（6 项）：无审计 / 公告无长度 / 名字无白名单 / 资产无缓存 / docker healthcheck / api.js 错误吞错

### 1.2 主要修复

| 修复 | 文件 |
|------|------|
| **JWT 鉴权（HMAC-SHA256，零依赖）** | `server/middleware/auth.js` + 所有 routes |
| **bcrypt 密码哈希（自动升级老明文）** | `server/middleware/password.js` |
| **IP 速率限制（零依赖 token bucket）** | `server/middleware/rate-limit.js` |
| **PvP requestId 服务端 HMAC 签名** | `server/middleware/nonce.js` |
| **审计日志（敏感字段自动脱敏）** | `server/middleware/audit-log.js` |
| **SQLite WAL 后端（异步落盘 + epoch 守卫）** | `server/store-sqlite.js` |
| **CORS 白名单** | `server/index.js` |
| **创世装备每日 5% 衰减** | `server/engine/genesis.js` |
| **5s 挂机循环 setTimeout 自递归** | `server/index.js` |
| **express.json 100KB body 限制 + 反代 30s 超时 + body 1MB 限制** | `server/index.js` + `server/web-server.js` |
| **创世预算 NaN 绕过（`Number.isFinite` 校验）** | `server/engine/genesis.js#forgeEquip` |
| **auto-reincarnate 生产环境禁用** | `server/routes/progression.js` |

### 1.3 详细文档

→ 详见 [`docs/SECURITY_AUDIT.md`](SECURITY_AUDIT.md) 第 1-10 章（修复状态）和第 11-12 章（后续发现）

---

## 2. 属性预设 Bug 调查

### 2.1 发现的 2 个真 Bug

| Bug | 症状 | 修复 |
|------|------|------|
| **deleteAttrPresetBySlot 误删** | 玩家保存 3 个预设（slot 0/1/2），删 slot 1 实际把 slot 2 也吃了 | `migratePlayer` 不再 `filter(Boolean)` 删 null 占位 + `deleteAttrPresetBySlot` 直接用原始索引 |
| **applyAttrPreset 余数分配不公平** | 4 维同权 `r={1,1,1,1}` 时余数全给第一个维度，结果 `12/3/3/3` 而不是 `9/9/9/9` | 余数改成循环分配给权重最大的前 N 个维度 |

### 2.2 详细文档

→ 详见 [`docs/SECURITY_AUDIT.md`](SECURITY_AUDIT.md) 第 11 章

---

## 3. API 负数注入攻击面调查

### 3.1 发现的 3 个真 Bug

| Bug | 攻击剧本 | 严重度 | 修复 |
|------|---------|--------|------|
| **`saveAttrPreset` delta 负数** | POST `{ delta: {atk:-999} }` → attrPoints 从 50 暴涨到 1049 | 🔴 P0 | delta 各维度钳到 ≥ 0 + 加 `used > attrPoints` 透支校验 |
| **`allocateAttributes` 混合负+正** | POST `{ atk:-100, def:200, hp:100, agi:100 }` → total=300 通过，但 atk 变 -95 | 🟡 P1 | 单维度分配钳到 ≥ 0 |
| **`saveAttrPreset` attributes 不 sanitize** | POST `attributes: {atk:NaN, hp:Infinity, def:-1e6, agi:Number.MAX_SAFE_INTEGER}` | 🟢 P2 | 入口加 `sanitizeAttrPresetAttributes()`：负/NaN/Infinity/字符串→0；超大→100000；浮点→floor |

### 3.2 详细文档

→ 详见 [`docs/SECURITY_AUDIT.md`](SECURITY_AUDIT.md) 第 11.4 章

---

## 4. 内存优化（生产环境 60 用户）

### 4.1 发现的 2 个真永久累积泄漏

| 泄漏 | 60 用户影响 | 修复 |
|------|------------|------|
| **`meta.arenaBots` 永不清理** | 60+ entries × 永久驻留（冷用户 entry 永远没机会被过期检查清掉） | 搬到进程内存 `_arenaBotsCache`（Map + TTL 10 分钟 + 硬上限 200 + LRU 淘汰）|
| **`rate-limit` buckets 无上限** | 攻击者伪造 X-Forwarded-For 灌入几万 IP | 加 `MAX_BUCKETS_DEFAULT=10000` 硬上限 + LRU 淘汰 |

### 4.2 3 个架构优化

| 优化 | 收益 | 文件 |
|------|------|------|
| **arenaBots 从 store meta 搬到进程内存** | snapshot 序列化体积减少 500KB+，永驻从 60+ → ≤ 200 | `server/store-sqlite.js` + `server/store-json.js` + `server/routes/pvp.js` |
| **启动参数 `--max-old-space-size` + 每分钟 heapPct 监控** | 防 OOM kill + 提前告警 | `server/start-all.js` + `server/index.js` |
| **新增 `/api/diag/health` + `/api/diag/memory`** | 实时监控（docker/k8s/Prometheus 友好）| `server/routes/diag.js` |

### 4.3 数据迁移安全性（额外发现）

**用户问"代码更新会否影响用户存档"时主动发现的 2 个真 bug**：

| Bug | 线上症状 | 修复 |
|------|---------|------|
| `migratePlayer` 用 `=== undefined` 检查数字字段 | 老存档 `killCount: null` / `combatStats.todayKills: "abc"` 不会被修正 → 战斗计数异常 | 改成 `Number.isFinite()` 一致检查 6 个数字字段 |
| `view.js` 直接 `player.logs.slice(-20)` | 老存档缺 `logs` 字段 → TypeError → 所有玩家 view 500 | 改成 `Array.isArray(player.logs) ? ... : []` |

**这 2 个 bug 不修，git pull 后老用户登录会全部崩溃**。

### 4.4 详细文档

→ 详见 [`docs/SECURITY_AUDIT.md`](SECURITY_AUDIT.md) 第 12 章

---

## 5. 部署改动（Docker）

### 5.1 Dockerfile

```dockerfile
# 加内存限制
ENV NODE_OPTIONS="--max-old-space-size=384"
# 改默认数据库后端
ENV DB_PATH=/app/data/db          # SQLite WAL（自动检测）
# 加健康检查阈值
ENV HEAP_WARN_PCT=80
```

### 5.2 docker-compose.yml

```yaml
environment:
  # 内存优化
  - NODE_MAX_OLD_SPACE_SIZE=${NODE_MAX_OLD_SPACE_SIZE:-384}
  - ENABLE_EXPOSE_GC=${ENABLE_EXPOSE_GC:-1}    # ← 启用 major GC 触发
  - HEAP_WARN_PCT=${HEAP_WARN_PCT:-80}
  # 安全
  - CORS_ORIGIN=${CORS_ORIGIN:-...}
  - AUDIT_LOG=${AUDIT_LOG:-on}
  - JWT_SECRET=${JWT_SECRET:?生产环境必须设置}  # ← 强制要求
mem_limit: ${MEM_LIMIT:-512m}
healthcheck:
  test: ["CMD-SHELL", "wget ...3000/", "wget ...3001/api/diag/health"]  # ← 加 diag 检查
```

### 5.3 新建 `start-prod.sh`

Linux/Docker 一键启动脚本：自动注入内存参数 + 自动生成 JWT_SECRET + 自动建数据目录。

### 5.4 详细文档

→ 详见 [`docs/DEPLOY.md`](DEPLOY.md)

---

## 6. 全部文件改动清单（25 修改 + 14 新增 = 39 个）

### 6.1 修改的文件

| 文件 | 主要改动 |
|------|---------|
| `Dockerfile` | 内存参数 + 健康检查 endpoint |
| `docker-compose.yml` | 环境变量 + mem_limit |
| `server/start-all.js` | 自动注入 `--max-old-space-size` + `--expose-gc` |
| `server/index.js` | 异步 IIFE + 5s 自递归 + 内存监控 + ETag |
| `server/store.js` | 派发层（store-sqlite/store-json 拆出） |
| `server/engine/player.js` | sanitize + migrate 修复 + view 防御 + attrPresets bug |
| `server/engine/view.js` | `logs.slice` 防御 |
| `server/engine/genesis.js` | NaN 校验 + 衰减 + name 白名单 |
| `server/engine/index.js` | 新导出 + 模块整合 |
| `server/engine/state.js` | `getNow()` 时间 seam |
| `server/engine/attr-preset.test.js` | 修复 2 旧用例预期 |
| `server/routes/index.js` | 鉴权中间件 + diag routes 注册 |
| `server/routes/auth.js` | bcrypt + JWT + rate-limit |
| `server/routes/pvp.js` | JWT + arenaBotsCache + 排行榜分页 |
| `server/routes/worldboss.js` | admin token + 时区统一 |
| `server/routes/cockfight.js` | 创建时间服务端生成 |
| `server/routes/guild.js` | 公告长度校验 |
| `server/routes/leaderboard.js` | 分页 |
| `server/routes/progression.js` | auto-reincarnate 生产禁用 |
| `server/web-server.js` | timeout + body 限 |
| `client/src/App.vue` | API 错误回调 + 401 自动恢复 |
| `client/src/api.js` | Authorization 头 + 错误日志 |
| `docs/CODE_INDEX.md` | v4.0 整合 + 3 个新章节 |
| `docs/AI_NOTES.md` | 极速备忘 |
| `package.json` / `package-lock.json` | sql.js 依赖 |

### 6.2 新增的文件

| 文件 | 行数（大概） | 内容 |
|------|------------|------|
| `server/middleware/auth.js` | ~120 | JWT 签发 + 4 个鉴权中间件 |
| `server/middleware/password.js` | ~80 | bcrypt + pbkdf2 |
| `server/middleware/rate-limit.js` | ~70 | IP token bucket |
| `server/middleware/nonce.js` | ~50 | PvP requestId HMAC |
| `server/middleware/audit-log.js` | ~80 | res.on('finish') 审计日志 |
| `server/store-sqlite.js` | ~280 | SQLite WAL 后端 |
| `server/store-json.js` | ~270 | JSON 后端（拆出） |
| `server/migrate-json-to-sqlite.js` | ~80 | JSON → SQLite 迁移脚本 |
| `server/routes/diag.js` | ~70 | `/api/diag/health` + `/api/diag/memory` |
| `server/engine/attr-negative-bug.test.js` | ~250 | 15 用例（负数注入） |
| `server/engine/attr-preset-bug.test.js` | ~400 | 26 用例（属性预设 bug） |
| `server/engine/genesis-budget.test.js` | ~200 | 13 用例（创世预算边界） |
| `server/engine/genesis-decay.test.js` | ~150 | 5 用例（衰减） |
| `server/memory-leak.test.js` | ~270 | 10 用例（内存泄漏量化） |
| `server/migration-safety.test.js` | ~310 | 10 用例（v1.02→v1.03 数据迁移） |
| `server/routes/diag.test.js` | ~110 | 3 用例（diag endpoints） |
| `server/store-sqlite.test.js` | ~250 | 8 用例（SQLite 兼容性） |
| `server/middleware/audit-log.test.js` | ~120 | 3 用例（审计） |
| `docs/SECURITY_AUDIT.md` | ~53KB | 完整审计报告 |
| `docs/DEPLOY.md` | ~8KB | 部署升级指南 |
| `docs/SUMMARY_v1.03.md` | 本文件 | 综合汇总 |

---

## 7. 测试统计

```
之前（v1.03 起步）：242 个测试
现在（v1.03 综合修订）：356 个测试
新增：+114 个测试用例（覆盖所有改动）

# tests 356
# suites 43
# pass 356
# fail 0
# cancelled 0
```

**全绿**。

---

## 8. 风险评估（升级前必看）

### 8.1 数据兼容性

| 维度 | 状态 |
|------|------|
| **用户存档丢失风险** | ✅ 无（migrate 10 个场景全过） |
| **老 corrupted 数据** | ✅ 自动修正（killCount null、NaN、字符串） |
| **跨版本行为差异** | ✅ 客户端无感知 |

### 8.2 部署风险

| 维度 | 状态 |
|------|------|
| **启动失败风险** | 🔴 `JWT_SECRET` 必须显式设（否则生产启动直接 throw） |
| **容器 OOM 风险** | ✅ 已加 `--max-old-space-size` 限制 + 监控告警 |
| **数据库迁移风险** | ⚠️ JSON → SQLite 可选；不改也行（兼容） |
| **回滚可行性** | ✅ 备份 + 回滚文档（`DEPLOY.md` §5） |

### 8.3 建议升级顺序

1. **先备份**（db.json 或 db.sqlite）
2. **生成 JWT_SECRET**（`openssl rand -hex 32`）
3. **git pull** + **重新构建镜像**
4. **`docker-compose up -d`** + **查看启动日志**
5. **`curl /api/diag/health`** 确认正常
6. **观察 `/api/diag/memory`** 几小时，确认 heapPct < 80%
7. **正式开放玩家访问**

---

## 9. 下一步建议（可选）

| 优先级 | 任务 | 预期收益 |
|--------|------|---------|
| 🟢 低 | 把本次所有改动 commit + push 到 GitHub | 让团队其他人能同步 |
| 🟢 低 | 加 Prometheus 抓取 `/api/diag/memory` | 监控大盘可视化 |
| 🟡 中 | 数据库从 JSON 迁到 SQLite（`migrate-json-to-sqlite.js`） | 并发安全 + 异步落盘 |
| 🟡 中 | 老前端清理：删掉手动 try/catch + console.log 调试代码 | 降低 bundle 体积 |
| 🔴 高 | **暂时不需要了**，先把上面 8.1 的清单做完就能上线 |

---

## 10. 相关文档导航

| 想了解 | 看 |
|--------|------|
| 安全审计 + 修复状态 | [`docs/SECURITY_AUDIT.md`](SECURITY_AUDIT.md) 第 1-12 章 |
| 代码索引 | [`docs/CODE_INDEX.md`](CODE_INDEX.md) |
| 部署升级 | [`docs/DEPLOY.md`](DEPLOY.md) |
| 版本历史 | [`docs/README/06-changelog.md`](README/06-changelog.md) |
| AI 协作 | [`docs/AI_NOTES.md`](AI_NOTES.md) |

---

**文档最后更新**：2026-08-31

**总工作量**：约 1300 行新增代码 + 500 行删除 + 114 个测试用例 + 4 份文档