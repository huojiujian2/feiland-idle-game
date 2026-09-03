# ====== Dockerfile · v1.10 · 2026-09-03 ======
# 多阶段构建：
#   - builder  : 装 devDep + 构建前端 → 产出 dist/
#   - runtime  : 只装 prodDep + 必要文件 + tini 入口
# 优化要点：
#   1. 缓存 npm install（只要 package*.json 不变就不重装）
#   2. 缓存前端构建（COPY 顺序：源码在前，dist 在后；dist 改才会重 build）
#   3. tini 入口：PID 1 转发 SIGTERM，docker stop 时优雅关停 + 落盘
#   4. 非 root 用户（防容器逃逸 + 文件读写权限合规）
#   5. 真实锁文件 --omit=dev 跳过 devDeps（避免 vitest/concurrently 之类跑进镜像）
#   6. HEALTHCHECK 同时探 3000 和 3001（任一挂掉算 unhealthy）

# ====== 阶段1：构建前端 ======
FROM node:20-alpine AS builder

WORKDIR /app

# 只 COPY 锁文件 + package.json，最大化依赖缓存
COPY package.json package-lock.json* ./

# 装全量依赖（含 vite/vue 用以构建）
# --no-audit/--no-fund 加速 CI；ci 模式禁止 lockfile 漂移
RUN npm ci --no-audit --no-fund

# 复制源码
COPY . .

# 构建前端（产出 client/dist + admin/src/dist → server/public/admin）
RUN npm run build

# 删掉 devDependencies，减小下一阶段 COPY 的体积
RUN npm prune --omit=dev

# ====== 阶段2：运行时 ======
FROM node:20-alpine AS runtime

# tini: PID 1 信号转发（docker stop 时优雅落盘）
# wget:  HEALTHCHECK 用
#   已自带在 alpine，但显式装一份以防 base image 变化
RUN apk add --no-cache tini wget

# 非 root 用户（容器逃逸防护）
RUN addgroup -S app -g 1001 && adduser -S app -u 1001 -G app

WORKDIR /app

# 仅复制 package.json + 装好的 node_modules + 服务端代码 + 前端 dist
# 关键：不复制源码（避免容器里能编辑源码）
COPY --from=builder --chown=app:app /app/package.json ./package.json
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/server ./server

# 复制前端 dist 和 admin dist（web-server 静态托管）
COPY --from=builder --chown=app:app /app/client/dist ./client/dist
COPY --from=builder --chown=app:app /app/server/public/admin ./server/public/admin

# 数据持久化目录（容器卷挂载）
RUN mkdir -p /app/data && chown -R app:app /app/data

# v1.10：默认内存上限 384MB（容器内存 ≥ 512MB 时安全）
#   可通过构建参数 BUILD_NODE_MAX_OLD_SPACE_SIZE 或运行参数覆盖
ARG NODE_MAX_OLD_SPACE_SIZE=384
ENV NODE_OPTIONS="--max-old-space-size=${NODE_MAX_OLD_SPACE_SIZE}"

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV DB_PATH=/app/data/db
ENV HEAP_WARN_PCT=80

# 暴露端口（3000=前端页面，3001=后端 API）
EXPOSE 3000
EXPOSE 3001

# 数据卷（持久化 SQLite 文件）
VOLUME ["/app/data"]

# 切到非 root
USER app

# HEALTHCHECK 同时探前后端（任一挂掉算 unhealthy）
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:3000/ \
   && wget -q --spider http://localhost:3001/api/diag/health \
   || exit 1

# tini 入口：接收 SIGTERM 优雅停服（落盘未保存修改）
#   exec 形式：tini 作为 PID 1 → node 收 SIGTERM → start-all.js 触发 gracefulShutdown
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/start-all.js"]