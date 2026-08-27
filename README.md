<div align="center">

# ⚡ 费兰德世界

### 挂机文字成长游戏 · v1.01

<img src="https://img.shields.io/badge/Vue-3.4-42b883?logo=vuedotjs&logoColor=white" alt="Vue 3.4">
<img src="https://img.shields.io/badge/Vite-5.2-646cff?logo=vite&logoColor=white" alt="Vite 5.2">
<img src="https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white" alt="Node.js Express">
<img src="https://img.shields.io/badge/License-MIT-blue" alt="License">
<img src="https://img.shields.io/badge/Status-Active-brightgreen" alt="Status">

**一个充满深度的文字挂机 RPG — 5 大职业 · 200 词条 · 转生轮回 · 世界 BOSS · 11 个区域**

</div>

---

## 📑 目录

| # | 文档 | 内容 |
|---|------|------|
| 0 | [本文件（主入口）](#) | 简介 + 目录 + 特性速览 |
| 0a | [docs/README/00-code-style.md](docs/README/00-code-style.md) | 📐 **代码模块化规范**（行数规则 / 文件清单 / 拆分原则） |
| 1 | [docs/README/01-gameplay.md](docs/README/01-gameplay.md) | 游戏玩法（职业 / 词条 / 新手指南） |
| 2 | [docs/README/02-systems.md](docs/README/02-systems.md) | 系统详解（转生 / 锻造 / 创世之书 / 世界BOSS / PVP / 数据规模） |
| 3 | [docs/README/03-areas-and-equipment.md](docs/README/03-areas-and-equipment.md) | 11 区域 + 50+ 装备 + 5 品质阶 + 24 怪物技能 |
| 4 | [docs/README/04-quickstart.md](docs/README/04-quickstart.md) | 启动与部署（4 种方式 + Docker） |
| 5 | [docs/README/05-architecture.md](docs/README/05-architecture.md) | 项目结构 + 技术栈 + UI/UX 规范 |
| 6 | [docs/README/06-changelog.md](docs/README/06-changelog.md) | 版本历史（v0.1 → v1.01） |

---

## 📖 简介

费兰德世界是一个基于 Vue 3 + Node.js 的挂机文字成长游戏。

- **长期养成**：种族进化 → 法则 → 登神 → 转生轮回（永久加成累积）
- **战斗深度**：6 种策略模式、主动词条 CD 释放、连击风暴
- **装备成长**：锻造升级（+1~+10）、3 合 1 合成、词条重铸
- **PVP & 全服**：ELO 竞技场、世界 BOSS（共享血量 + 伤害排名 + 最后一击奖励）
- **内容纵深**：11 个挂机区域（Lv.1 ~ Lv.250）、50+ 件装备（含神话品质）、20+ 种怪物技能、终极 BOSS「万界之眼」
- **创世之书（v0.9 二转解锁）**：捏造生灵、铸造神器，5 品质阶 + 递增累积机制（每次 ×1.1 封顶 10×）

**5 分钟快速上手**：[快速开始 →](docs/README/04-quickstart.md)

---

## ✨ 核心特性

| 系统 | 一句话简介 |
|------|------|
| 🗺️ 挂机区域 | 11 区域（Lv.1 ~ Lv.250），从高蛮山打到创世核心 |
| ⚔️ 装备系统 | 35+ 件装备，4 级品质，锻造 / 合成 / 重铸 |
| 🔮 词条系统 | 200 个词条（10 主动 + 40 被动 × 4 级） |
| 🧬 职业进阶 | 5 大职业系，每系 4 阶成长 + 天赋 + 机制 |
| 🪶 种族进化 | 鹰人 → 翼人 → 天使 |
| 📜 法则系统 | 6 种法则，被动加成伤害/防御/经验/金币 |
| 👑 登神系统 | 半神 → 神灵，全属性暴涨 |
| 🔄 转生轮回 | Lv.100+ 转生，永久累积 +30%经验/金币/+75基础属性 |
| 👹 世界 BOSS | 全服共享 BOSS，按伤害占比发奖，30 分钟刷新 |
| ⚔️ PVP 竞技场 | ELO 积分，3 档 AI 对手（低/同/高 5 级） |
| 📊 排行榜 | 6 维度排行（等级/战力/金币/击杀/转生） |
| 🎓 新手引导 | 分步高亮教程 |
| 📜 任务成就 | 每日任务 + 永久成就，奖励 + 称号 |
| 💥 伤害飘字 | 暴击放大+抖动 |
| ⚔️ 战斗策略 | 6 种策略模式 |
| 📜 **创世之书** | 二转解锁，自定义怪物与装备，实时投放到全服挂机世界（v0.7） |
| 🏛️ **羊皮卷轴 UI** | 登录/注册/创世之书统一卷轴视觉 + 沉浸背景层（v0.8） |
| 🗺️ **地图两段式** | 区域选择 + 战斗日志分页，已选区域后直接进战斗页（v0.8） |
| ⚖️ **平局支持** | 挂机战斗 + 竞技场引入平局分支 + 30% 经验补偿（v0.8） |
| 🎨 **AI 生图** | 28 个暗黑 RPG 图标 + 3 张主背景图（v0.5） |
| 🍞 **全局 UI 桥接** | 自定义 Toast / Modal，替代浏览器原生 alert/confirm（v0.5） |
| 🖼️ **沉浸式背景** | 紫夜城堡主背景 + 魔法卷轴 Header + 雕花 TabBar（v0.5） |
| 🧙 **头像 + 名牌** | TopBar 头像金边 + 属性 chip 系统（v0.5） |
| ⭐ **品质徽章** | 传说/史诗/稀有/普通 品质色边框与发光（v0.5） |

**完整特性详解**：[02-systems.md](docs/README/02-systems.md)

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

# 方法四：Docker
docker compose up -d --build
```

打开 **http://localhost:3000** 即可游玩。

> **端口约定（所有模式统一）**：前端固定 **3000**（浏览器打开的地址），后端 API 固定 **3001**（正常游玩无需关心）。
> 开发模式下若 3000 被占用，Vite 会直接报错退出（`strictPort`），不会悄悄换端口。

**完整部署文档**：[04-quickstart.md](docs/README/04-quickstart.md)

---

## 🤝 贡献

欢迎提交 Issue 和 PR！

## 📄 许可证

MIT License — 自由使用、修改和分发。

---

<div align="center">

**⚡ 费兰德世界 — 从凡人到神灵的挂机之旅 ⚡**

[📖 查看完整文档 →](docs/README/01-gameplay.md) · [📊 版本历史 →](docs/README/06-changelog.md)

</div>