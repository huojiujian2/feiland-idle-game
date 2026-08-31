# ====== 阶段1：构建前端 ======
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm（避免 corepack 版本问题）
RUN npm install -g pnpm

# 复制依赖文件
COPY package.json ./
COPY pnpm-lock.yaml* ./

# 安装依赖（含 devDependencies 用于构建前端）
RUN pnpm install --no-frozen-lockfile

# 复制源码
COPY . .

# 构建前端
RUN pnpm build

# ====== 阶段2：运行时 ======
FROM node:20-alpine AS runtime

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 安装生产依赖
COPY package.json ./
COPY pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile --prod

# 复制后端代码
COPY --from=builder /app/server ./server

# 复制前端构建产物
COPY --from=builder /app/client/dist ./client/dist

# 数据持久化目录
RUN mkdir -p /app/data

# v1.03：限制 Node 堆上限（防 OOM 被系统 kill）
#   容器内存限制 ≥ 512MB 时推荐 384；≥ 1GB 时推荐 768；≥ 2GB 时推荐 1024
#   可通过环境变量 NODE_MAX_OLD_SPACE_SIZE 覆盖
ENV NODE_OPTIONS="--max-old-space-size=384"
ENV NODE_ENV=production
ENV PORT=3001
# v1.03：默认走 SQLite WAL（避免 JSON 文件并发 + 异步落盘）
#   自动检测已存在 db.sqlite 自动用 SQLite
ENV DB_PATH=/app/data/db
ENV HOST=0.0.0.0
# v1.03：内存监控阈值（heapPct >= 80 时打 warn）
ENV HEAP_WARN_PCT=80

# 暴露端口（3000=前端页面，3001=后端 API）
EXPOSE 3000
EXPOSE 3001

# 数据卷
VOLUME ["/app/data"]

# v1.03：healthcheck 用新加的 /api/diag/health（轻量、无副作用）
#   同时检查前端 3000 + 后端 3001（防后端挂掉还判 healthy）
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

# 启动（同时拉起后端 3001 + 前端 3000）
CMD ["node", "server/start-all.js"]