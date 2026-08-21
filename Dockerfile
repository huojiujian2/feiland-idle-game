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

# 环境变量
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/db.json
ENV HOST=0.0.0.0

# 暴露端口
EXPOSE 3001

# 数据卷
VOLUME ["/app/data"]

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/ || exit 1

# 启动
CMD ["node", "server/index.js"]
