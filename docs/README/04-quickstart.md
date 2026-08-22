# 快速开始

> 📖 主入口：[../README.md](../README.md)

## 环境要求

- **Node.js** >= 18
- **pnpm**（推荐）或 npm

## 方法一：一键启动（Windows）

双击 `启动游戏.bat` 文件即可。

## 方法二：命令行启动

```bash
# 安装依赖
pnpm install

# 启动开发服务器（前后端同时运行）
pnpm dev
```

然后在浏览器打开 **http://localhost:3000**

## 方法三：分别启动前后端

```bash
# 终端 1：启动后端
pnpm dev:server

# 终端 2：启动前端
pnpm dev:client
```

- 前端：http://localhost:3000 （后端 API 固定在 3001，正常游玩无需关心）

## 方法四：Docker 部署（推荐生产环境）

> 适合服务器部署，一行命令构建+启动，数据自动持久化。

### 前提条件

- 安装 [Docker](https://docs.docker.com/get-docker/) 和 [Docker Compose](https://docs.docker.com/compose/install/)

### 一键部署

```bash
# 1. 拉取代码
git clone https://github.com/huojiujian2/feiland-idle-game.git
cd feiland-idle-game

# 2. 一键构建并启动（后台运行）
docker compose up -d --build

# 3. 查看运行状态
docker compose ps

# 4. 查看实时日志
docker compose logs -f
```

部署完成后，浏览器打开 **http://localhost:3000** 即可游玩。

### 数据持久化

游戏数据保存在 Docker 卷中，容器重启/重建后数据不丢失。

```bash
docker volume ls | grep game
docker volume inspect <卷名称>
docker run --rm -v <卷名称>:/data -v ${PWD}:/backup alpine cp -r /data /backup/game-data-backup
docker run --rm -v <卷名称>:/data -v ${PWD}:/backup alpine cp -r /backup/game-data-backup /data
```

### 常用管理命令

```bash
docker compose up -d --build   # 重新构建并启动
docker compose down            # 停止并删除容器
docker compose restart         # 重启服务
docker compose logs -f         # 查看实时日志
docker compose ps              # 查看运行状态
```

## 生产构建（不用 Docker）

```bash
pnpm build      # 构建前端到 client/dist/
npm start       # 一键同时启动：前端(3000) + 后端 API(3001)
```

## 端口配置

端口约定（**所有模式统一**）：

| 角色 | 地址 | 说明 |
|------|------|------|
| 前端页面 | **http://localhost:3000** | 浏览器打开这个地址游玩 |
| 后端 API | **http://localhost:3001** | 只处理数据接口，正常游玩无需关心 |

- 开发模式：Vite 占用 3000（`strictPort` 锁死），后端占 3001，`/api` 自动代理
- 生产模式：`server/web-server.js` 占用 3000 托管构建产物并反代 API，后端占 3001

### 修改端口

一般不需要改。如确需修改：

- **后端端口**：环境变量 `PORT`（默认 3001）
- **生产前端端口**：环境变量 `WEB_PORT`（默认 3000；开发模式的 Vite 不受它控制）
- **Docker 宿主机访问端口**：`.env` 文件里的 `PORT`（映射到容器内前端的 3000）