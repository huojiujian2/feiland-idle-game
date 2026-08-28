# 版本历史

> 📖 主入口：[../README.md](../README.md)

## v1.02 · 2026-08-28

### 🆕 新增功能

#### 世界 BOSS 全面重构
- **BOSS 数值 = 全服当前最强玩家 × 10 倍**，按生命 5 : 攻击 3 : 防御 1 : 敏捷 1 分配到 BOSS
  - 计算公式：`hp = strongest.hp × 5`，`atk = strongest.atk × 3`，`def = strongest.def × 1`，`agi = strongest.agi × 1`（共 5+3+1+1=10 倍拆解）
  - 锚点评估函数 `getStrongestPlayer` 按 `hp/10 + atk + def*2 + agi + level*5` 取最高分；找不到玩家时退回模板数值
- **每日刷新**：BOSS 在每日 0 点强制死亡结算（无论是否被打死），次日 0 点重生；`expiresAt` 字段实时记录过期时间，前端倒计时 HH:MM:SS
- **每日 1 次挑战**：玩家 `lastBossAttackDay` 字段按当日键判定；次数用完后按钮变为"今日次数已用完 · 等待次日重生"
- **一次挑战 = 一次 5 回合战斗**：新增 `simulateBossBattle(player, boss, 5)` 战斗模拟器，5 回合上限，按 hit/defence/agi 比动态行动次数；返回战报含每回合 actions / pHp / mHp
- **伤害前三 24h 称号奖励**：
  - 🥇 第一名 【天命弑神者】
  - 🥈 第二名 【深渊征服者】
  - 🥉 第三名 【暗影屠戮者】
  - 存入 `player.titleExpiry`，下次 `/api/titles` 拉取时自动剔除过期
  - 称号 UI 在 BOSS 战报下方金色"称号奖励"卡片即时展示

#### 称号系统（贯穿游戏）
- **后端 `server/data/titles.js`**：扫描 `JOB_TREE[].stages` 自动派生 5 职业 × 4 阶段 = 20 个职业阶段称号（key 形如 `thunder:御雷者`），加上 3 个世界 BOSS 限时称号
- **职业称号解锁规则**：仅当玩家 `jobPath === meta.jobId` 且 `level >= meta.requiresLevel` 时才可佩戴
- **限时称号有效期**：24 小时（`titleExpiry[key] = Date.now() + 86400000`）
- **API**：
  - `GET /api/player/:username/titles` → 返回 `currentTitle / unlocked / active(限时未过期) / all`
  - `POST /api/player/:username/titles/equip` → 佩戴 / 卸下（key=null）
  - `GET` 接口顺手清理过期称号 + 持久化
- **角色页职业名称位置改为 currentTitle**：未佩戴时回退显示 `player.job`，佩戴后显示金色 / 银 / 铜三色限时称号
- **角色页右侧折叠栏新增"称号"按钮**（与进阶/任务并列）：点击弹出 `TitleModal.vue`，按职业分组列出 4 个阶段（未解锁显示锁 + Lv.N），下方展示限时称号及剩余时间
- 新增 `client/src/components/TitleModal.vue`、`server/data/titles.js`、`server/routes/titles.js`

#### 背包整理按钮
- 装备栏右上增加紫色"✨ 整理"按钮（在"一键合成"左侧）
- 点击后按 **装备类别（武器→护甲→饰品）+ 类别内按最高属性降序** 重新排序
- 前端乐观更新（玩家 equips 数组直接重排），后端保持不动（`props.player.equips` 即时生效，下次轮询会被覆盖前已排序好）
- 前端 `client/src/App.vue` 增加 `handleInventorySort` 接收子组件 emit

### 🔧 后端引擎
- `server/engine/combat.js` 新增 `simulateBossBattle(player, boss, maxRounds=5)`，复用 `calcDamage` / `getActionCount`
- `server/engine/worldboss.js` 重写：移除旧版模板数值生成，改为按全服最强玩家 × 10 倍；新增 `ensureBossFresh` 处理跨日强制结算；移除 `setRecalcMaxStatsHandler` 旧 seam
- `server/engine/index.js` 新导出 `simulateBossBattle / getBossExpiresAt / getStrongestPlayer`，同步移除 `worldboss.setRecalcMaxStatsHandler` 调用
- `server/routes/worldboss.js` 重构：active 路由增加 `expiresAt / challengedToday / remainingMs`，攻击路由返回完整 `battle / rewards / player`，移除旧 5 秒冷却

---

## v1.01 · 2026-08-27

### 🆕 新增功能

#### 界面风格换肤系统（纯前端，不动任何数值）
- **三种风格**：原·星夜风（默认）/ 暗金风（玄黑鎏金）/ 羊皮纸风（古卷褐墨·浅色主题）
- **入口**：角色页职业栏下方新增"设置"栏 → "界面风格" → 弹出选择弹窗
- **即时生效**：点击选项立刻换肤（弹窗本身也跟随换肤，所见即所得），选择自动保存 `localStorage`（key: `ferland-theme`），重启自动恢复
- **实现机制**：35 个文件里 85 处硬编码 `rgba()` 颜色统一改为 CSS RGB 三元组变量（`--panel-rgb / --panel2-rgb / --violet-rgb / --gold-rgb`），默认值与原色完全一致 → **原风格视觉零变化**；新主题只覆盖变量，不改动任何原有样式规则
- **新增文件**：`client/src/themes.css`（主题定义）/ `client/src/theme.js`（切换+持久化）/ `client/src/components/ThemeModal.vue`（选择弹窗）
- 登录页保持星夜氛围不跟随换肤（有意设计）

### 🐛 Bug 修复

- **登录页白屏（ReferenceError）**：`watch` 引用了在其后声明的 `agreedToLaws` → 声明移到 `watch` 之前，恢复初始化顺序
- **注册成功却提示"契约未成"**：当前 Vue 版本的 `emit` 不会回传父组件处理函数的返回值，`res` 恒为 `undefined` 恒走失败分支 → 改为 `defineExpose` 暴露 `setRegisterResult()`，App.vue 注册完成后主动回传结果（成功翻神谕面板 / 失败留页显示 inline 错误）
- **"契约成立"过渡面板星标一闪一闪**：去掉 `✦` 星标的 `rune-pulse` 循环缩放爆光动画，改为静止常亮（圆环旋转保留）

### ⚖️ 数值调整（创世系统 v2.6 / v2.7）

- **图鉴显示真实掉率**：自创装备的 `sources` 从硬编码 `rate: 0` 改为反查"绑定了该装备的自创怪"的真实掉率，并列出来源怪物名与造物主；`pending` 阶段兜底显示投放地图
- **玩家造怪物不再自定义掉率**：统一用全局默认常量——自创装备 3% / 自创材料 5%（防刷）
- **全局掉率压缩**（挂机放置类，等级越高装备越稀有）：装备掉率梯度 Lv1-30 约 1% → Lv200-250 约 0.05%（每升 1 级约 ×0.85），材料掉率统一砍半