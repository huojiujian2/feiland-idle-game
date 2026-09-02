<div align="center">

# ⚡ 费兰德世界

### 挂机文字成长游戏 · v1.07

<img src="https://img.shields.io/badge/Vue-3.4-42b883?logo=vuedotjs&logoColor=white" alt="Vue 3.4">
<img src="https://img.shields.io/badge/Vite-5.2-646cff?logo=vite&logoColor=white" alt="Vite 5.2">
<img src="https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white" alt="Node.js Express">
<img src="https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite&logoColor=white" alt="SQLite WAL">
<img src="https://img.shields.io/badge/License-MIT-blue" alt="License">
<img src="https://img.shields.io/badge/Status-Active-brightgreen" alt="Status">

**一个充满深度的文字挂机 RPG — 5 大职业 · 200 词条 · 转生轮回 · 世界 BOSS · 灵鸡斗场 · 11 个区域**

</div>

---

## 📑 目录

| # | 文档 | 内容 |
|---|------|------|
| 0 | [本文件（主入口）](#-简介) | 简介 + 目录 + 特性速览 + 文档导航 |
| 0a | [docs/README/00-code-style.md](docs/README/00-code-style.md) | 📐 **代码模块化规范**（行数规则 / 文件清单 / 拆分原则） |
| 1 | [docs/README/01-gameplay.md](docs/README/01-gameplay.md) | 游戏玩法（职业 / 词条 / 新手指南） |
| 2 | [docs/README/02-systems.md](docs/README/02-systems.md) | 系统详解（转生 / 锻造 / 创世之书 / 世界BOSS / PVP / 灵鸡斗场 / 数据规模） |
| 3 | [docs/README/03-areas-and-equipment.md](docs/README/03-areas-and-equipment.md) | 11 区域 + 50+ 装备 + 5 品质阶 + 24 怪物技能 |
| 4 | [docs/README/04-quickstart.md](docs/README/04-quickstart.md) | 启动与部署（4 种方式 + Docker） |
| 5 | [docs/README/05-architecture.md](docs/README/05-architecture.md) | 项目结构 + 技术栈 + UI/UX 规范 |
| 6 | [docs/README/06-changelog.md](docs/README/06-changelog.md) | 版本历史（v0.1 → v1.08） |

### 🔧 开发者 / 运维文档

| 文档 | 适合 | 内容 |
|------|------|------|
| [docs/SUMMARY_v1.03.md](docs/SUMMARY_v1.03.md) | 👀 **所有人** | v1.03 综合修订汇总（今天改了什么） |
| [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) | 🛡 运维 / 安全 | P0-P2 安全审计 + 修复状态 + 内存优化（~53KB） |
| [docs/CODE_INDEX.md](docs/CODE_INDEX.md) | 🧑‍💻 开发者 | 代码索引（v4.0）+ JWT/SQLite/内存章节 |
| [docs/DEPLOY.md](docs/DEPLOY.md) | 🚀 运维 | 部署升级指南（备份 / JWT_SECRET / 内存推荐 / 验证清单 / 回滚） |
| [docs/AI_NOTES.md](docs/AI_NOTES.md) | 🤖 AI 代理 | 极速备忘（红线 + 一句话路由） |

---

## 📖 简介

费兰德世界是一个基于 Vue 3 + Node.js 的挂机文字成长游戏。

- **长期养成**：种族进化 → 法则 → 登神 → 转生轮回（永久加成累积，封顶 +60%）
- **战斗深度**：6 种策略模式、主动词条 CD 释放、连击风暴
- **装备成长**：锻造升级（+1~+10）、3 合 1 合成、词条重铸、附魔
- **PVP & 全服**：ELO 竞技场（含永久称号商店）、每日世界 BOSS（伤害排名 + 等级进度奖）
- **🐔 灵鸡斗场（v1.03）**：完全独立的免费押注玩法 — 押灵鸡、临场干预、看擂台战报，积分换称号
- **内容纵深**：11 个挂机区域（Lv.1 ~ Lv.250）、50+ 件装备（含神话品质）、20+ 种怪物技能、终极 BOSS「万界之眼」
- **创世之书（v0.9 二转解锁）**：捏造生灵、铸造神器，5 品质阶 + 递增累积机制；**混沌图鉴（v1.03）** 全服记录被抹除的造物

**5 分钟快速上手**：[快速开始 →](docs/README/04-quickstart.md)

---

## ✨ 核心特性

### 🎮 游戏系统

| 系统 | 一句话简介 |
|------|------|
| 🗺️ 挂机区域 | 11 区域（Lv.1 ~ Lv.250），从高蛮山打到创世核心 |
| ⚔️ 装备系统 | 35+ 件装备，4 级品质，锻造 / 合成 / 重铸 / 附魔 |
| 🔮 词条系统 | 200 个词条（10 主动 + 40 被动 × 4 级） |
| 🧬 职业进阶 | 5 大职业系，每系 4 阶成长 + 天赋 + 机制 |
| 🪶 种族进化 | 鹰人 → 翼人 → 天使 |
| 📜 法则系统 | 6 种法则，被动加成伤害/防御/经验/金币 |
| 👑 登神系统 | 半神 → 神灵，全属性暴涨 |
| 🔄 转生轮回 | Lv.100+ 转生，永久加成累积（+1%/次封顶 60%）+ 属性预设分配 |
| 👹 世界 BOSS | 每日全服共享 BOSS，伤害占比发奖 + TOP20 排名奖 + 限时称号 |
| ⚔️ PVP 竞技场 | ELO 积分，3 档 AI 对手，竞技币商店（含永久称号） |
| 🐔 **灵鸡斗场** | 完全独立押注玩法：每日 20 次，干预 + 擂台赛，积分换 6 称号（v1.03） |
| 🗺️ **远征探索** | 派遣队伍去 4 区域探险：3 档时长 + 10 事件 + 首领战（v1.05） |
| 🏛️ **工会系统** | 创建 / 加入 / 职位 / 公告 / 捐献 / 等级加成（v1.05） |
| ⭐ **每日活跃** | 7 档积分制 + 15 档奖励（v1.04） |
| 🎯 **主动技能** | 战斗内 CD 触发纯函数（v1.04） |
| 📊 排行榜 | 6 维度排行（等级/战力/金币/击杀/转生） |
| 📜 任务成就 | 每日任务 + 永久成就，奖励 + 称号 |
| 📜 **创世之书** | 二转解锁，自定义怪物与装备，实时投放到全服挂机世界 |
| 🌑 **混沌图鉴** | 全服共享，归档被抹除的创世生物/装备（v1.03） |
| 🗂️ **图鉴排序** | 装备按 11 项属性升降序排序（纯前端，v1.03） |
| 🏛️ **羊皮卷轴 UI** | 登录/注册/创世之书统一卷轴视觉 + 沉浸背景层 |
| 🗺️ **地图两段式** | 区域选择 + 战斗日志分页，已选区域后直接进战斗页 |
| ⚖️ **平局支持** | 挂机战斗 + 竞技场平局分支 + 30% 经验补偿 |
| ⚔️ **PVP 真人对手** | 竞技场列表含真实玩家镜像：同段位优先 + 跨段位补足，挑战无等级门槛（v1.06） |
| 🗺️ **地图轻视图** | 地图页独立精简数据源 `view-map`，响应体积从数百 KB → 几 KB（v1.06） |
| 🎨 **AI 生图** | 28 个暗黑 RPG 图标 + 3 张主背景图 |
| 🍞 **全局 UI 桥接** | 自定义 Toast / Modal，替代浏览器原生 alert/confirm |
| 🧙 **头像 + 名牌** | TopBar 头像金边 + 属性 chip 系统 |
| ⭐ **品质徽章** | 传说/史诗/稀有/普通 品质色边框与发光 |

**完整特性详解**：[02-systems.md](docs/README/02-systems.md)

### 🛡 工程与运维（v1.03 综合修订新增）

| 能力 | 说明 |
|------|------|
| 🔐 **JWT 鉴权** | HMAC-SHA256 零依赖，70+ 受保护路由统一 token 校验 |
| 🔑 **bcrypt 密码哈希** | rounds=10 + 自动升级老明文账号 |
| 🚦 **IP 速率限制** | 注册 5/min、登录 10/min，防刷号 / 密码爆破 |
| 🛡 **审计日志** | 所有写操作记录 + 敏感字段自动脱敏 |
| 📦 **SQLite WAL 后端** | 异步落盘 + epoch 守卫，支持几十人在线并发 |
| 💾 **事务化存档** | `withTransaction` 原子写 + 回滚，主备双备份 |
| 🖥 **后台管理页** | 独立 `/admin` 前端（零依赖）：服务器监控大屏 + GM 工具 + 服务器设置 + 账号管理，admin 多账号登录 + 暗黑模式（v1.06→v1.08） |
| 🎮 **GM 工具** | 全服公告 / 玩家检索与档案 / 发金币发经验 / 召唤世界 BOSS，全部挂审计日志 `gm.*`（v1.06） |
| ⚙️ **服务器设置** | 经验/金币倍率 + 全服等级与金币上限，9 个产出点（idle/PVP/BOSS/卷轴/任务/成就/活跃/远征/出售）统一接入，含智能预设（默认/开服双倍/难度上调/赛季制/新手服）（v1.07） |
| 🔑 **后台账号体系** | 多账号 + scrypt 密码哈希，首登账号 `admin/admin` 强制改密提示 + 顶部账号按钮一键改密（v1.08） |
| 👥 **在线统计** | 登录会话口径（5 分钟活跃判在线），5s 挂机循环只结算在线玩家（v1.06） |
| 📊 **内存监控** | `/api/diag/memory` 实时 heap/arenaBots 缓存 + docker healthcheck |
| 🚀 **生产内存限制** | `--max-old-space-size` 默认 384MB，监控告警阈值 80% |

**安全审计详情**：[docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) · **部署指南**：[docs/DEPLOY.md](docs/DEPLOY.md)

---

## 🗺️ 世界地图速览

11 个区域，从入门到终极 BOSS：

| Lv 段 | 区域 |
|------|------|
| 1-100 | 高蛮山 / 密语森林 / 瀚海森林 / 东海之滨 / 天堂山 / 地精王城 / 龙岛 / 深渊裂隙 |
| 130-180 | **元素深渊 / 星界 / 神魔殿**（v0.4 新增）|
| 200-250 | **永恒虚空 / 时之境 / 创世核心**（终极区，终极BOSS「万界之眼」3000万 HP）|

**详情 + 装备掉率**：[03-areas-and-equipment.md](docs/README/03-areas-and-equipment.md)

---

## 🚀 启动

```bash
# 克隆
git clone https://github.com/huojiujian2/feiland-idle-game.git
cd feiland-idle-game

# 方法一：一键启动（Windows）
双击 启动游戏.bat

# 方法二：开发模式（改代码实时生效）
npm install
npm run dev   # 或 pnpm dev

# 方法三：生产模式（性能更好）
npm install
npm run build
npm start

# 方法四：Docker（推荐生产部署）
docker compose up -d --build
```

打开 **http://localhost:3000** 即可游玩。

> **端口约定（所有模式统一）**：前端固定 **3000**（浏览器打开的地址），后端 API 固定 **3001**（正常游玩无需关心）。
> 开发模式下若 3000 被占用，Vite 会直接报错退出（`strictPort`），不会悄悄换端口。
> **后台管理（v1.06→v1.08）**：`http://localhost:3001/admin`
> * v1.06：单 token（`ADMIN_TOKEN` 环境变量）
> * **v1.08**：多账号 + 密码哈希（首登账号 `admin/admin`，进入后顶部弹窗强制改密；旧 `ADMIN_TOKEN` 不再使用）

**完整部署文档（含 JWT_SECRET / 内存推荐 / 健康检查）**：[04-quickstart.md](docs/README/04-quickstart.md) · [docs/DEPLOY.md](docs/DEPLOY.md)

---

## 📋 快速入口（按角色）

### 🎮 我是玩家

1. [docs/README/04-quickstart.md](docs/README/04-quickstart.md) — 5 分钟启动
2. [docs/README/01-gameplay.md](docs/README/01-gameplay.md) — 玩法详解
3. [docs/README/02-systems.md](docs/README/02-systems.md) — 系统总览

### 🧑‍💻 我是开发者

1. [docs/CODE_INDEX.md](docs/CODE_INDEX.md) — 代码索引（先读这个）
2. [docs/AI_NOTES.md](docs/AI_NOTES.md) — 极速备忘（红线 + 一句话路由）
3. [docs/README/00-code-style.md](docs/README/00-code-style.md) — 模块化规范
4. [docs/README/05-architecture.md](docs/README/05-architecture.md) — 项目结构

### 🚀 我要部署生产环境

1. [docs/DEPLOY.md](docs/DEPLOY.md) — 升级部署指南（含 JWT_SECRET + 内存推荐 + 验证清单 + 回滚方案）
2. [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) — 安全审计 + 修复状态
3. `GET /api/diag/health` + `/api/diag/memory` — 运行时监控 endpoint

---

## 🤝 贡献

欢迎提交 Issue 和 PR！

### 开发流程

1. 阅读 [docs/CODE_INDEX.md](docs/CODE_INDEX.md) 摸清代码结构
2. 严格遵守 [docs/README/00-code-style.md](docs/README/00-code-style.md)（单文件 > 800 行必须拆分）
3. 新增功能写测试（`server/*.test.js`），保证 `npm test` 全绿
4. 在 [docs/README/06-changelog.md](docs/README/06-changelog.md) 追加版本记录

## 📄 许可证

MIT License — 自由使用、修改和分发。

---

<div align="center">

**⚡ 费兰德世界 — 从凡人到神灵的挂机之旅 ⚡**

[📖 玩法详解 →](docs/README/01-gameplay.md) · [📊 版本历史 →](docs/README/06-changelog.md) · [🛡 安全审计 →](docs/SECURITY_AUDIT.md) · [🚀 部署指南 →](docs/DEPLOY.md)

</div>