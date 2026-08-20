# T-005 手动技能释放（主动词条实战） — Spec v1

> 优先级 🔴 高 · 难度 ★★★★ · 分支 `feat/T-005-skill` · 依赖 无 · 对应 `GAMEPLAY_GUIDE.html:2.2 T-005` / `GAMEPLAY_TASKS.md:2.2`
> 本 Spec 严格以指南 `T-005` 四步为边界，不扩展玩法与数值

## 1. 背景与目标

- 现状：主动词条（`AFFIX_TREE` `slot:'active'`）仅在 `getAffixBonus` 中做被动加成，未在 `simulateBattle/calculateIdle` 中产生 `damage/heal/buff` 实战效果；`simulateBattle` 内 `pickPlayerSkill` 为 60% 随机且 `combat.atk/def` 增益永不回退，`gold_buff/exp_gold` 等经济类未生效。
- 目标：挂机每场战斗按词条等级 CD 自动释放主动技能（`初5/中4/高3/大师2` 回合），按 `effect.type` 执行真实战斗/经济效果，`type:'skill'`（及派生）日志前端特殊渲染，零手动点击（“或手动” 预留，不在本版）。

成功标准：Lv.1 `A1-01 雷霆冲击` 等 40 主动词条在挂机战斗中按 CD 触发；`damage/heal/atk_buff/def_buff/agi_buff/gold_buff` 六类效果可验收；`CD` 与 `turns` 精确；日志可渲染；经济类累加至 `goldGain/expGain`。

## 2. 需求澄清

- 触发：**自动**，每场战斗独立 CD 计数器，`round` 从 1 开始，满足 `round % CD === 0`（`1-indexed`，初级 5→ `round 5,10,15...`）时尝试释放；若无主动词条则永不触发，不报错。
- CD 映射：`AFFIX_LEVELS` `level`→`CD`：`1→5, 2→4, 3→3, 4→2`，单一数据源 `ACTIVE_SKILL_CD = {1:5,2:4,3:3,4:2}`（`data.js`）。
- 效果类型（指南四步已列，扩展至 `AFFIX_TREE` 现有主动全量，未列类型视为不做或按同类归集）：
  - `damage`：追加 `ATK × mult` 技能伤害（走 `calcDamage`，含暴击/浮动/defBonus/ignoreDef），可附带 `paralyze/reduceDef/reduceAgi/stun/agi_buff/atk_buff/crit_buff/bleed` 等派生（派生本版仅记录日志，不额外实现 debuff 对敌方属性的下调，除 `agi_buff/atk_buff/crit_buff` 等已实现的己方增益外）；
  - `heal`：恢复 `maxHp × value`（与 `heal` 字段，`A2-04/A4-02` 等 `damage+heal` 归为 `damage`+额外回血）；
  - `atk_buff/def_buff/agi_buff/atk_def_buff/agi_atk_buff/def_regen_buff/all_buff`：`combat.atk/def/agi/crit/regen` 按 `value/atk/def/agi` 提升，持续 `turns` 回合，到期回退（见 §5）；
  - `gold_buff/exp_gold_buff/exp_gold_kill/exp_gold_mult`：本场 `goldBonus/expBonus` 增量（`gold_buff` 单值，`all_buff` 含 `atk+gold`，`A3-05/A4-05` 等累加至 `combat.goldBonus/expBonus`，`killBonus/mult` 本版仅日志，不额外乘）；
  - `crit_buff`：`combat.crit += value` 持续 `turns`；
  - `burn/bleed`：按 `maxHp × value` 直接扣怪 HP；
- 不做：手动点击释放、技能打断/沉默、PVP 独立、新增主动词条、平衡性调参、音效（T-003）、动作特效（T-002）。
- 前端：`MapView` 战斗日志对 `type:'skill'`（及含 `skill` 字段的 `battle` `actions`）高亮；不新增 Tab/弹窗。
- 约束：仅 `server/data.js` 静态、`server/engine.js` 逻辑、`client/src/components/MapView.vue` + `client/src/style.css` 变量；`server/index.js`/`store.js` 无变更（除导出常量）。

## 3. 涉及文件

- `server/data.js` — 新增 `ACTIVE_SKILL_CD`（`{1:5,2:4,3:3,4:2}`）并导出
- `server/engine.js` — 重构 `simulateBattle` 技能调度与 buff 过期、经济累加；新增/导出 `getActiveSkillCd/shouldTriggerActiveSkill`（可测试 seam）
- `client/src/components/MapView.vue` — `skill` 日志特殊渲染（颜色/图标/高亮）
- `client/src/style.css` — 新增 `--skill-*` 语义化 token（仅 `var(--*)`）

> 不改：`server/index.js`、`server/store.js`、`client/src/api.js`、`App.vue`（除非为透传日志必要，原则不改）

## 4. 数据与落点

### 4.1 常量

```js
// server/data.js
const ACTIVE_SKILL_CD = { 1: 5, 2: 4, 3: 3, 4: 2 };
module.exports = { ..., ACTIVE_SKILL_CD }
```

### 4.2 战斗落点

- `getCombatStats` 保持不变（快照低血/策略/词条被动），不纳入主动技能增益（增益在 `simulateBattle` 内按回合生效）。
- `simulateBattle(player, monster)` 重构：
  - 入口：`combat = getCombatStats(player)`；`activeAffix = findAffix(player.affixes.active)`；`cd = ACTIVE_SKILL_CD[activeAffix.level] || 5`；
  - 状态：`skillCdCounter` 隐式由 `round % cd === 0` 推导；`buffs = []` 队列 `{ key, value, expireRound }` 用于回退；`battleSkillGold/ExpBonus = 0` 累加经济类；
  - 每回合 `round 1..30` 顶部：先过期 `buffs.filter(b=>b.expireRound>=round)` 回退 `combat.atk/def/agi/crit/regen/goldBonus/expBonus`；
  - 行动队列仍按 `curPActions/curMActions` 交替，`doAction('player')` 内：
    - 判定 `shouldTrigger = activeAffix && round % cd === 0`（每 N 回合一次，同一回合仅一次，不受行动次数影响）；
    - 若触发：
      - `damage`：`calcDamage(combat.atk, mDef, eff.mult, ...)` 追伤，不替代普通攻击（追加一次行动），`actions.push({ actor:'player', skill: name, damage, crit, type:'skill' })`；
      - `heal`：`pHp = min(maxHp, pHp + floor(maxHp*value))`，`type:'skill'`；
      - `*_buff`：`combat[key] = floor(combat[key]*(1+value))` 或 `crit+=value`，`buffs.push({key, value, expireRound: round+turns})`，`type:'skill'`；
      - `gold_buff/exp_gold_*`：`battleSkillGold += value; combat.goldBonus+=value`（即时影响后续 `goldGain`），同理 `exp`，`type:'skill'`；
      - `burn/bleed`：`mCurHp -= floor(mHp * value)`，`type:'skill'`；
    - 否则走普通攻击；
  - 回合结束仍记录 `rounds.push({ round, actions, ...})`；
  - 返回 `battle` 原字段不变，`detail` 中 `actions` 含 `type:'skill'` 标记；
- `calculateIdle`：
  - `battle = simulateBattle(player, battleMonster)` 后，`goldBonus/expBonus` 已在 `combat` 中累加，结算 `expGain = floor(monster.exp*expMult)` 等保持不变，`expMult/goldMult` 已含 `combat` 累加（若需额外 `battleSkill*` 再叠加则 `expMult *= 1+battleSkillExp`，本版直接复用 `combat` 增量）；
  - 日志 `type:'battle'` 的 `detail` 保留 `type:'skill'` 供前端识别；不新增顶层 `type:'skill'` 日志（避免与 `levelup/job` 混淆），前端按 `actions.some(a=>a.type==='skill')` 高亮整场或单行。

### 4.3 前端落点

- `MapView.vue` `battle log` 渲染：若 `action.type==='skill'` 加 `class="skill-action"`，紫色高亮+`✦` 图标；`skill` 行 `skill` 名加粗；
- `style.css` 新增 `--skill-highlight: var(--accent2); --skill-bg: rgba(157,140,240,0.12)`，组件仅 `var(--skill-*)`。

## 5. 交互与时序

```
calculateIdle -> buildBattleMonster -> simulateBattle(round 1..30)
  round start: expireBuffs() -> build queue -> doAction
    doAction(player): if round%cd===0 && activeAffix -> apply effect (type switch) + push type:'skill'
                     else normal calcDamage
  -> return battle -> calculateIdle settlement (exp/gold/drops) -> logs.push(battle) -> getPlayerView
MapView: watch logs -> findLatestBattle().detail -> render actions, skill rows highlighted via var(--skill-*)
```

- 多增益叠加：同 `key` 多次叠加按乘法叠乘，到期逐项回退（除法回退需记录基线，本版简化为记录 `before` 值，到期恢复 `before`，不支持同 key 并发多层精确回退则按“到期全量回退末次”并测试覆盖）。
- 经济类：`A1-05 炼金拾取` 等 `gold_buff` 在触发回合立即 `combat.goldBonus+=0.10`，后续 `win` 结算 `goldGain` 放大。

## 6. 验收标准

- [ ] `A1-01` 初级 `CD 5`：`round 5,10,15` 触发，其余回合不触发；`A3-01`/`A4-01` 大师 `CD 2`：`round 2,4,6...` 触发
- [ ] `damage`：`A1-01 ATK×1.2` 追伤经 `calcDamage`（含 `defBonus/ignoreDef/crit`）且不替代普攻；`heal`：`A1-02 HP+10%` 上限截断
- [ ] `buff`：`A1-04 ATK+10% 2回合` 在 `round 5` 生效，`round 7` 过期回退，后续伤害回落
- [ ] `gold_buff`：`A1-05` 触发后本场 `goldGain` 放大 10%（`store` 隔离验证）
- [ ] 日志：`detail.actions` 含 `type:'skill'`，前端紫色高亮+图标
- [ ] 无主动词条时无 `skill` 日志，不报错
- [ ] `pnpm build`、`git diff --check 0`、`node --test server/**/*.test.js` 通过（新增 `server/skill.test.js` 覆盖 CD/buff/economic）
- [ ] 风格：`style.css` 仅 `var(--skill-*/--duration-*/--ease-*)`，`MapView` 无硬编码

## 7. 风险与回退

- 风险：buff 回退精度（多次叠加）—— 本版限制同 key 单层生效或记录 `before`，测试覆盖多层场景；`damage` 追伤导致 DPS 抬升—— 数值以指南为准，不调 `mult`；
- 回退：删除 `ACTIVE_SKILL_CD` 与 `simulateBattle` 内 `shouldTrigger` 分支，恢复 `pickPlayerSkill` 随机分支即可；前端移除 `skill-action` 样式。

## 8. 实施步骤

1. `data.js` 增 `ACTIVE_SKILL_CD` 并导出
2. `engine.js` 增 `getActiveSkillCd/shouldTriggerActiveSkill`、重构 `simulateBattle`（CD/buff/经济）并导出，`__resetSeams` 清 `buffs`
3. `MapView.vue` + `style.css` 完成 `skill` 高亮
4. `server/skill.test.js` + `pnpm test && pnpm build`
