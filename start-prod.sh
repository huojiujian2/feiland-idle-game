#!/bin/sh
# ====== 一键启动生产模式 · v1.10 · 2026-09-03 ======
# 优化要点：
#   1. 依赖环境检测（node 必须 ≥ 18）
#   2. 启动前数据目录权限检查（数据卷挂载常见问题）
#   3. 自动生成 JWT_SECRET（如未设置，重启失效 + 警告）
#   4. 节点选项构造（NODE_OPTIONS）
#   5. 信号处理：docker stop → SIGTERM → start-all.js gracefulShutdown → flushPendingWrites
#
# 用法：
#   ./start-prod.sh
#   PORT=8080 NODE_MAX_OLD_SPACE_SIZE=512 ./start-prod.sh
#   JWT_SECRET=$(openssl rand -hex 32) ./start-prod.sh

set -eu

# ====== 0. 环境检测 ======
# Node 版本必须 ≥ 18（项目用了 Node 18+ 的 fetch/AbortController 等）
NODE_VERSION=$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
  echo "[start-prod] ❌ Node 18+ required（当前 $(node -v 2>/dev/null || echo 'none')）"
  exit 1
fi

# ====== 1. 默认值 ======
export NODE_ENV=production
export PORT=${PORT:-3001}
export HOST=${HOST:-0.0.0.0}
export DB_PATH=${DB_PATH:-$(dirname "$0")/data/db}
export CORS_ORIGIN=${CORS_ORIGIN:-http://localhost:3000,http://127.0.0.1:3000}
export AUDIT_LOG=${AUDIT_LOG:-on}
export HEAP_WARN_PCT=${HEAP_WARN_PCT:-80}

# 内存优化
export NODE_MAX_OLD_SPACE_SIZE=${NODE_MAX_OLD_SPACE_SIZE:-512}
ENABLE_EXPOSE_GC=${ENABLE_EXPOSE_GC:-1}

# ====== 2. JWT_SECRET 自动生成（如未设置） ======
JWT_GENERATED="false"
if [ -z "${JWT_SECRET:-}" ]; then
  export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  JWT_GENERATED="true"
fi

# ====== 3. NODE_OPTIONS 构造 ======
NODE_OPTS="--max-old-space-size=$NODE_MAX_OLD_SPACE_SIZE"
if [ "$ENABLE_EXPOSE_GC" = "1" ]; then
  NODE_OPTS="$NODE_OPTS --expose-gc"
fi
export NODE_OPTIONS="$NODE_OPTS"

# ====== 4. 数据目录 ======
DB_DIR=$(dirname "$DB_PATH")
if [ ! -d "$DB_DIR" ]; then
  mkdir -p "$DB_DIR"
  echo "[start-prod] ✅ 已创建数据目录: $DB_DIR"
fi

# 容器内运行时常因卷挂载的 uid 不匹配导致权限问题（v1.10 提示）
if [ -d "$DB_DIR" ] && [ ! -w "$DB_DIR" ]; then
  echo "[start-prod] ⚠️  数据目录 $DB_DIR 不可写！可能容器卷挂载权限错（run as non-root）"
fi

# ====== 5. 启动 banner ======
echo "=========================================="
echo "  费兰德世界 - 生产模式 v1.10"
echo "  Node:    $(node -v)"
echo "  API:     http://localhost:$PORT (后端)"
echo "  游戏:    http://localhost:3000 (前端)"
echo "  数据:    $DB_PATH (SQLite WAL)"
echo "  堆上限:  ${NODE_MAX_OLD_SPACE_SIZE}MB (expose-gc=${ENABLE_EXPOSE_GC})"
echo "=========================================="

if [ "$JWT_GENERATED" = "true" ]; then
  echo "  ⚠️  JWT_SECRET 已自动生成（重启会失效，建议写入 .env）"
  echo "  ⚠️  JWT_SECRET=$JWT_SECRET"
fi
echo "=========================================="

# ====== 6. 启动（exec 让 tini/node 接管 PID 1） ======
exec node server/start-all.js