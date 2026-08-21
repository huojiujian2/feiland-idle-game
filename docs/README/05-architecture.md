# 项目架构

> 📖 主入口：[../README.md](../README.md)

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | Vue 3.4 + Vite 5.2 | 组合式 API、响应式设计、HMR 热更新 |
| **后端** | Node.js + Express | RESTful API、JSON 文件存储 |
| **构建** | Vite | 极速构建、按需加载 |
| **部署** | Docker Compose / concurrently | 生产环境 Docker 一键部署，开发模式 concurrently |
| **存储** | JSON 文件 | 轻量存储，可平滑迁移至 SQLite/MySQL |

## 项目结构

```
game-mvp/
├── server/                    # 后端服务
│   ├── index.js                # Express 服务器入口 (端口 3000)
│   ├── store.js                # JSON 文件数据存储
│   ├── data.js                 # 游戏静态数据 (区域/怪物/装备/职业/词条/法则/BOSS/世界BOSS/转生/锻造)
│   └── engine.js               # 游戏引擎 (挂机/战斗/升级/进化/登神/转生/世界BOSS/PVP)
├── client/                    # 前端
│   ├── index.html              # HTML 入口
│   ├── public/
│   │   └── icons/ai/           # AI 生成的 28+ 个魔兽暗黑风 PNG 图标
│   └── src/
│       ├── App.vue             # 主界面 (8-Tab 导航 + 页面切换动画)
│       ├── api.js              # API 请求封装
│       ├── main.js             # Vue 应用入口
│       ├── style.css           # 全局样式 + CSS 变量 + 设计令牌
│       └── components/
│           ├── CharacterView.vue   # 角色页 (属性/职业/装备)
│           ├── SkillView.vue       # 技能页 (词条网格+详情)
│           ├── InventoryView.vue   # 背包页 (装备/物品+锻造/合成/重铸)
│           ├── MapView.vue         # 地图页 (区域选择+战斗日志+侧边抽屉)
│           ├── CodexView.vue        # 图鉴页 (材料/装备/消耗品/怪物)
│           ├── EvolutionView.vue   # 进阶页 (种族进化/附魔/法则/登神/转生)
│           ├── LeaderboardView.vue # 排行榜页
│           ├── QuestView.vue        # 任务页 (每日任务+成就)
│           ├── PvPView.vue          # 竞技场 (PVP+ELO+日结/周结/月结自动结算)
│           ├── WorldBossView.vue   # 世界 BOSS (伤害排行+攻击+奖励)
│           ├── TutorialOverlay.vue # 新手引导
│           └── icons/IconBase.vue   # 图标基础组件 (SVG → PNG)
├── docs/                      # 文档目录
│   └── README/                # README 拆分文件
├── vite.config.js             # Vite 配置 (root: client)
├── package.json              # 项目依赖与脚本
├── Dockerfile                # Docker 镜像构建（多阶段构建）
├── docker-compose.yml        # Docker Compose 编排配置
├── .dockerignore             # Docker 构建排除规则
├── .env.example              # 环境变量示例
├── .gitignore
├── README.md                 # 主入口（带目录导航）
└── 启动游戏.bat               # Windows 一键启动脚本
```

## UI/UX 设计规范

| 场景 | 交互形式 | 原因 |
|------|----------|------|
| 背包、技能、图鉴、地图、排行 | **全屏替换**（左右滑动） | 内容量大，需要沉浸式浏览 |
| 装备详情、词条详情 | **居中弹窗**（Modal） | 临时操作，看完关掉回到原页面 |
| 商店购买 | **底部弹出**（Action Sheet） | 即时反馈，带操作按钮 |

**底部导航栏**：固定 5 个 Tab（角色/技能/地图/背包/图鉴），中间地图按钮圆形凸起。

**图标系统**：v0.4 全量替换 emoji 为 AI 生成的魔兽暗黑风 PNG（28+ 个图标，可缩放、可着色）。

## 文档结构

主 README.md 只保留简介 + 目录导航，详细内容拆分为：

- [01-gameplay.md](01-gameplay.md) — 游戏玩法（职业、词条、新手指南）
- [02-systems.md](02-systems.md) — 系统详解（转生/锻造/BOSS/PVP/数据规模）
- [03-areas-and-equipment.md](03-areas-and-equipment.md) — 区域 + 装备 + 怪物技能
- [04-quickstart.md](04-quickstart.md) — 启动与部署
- [05-architecture.md](05-architecture.md) — 本文件（项目结构 + 技术栈）
- [06-changelog.md](06-changelog.md) — 版本历史