# ====== v1.03 升级部署指南 · 2026-08-31 ======

> 本次升级（v1.02 → v1.03）涉及**业务逻辑、攻击面修复、内存优化、数据库格式变化**。
> 涉及用户存档的兼容性改动均有完整的迁移测试保障（10 个场景，全通过）。

---

## 0. 升级前的准备工作

### 0.1 备份（必做）

```bash
# Docker 部署
docker exec feiland-game cp /app/data/db.json /app/data/db.json.v102.bak
# 或
docker exec feiland-game cp /app/data/db.sqlite /app/data/db.sqlite.v102.bak

# 裸机部署
cp server/db.json server/db.json.v102.bak
cp server/db.sqlite server/db.sqlite.v102.bak  # 如果之前迁移过 SQLite
```

### 0.2 检查 `JWT_SECRET`

**生产环境 v1.03 强制要求 `JWT_SECRET` 已设置**（否则启动失败）。

```bash
# 生成 32 字节随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 0.3 检查容器内存限制

`NODE_MAX_OLD_SPACE_SIZE` 必须 ≤ 容器内存限制的 75%（预留 25% 给 V8 老生代 + 监控开销）。

| 容器内存 | 推荐 NODE_MAX_OLD_SPACE_SIZE |
|---|---|
| 512MB | 384MB |
| 1GB | 768MB |
| 2GB | 1536MB |

---

## 1. 升级流程（Docker）

```bash
# 1. 拉取新代码
cd /path/to/feiland-idle-game
git pull

# 2. 重新构建镜像
docker-compose build --no-cache

# 3. 启动新容器（自动重启策略确保失败时也会重启）
JWT_SECRET=$(openssl rand -hex 32) docker-compose up -d

# 4. 检查启动日志（应看到"已加载 N 个账号, N 个角色"）
docker logs feiland-game --tail 50

# 5. 验证 /api/diag/health
curl http://localhost:3001/api/diag/health

# 6. 验证 /api/diag/memory（看 arenaBotsCache.size 是否 < 200）
curl http://localhost:3001/api/diag/memory | jq .
```

---

## 2. 数据库迁移（仅当之前用 JSON 时）

**首次升级到 v1.03 时，store 会自动检测 db.sqlite 是否存在**：
- 存在 → 继续用 SQLite
- 不存在 → 继续用 JSON（默认 `DB_PATH=/app/data/db.json`）

**如果你想切到 SQLite**（推荐，异步落盘 + epoch 守卫）：

```bash
# 在容器内执行迁移脚本
docker exec feiland-game node server/migrate-json-to-sqlite.js

# 验证
docker exec feiland-game ls -la /app/data/
# 应该看到 db.sqlite db.json (备份) db.sqlite-wal db.sqlite-shm

# 重启容器让 store 走 SQLite
docker restart feiland-game
```

---

## 3. 用户存档兼容性（v1.02 → v1.03）

### 3.1 自动迁移的字段（无害，migrate 时自动补全）

| 字段 | 老存档行为 | v1.03 行为 |
|---|---|---|
| `expedition` | 可能缺 | 初始化为 null |
| `expeditionHistory` | 可能缺 | 初始化为 [] |
| `expeditionReports` | 可能缺 | 初始化为 {} |
| `expeditionCodex` | 可能缺 | 初始化为 {} |
| `cockfight` | 可能缺 | 初始化为完整对象 |
| `dailyActive` | 可能缺 | 初始化为完整对象 |
| `guildId/Role/Contribution` | 可能缺 | 初始化为 null/0 |
| `reincarnation/bossKills/faith/killCount` | 可能缺 | 初始化为 0 |
| `attrPoints/skillPoints` | 可能缺 | 初始化为 0 |
| `pvpStats` | 可能缺 | 初始化为完整对象 |

### 3.2 自动修正的字段（老 corrupted 数据，migrate 时修复）

| 字段 | 老存档可能为 | v1.03 修正为 |
|---|---|---|
| `killCount` | null / NaN / 字符串 | 0 |
| `skillPoints/raceStage/faith/reincarnation/bossKills` | null / NaN | 0 |
| `combatStats.{totalWins,totalLosses,totalDraws,todayKills,monthKills}` | null / NaN / 字符串 | 0 |
| `titleExpiry[key]` | NaN / Infinity / 字符串 / ≤0 | 剔除该 key |
| `titles[key]` | 非合法 titleKey | 剔除该 key |
| `attributes` 用旧名 `strength/constitution/agility` | 旧格式 | 自动转为 atk/def/hp/agi |
| `inventory` 里有 `type="equip"` 项 | 装备已转移到 equips | 仅留材料/消耗品 |
| `cockfight.history` | 可能不是数组 | 初始化为 [] |

### 3.3 修复的已知 Bug（不会破坏老数据，反而修正）

| Bug | 修复前影响 | 修复后 |
|---|---|---|
| `meta.arenaBots` 永不清理 | 60+ 永久累积 | 自动搬到进程内存 + 硬上限 200 |
| `attrPresets[null]` 被 filter | 删 slot=1 会误删 slot=2 | null 占位保留 |
| `allocateAttributes` 负值 | attributes 变负 | 钳到 0 |
| `saveAttrPreset` delta 负数 | attrPoints 被恶意加满 | 钳到 0 |
| `view.js` player.logs.slice 崩溃 | 老存档缺 logs → TypeError | fallback 到 [] |
| rate-limit 无上限 | 攻击者灌满 buckets | 硬上限 10000 + LRU |

### 3.4 行为变化（前端需要相应调整，如已使用）

| 行为 | 修复前 | 修复后 |
|---|---|---|
| `applyAttrPreset` 余数分配 | 全给权重最大维度 | 循环分配给前 N 个 |
| JWT 鉴权 | 不存在 | `/api/player/:u/*` 70+ 路由全需要 token |
| 注册/登录 rate-limit | 不存在 | 5/min（注册）/ 10/min（登录） |
| 密码 | 明文 | bcrypt 哈希（自动升级老明文） |
| 创世装备 | 永久化 | 每日 5% 衰减（floor 60%） |
| auto-reincarnate | 任何时候可调 | 生产模式禁用（除非 `ENABLE_AUTO_REINCARNATE=true`） |

---

## 4. 验证清单

升级后跑一遍：

```bash
# 1. 健康检查
curl http://localhost:3001/api/diag/health
# 期望: {"success":true,"data":{"ok":true,"ts":...}}

# 2. 内存监控
curl http://localhost:3001/api/diag/memory | jq .
# 期望: memory.heapPct < 80（无告警）

# 3. 公开数据
curl http://localhost:3001/api/areas | jq '.data | length'
# 期望: > 0（地图数据加载成功）

# 4. 创建一个测试账号（端到端验证）
curl -X POST http://localhost:3001/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"_upgrade_test","password":"test123","characterName":"Test"}'
# 期望: {"success":true,...}

# 5. 登录拿 token
TOKEN=$(curl -s -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"_upgrade_test","password":"test123"}' | jq -r .token)

# 6. 创建角色
curl -X POST http://localhost:3001/api/player/_upgrade_test/create-character \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"charName":"TestHero"}'

# 7. 查看角色
curl http://localhost:3001/api/player/_upgrade_test \
  -H "Authorization: Bearer $TOKEN" | jq '.data.player.level, .data.player.name'
# 期望: level=1 name="TestHero"

# 8. 删除测试账号
curl -X DELETE http://localhost:3001/api/player/_upgrade_test \
  -H "Authorization: Bearer $TOKEN"
```

---

## 5. 回滚方案

如果升级后发现问题：

```bash
# Docker
docker stop feiland-game
docker run -d --name feiland-game-rollback \
  -v game-data-rollback:/app/data \
  -p 3000:3000 \
  feiland-idle-game:v1.02
# 然后从备份恢复数据：
docker cp /path/to/db.json.v102.bak feiland-game-rollback:/app/data/db.json
docker restart feiland-game-rollback
```

---

## 6. 性能监控指标

升级后建议接入这些监控：

| 指标 | 来源 | 告警阈值 |
|---|---|---|
| heapPct | `/api/diag/memory` | ≥ 80% 警告，≥ 90% 严重 |
| arenaBotsCache.size | `/api/diag/memory` | ≥ 180（接近硬上限 200） |
| playerCount | `/api/diag/memory` | 看业务 |
| rssMB | `/api/diag/memory` | ≥ 80% 容器内存 |
| safeSaveError | 日志 `getLastSaveError()` | 任何错误 |

Prometheus 抓取示例：
```yaml
scrape_configs:
  - job_name: feiland_game
    metrics_path: /api/diag/memory
    static_configs:
      - targets: ['feiland-game:3001']
```

---

## 7. 总结

| 项 | 状态 |
|---|---|
| 用户数据兼容性 | ✅ 10 个迁移场景测试全通过 |
| 老 corrupted 数据 | ✅ 自动修正（killCount null/NaN 等） |
| 业务逻辑变化 | ✅ 全部向上兼容 + 有回滚方案 |
| 内存优化 | ✅ 2 个真实泄漏修复 + 3 个优化 |
| JWT_SECRET 必传 | ✅ docker-compose 强制要求 |
| 容器内存限制 | ✅ 默认 512MB + NODE_MAX_OLD_SPACE_SIZE=384 |
| 监控 endpoint | ✅ `/api/diag/health` + `/api/diag/memory` |

**356/356 测试通过，可以放心升级**。