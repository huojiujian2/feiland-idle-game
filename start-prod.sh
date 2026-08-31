#!/bin/sh
# ====== 一键启动生产模式 · v1.03 ======
# 包含：
#   1. Node 堆上限限制（默认 384MB，可通过 NODE_MAX_OLD_SPACE_SIZE 覆盖）
#   2. --expose-gc（让内存监控可主动触发 major GC，可通过 ENABLE_EXPOSE_GC=0 关闭）
#   3. 自动检测并生成 JWT_SECRET（如果未传）
#   4. 启用 SQLite WAL 后端（如果 DB_PATH 指向 .json，自动改用 SQLite）
#
# 用法：
#   ./start-prod.sh                 # 用默认参数启动
#   PORT=8080 NODE_MAX_OLD_SPACE_SIZE=512 ./start-prod.sh   # 自定义
#
# v1.03 内存优化：
#   - 默认 --max-old-space-size=384（容器内存 512MB 时安全）
#   - --expose-gc 让 server/index.js 内存监控的 global.gc() 能工作
#   - 每分钟检查 heapPct，超阈值（默认 80）打 warn + 触发 GC

set -e

# ====== 默认值 ======
export NODE_ENV=production
export PORT=${PORT:-3001}
export HOST=${HOST:-0.0.0.0}
export DB_PATH=${DB_PATH:-$(dirname "$0")/data/db}
export CORS_ORIGIN=${CORS_ORIGIN:-http://localhost:3000,http://127.0.0.1:3000}
export AUDIT_LOG=${AUDIT_LOG:-on}
export HEAP_WARN_PCT=${HEAP_WARN_PCT:-80}

# 内存优化参数
export NODE_MAX_OLD_SPACE_SIZE=${NODE_MAX_OLD_SPACE_SIZE:-384}
ENABLE_EXPOSE_GC=${ENABLE_EXPOSE_GC:-1}

# ====== 自动生成 JWT_SECRET（如未设置） ======
if [ -z "$JWT_SECRET" ]; then
  if command -v node >/dev/null 2>&1; then
    export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo "[start-prod] ⚠️  JWT_SECRET 未设置，已自动生成（重启会失效，建议写入 .env 或 docker-compose secrets）："
    echo "[start-prod] JWT_SECRET=$JWT_SECRET"
  else
    echo "[start-prod] ❌ JWT_SECRET 未设置且 node 不可用，无法启动"
    exit 1
  fi
fi

# ====== 构造 NODE_OPTIONS ======
NODE_OPTS="--max-old-space-size=$NODE_MAX_OLD_SPACE_SIZE"
if [ "$ENABLE_EXPOSE_GC" = "1" ]; then
  NODE_OPTS="$NODE_OPTS --expose-gc"
fi
export NODE_OPTIONS="$NODE_OPTS"

# ====== 创建数据目录 ======
DB_DIR=$(dirname "$DB_PATH")
if [ ! -d "$DB_DIR" ]; then
  mkdir -p "$DB_DIR"
  echo "[start-prod] 已创建数据目录: $DB_DIR"
fi

echo "=========================================="
echo "  费兰德世界 - 生产模式启动 v1.03"
echo "  API 地址: http://localhost:$PORT (后端)"
echo "  游戏地址: http://localhost:3000 (前端)"
echo "  数据目录: $DB_PATH (SQLite WAL)"
echo "  堆上限:   ${NODE_MAX_OLD_SPACE_SIZE}MB (${ENABLE_EXPOSE_GC:-0} GC 暴露)"
echo "=========================================="

# ====== 启动 ======
exec node server/start-all.js