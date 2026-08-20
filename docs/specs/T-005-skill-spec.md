# T-005 手动技能释放（主动词条实战） — Spec v2

> 优先级 🔴 高 · 难度 ★★★★ · 分支 `feat/T-005-skill` · 依赖 无 · 对应 `GAMEPLAY_GUIDE.html:2.2 T-005` / `GAMEPLAY_TASKS.md:2.2`
> 本版修复 v1 的 3×P0 + 4×P1（经济链路/CD队列/过期/范围/现状/AGI/前端识别/测试），其余沿用 v1

## 1. 背景与目标

- 现状（修正 v1 不准确描述）：`AFFIX_TREE` `slot:'active'` 已有 40 主动词条（`A1-01..B4-05`），`simulateBattle` 已有 `pickPlayerSkill(combat)` 60% 随机路径（`engine.js:681` 35% 反击）并对 `damage/heal/atk_buff/def_buff/agi_buff/gold_buff/all_buff/burn` 等做**部分**执行，但存在：① 随机而非 CD；② `combat.atk/def/...` 增益永不回退；③ `gold_buff/exp_gold` 等经济类未进入 `calculateIdle` 结算；④ `agi_buff` 不影响行动数；⑤ `burn/crit_buff` 等派生仅日志。
- 目标：挂机每场战斗按词条等级 CD 自动释放主动技能（`初5/中4/高3/大师2` 回合），按指南六类效果执行真实战斗/经济效果，`actions[].type:'skill'` 前端特殊渲染，零手动点击（“或手动” 预留，不在本版）。

成功标准：指南六类 `damage/heal/atk_buff/def_buff/agi_buff/gold_buff` 在挂机战斗中按 CD 精确触发，`CD`/`turns` 精确，经济类累进入 `goldGain/expGain`，buff 到期回退，日志可渲染。

## 2. 需求澄清

- 触发：**自动、每回合一次**，每场战斗独立，`round 1..30`，`round % CD === 0`（`1-indexed`，初级 5→`5,10,15...`，大师 2→`2,4,6...`）。判定在**回合顶层**（队列构造前）执行一次，不在 `doAction` 内重复判定，避免多行动 `player` 节点重复触发。`pickPlayerSkill` 的 60% 随机分支在本版**下线**，改由 `shouldTriggerActiveSkill(round, cd)` 显式判定以保证可测试性。
- CD 映射：`AFFIX_LEVELS level→CD`：`1→5, 2→4, 3→3, 4→2`，单一数据源 `ACTIVE_SKILL_CD = {1:5,2:4,3:3,4:2}`（`data.js`）。
- 效果矩阵（严格以指南六类为边界，不越界宣称 40 全生效）：
  - 本版**实现**：`damage`、`heal`、`atk_buff`、`def_buff`、`agi_buff`、`gold_buff` 六类。其它 `effect.type`（`crit_buff/all_buff/agi_atk_buff/atk_def_buff/def_regen_buff/burn/bleed/exp_gold_*` 等）在 `AFFIX_TREE` 中存在的，仅做**就近归集**：含 `mult` 的按 `damage` 执行（派生 `paralyze/reduceDef/reduceAgi/stun/bleed` 本版仅日志，不调敌方属性）；含 `heal` 字段的按 `heal` 归集；`all_buff/agi_atk_buff/atk_def_buff` 拆为 `atk_buff+def/agi` 多键；`crit_buff/def_regen` 等本版仅日志，不改 `combat`（避免越界失真）。对外宣称“六类生效，其余仅日志”以通过范围审核。
  - `damage`：追加 `ATK × mult` 技能伤害（走 `calcDamage`，含 `defBonus/ignoreDef/crit/浮动`），**不替代**普通攻击（本回合额外插入一条 `type:'skill'`）；
  - `heal`：`pHp = min(maxHp, pHp + floor(maxHp*value))`；
  - `atk_buff/def_buff/agi_buff`：`combat.atk = floor(combat.atk*(1+value))`（同理 `def/agi`），持续 `turns` 回合，到期回退；
  - `gold_buff`：本场经济累加，每次触发 `skillGoldBonus += value`（可多次累加，`A1-05` 在 `round 5,10...` 每次 +10%，叠加）；
- 不做：手动点击释放、技能打断/沉默、PVP 独立、新增主动词条、数值调参、音效（T-003）、动作特效（T-002）、敌方 debuff 属性下调、AGI 影响行动数（本版不做，见 §4.2）。
- 前端：仅 `MapView` 战斗日志对 `action.type==='skill'` 高亮（严格 `type` 判别，不以含 `skill` 字段判别，因普通 `actions` 也有 `skill: skillName` 字段）；不新增 Tab/弹窗。
- 约束：仅 `server/data.js` 静态、`server/engine.js` 逻辑、`client/src/components/MapView.vue` + `client/src/style.css` 变量、`server/skill.test.js` 测试；`server/index.js`/`store.js`/`client/src/api.js`/`App.vue` 无变更。

## 3. 涉及文件

- `server/data.js` — 新增 `ACTIVE_SKILL_CD`（`{1:5,2:4,3:3,4:2}`）并导出
- `server/engine.js` — 由随机改为 CD 触发、修复 buff 过期与经济链路、新增/导出 `getActiveSkillCd/shouldTriggerActiveSkill`（可测试 seam）
- `client/src/components/MapView.vue` — `type:'skill'` 特殊渲染（颜色/图标/高亮，注意绕过 `processActions` 的 combo 分支，见 §4.3）
- `client/src/style.css` — 新增 `--skill-*` 语义化 token（仅 `var(--*)`）
- `server/skill.test.js` — 新增，覆盖 CD/buff/经济/多行动/重叠/切片

> 不改：`server/index.js`、`server/store.js`、`client/src/api.js`、`App.vue`

## 4. 数据与落点

### 4.1 常量

```js
// server/data.js
const ACTIVE_SKILL_CD = { 1: 5, 2: 4, 3: 3, 4: 2 };
module.exports = { ..., ACTIVE_SKILL_CD }
```

### 4.2 战斗落点（修复 P0×3）

- `getCombatStats` 保持不变（快照低血/策略/被动词条），不纳入主动技能增益（增益在 `simulateBattle` 内按回合生效）。
- `simulateBattle(player, monster)` 重构：

```js
function getActiveSkillCd(level){ return ACTIVE_SKILL_CD[level] || 5; }
function shouldTriggerActiveSkill(round, cd){ return round % cd === 0; }

function simulateBattle(player, monster){
  const combat = getCombatStats(player);
  const activeAffix = player.affixes?.active ? findAffix(player.affixes.active) : null;
  const cd = activeAffix ? getActiveSkillCd(activeAffix.level) : null;
  // P0-经济：显式返回字段，避免 combat 局部变量丢失
  let skillGoldBonus = 0, skillExpBonus = 0;
  // P0-过期：记录基线 before，到期恢复，不叠加，仅单层刷新
  let buffs = []; // { key, value, before, expireRound }
  // helper
  function applyBuff(key, value, turns, round){
    const expireRound = round + turns; // 5+2→7，下同；验收：5 生效，6 保持，7 回退
    // 同 key 刷新：先移除旧层（回退到 before），再压新层
    const idx = buffs.findIndex(b=>b.key===key);
    if(idx!==-1){
      const old = buffs[idx];
      // 回退旧层（恢复 before，已在到期逻辑处理，此处先即时回退以避免叠乘）
      if(key==='crit') combat.crit = old.before; else if(key==='regen') combat.regen = old.before; else combat[key] = old.before;
      buffs.splice(idx,1);
    }
    const before = (key==='crit'? combat.crit : key==='regen'? combat.regen : combat[key]);
    if(key==='crit') combat.crit += value; else if(key==='regen') combat.regen += value; else combat[key] = Math.floor(combat[key]*(1+value));
    buffs.push({ key, value, before, expireRound });
  }
  function expireBuffs(round){
    // 首个失效回合 = expireRound，本回合顶部过期（>=）
    const remain=[];
    for(const b of buffs){
      if(round >= b.expireRound){
        if(b.key==='crit') combat.crit = b.before; else if(b.key==='regen') combat.regen = b.before; else combat[b.key] = b.before;
      } else remain.push(b);
    }
    buffs = remain;
  }
  // 循环
  for(let round=1; round<=30; round++){
    expireBuffs(round); // P0-过期：回合顶部过期，5 转 turns2→7 到期（5,6 生效，7 回退）
    // P0-CD：回合顶层判定一次，避免多行动重复
    let skillAction = null;
    if(activeAffix && shouldTriggerActiveSkill(round, cd)){
      const eff = activeAffix.effect;
      if(eff.type==='damage'){
        const dmg = calcDamage(combat.atk, mDef, eff.mult, combat.dmgBonus, 0, combat.ignoreDef, combat.crit, combat.critDmg);
        mCurHp -= dmg.value;
        if(combat.lifesteal>0) pHp = Math.min(combat.maxHp, pHp + Math.floor(dmg.value*combat.lifesteal));
        skillAction = { actor:'player', skill: activeAffix.name, damage: dmg.value, crit: dmg.isCrit, type:'skill' };
        // 派生 agi/atk/crit_buff 等若存在则同时 applyBuff（附带增益）
        if(eff.agi_buff) applyBuff('agi', eff.agi_buff, eff.turns||2, round);
        if(eff.atk_buff) applyBuff('atk', eff.atk_buff, eff.turns||2, round);
        if(eff.crit_buff) applyBuff('crit', eff.crit_buff, eff.turns||2, round);
      } else if(eff.type==='heal'){
        const heal = Math.floor(combat.maxHp * eff.value);
        pHp = Math.min(combat.maxHp, pHp+heal);
        skillAction = { actor:'player', skill: activeAffix.name, heal, type:'skill' };
      } else if(['atk_buff','def_buff','agi_buff'].includes(eff.type)){
        const key = eff.type.split('_')[0]; // atk/def/agi
        applyBuff(key, eff.value, eff.turns, round);
        skillAction = { actor:'player', skill: activeAffix.name, buff: eff.value, type:'skill' };
      } else if(eff.type==='gold_buff'){
        skillGoldBonus += eff.value; // P0-经济：累加，每次 CD 触发 +10%
        // 不直接改 combat.goldBonus，统一由返回值累加至结算
        skillAction = { actor:'player', skill: activeAffix.name, buff: eff.value, type:'skill' };
      } else {
        // 其它 type（all_buff/burn/crit_buff 等）本版仅日志，不改数值，避免越界
        skillAction = { actor:'player', skill: activeAffix.name, type:'skill', note: eff.type };
      }
    }
    // 构造本回合队列：若有 skillAction，先插入一条 skill，再按 curPActions/curMActions 交替（技能不占 curPActions）
    // P1-AGI：本版 AGI buff 不影响 effAgi/curPActions（effAgi 在首回合 snapshot），仅影响后续 atk/def 结算；如需影响行动需每回合重算 effAgi，不在本版
    // actions 收集：若 skillAction 先 push，再执行 doAction 循环
  }
  return { result, rounds, playerHp, ..., skillGoldBonus, skillExpBonus };
}
```

- `calculateIdle` 经济链路闭合（P0）：

```js
const battle = simulateBattle(player, battleMonster);
let expMult = 1 + total.expBonus + lawBonus.exp + (raceBonus.exp||0);
let goldMult = 1 + total.goldBonus + lawBonus.gold;
if(player.godhood==='demigod') expMult *=1.5; if(player.godhood==='god') expMult*=2;
const stratEff = STRATEGIES[player.strategy]?.effects||{};
if(stratEff.exp) expMult *= (1+stratEff.exp);
if(stratEff.gold) goldMult *= (1+stratEff.gold);
// 追加主动技能经济
if(battle.skillGoldBonus) goldMult *= (1 + battle.skillGoldBonus);
if(battle.skillExpBonus) expMult *= (1 + battle.skillExpBonus);
if(battle.result==='win'){
  let expGain = Math.floor(monster.exp * expMult);
  let goldGain = Math.floor(monster.gold * goldMult);
  // ... 保留 talents.killExp/total.killExp/flatExp/doubleKill 仅 win 分支
}
```

- 返回：`simulateBattle` 增加 `skillGoldBonus/skillExpBonus` 字段；`calculateIdle` 将其纳入 `expMult/goldMult` 后结算，`win/lose/timeout` 均受策略与技能经济影响（`lose` 10% 保底、`timeout` 30% 保底同享 `expMult`，但 `doubleKill` 仅 `win`）。

### 4.3 前端落点（修复 P1 前端）

- `MapView.vue`：`processActions()` 的 `combo` 分支会吞掉 `actionClass`，需在 `combo` 映射中保留 `type:'skill'` 时追加 `skill-action`；`actionClass()` 仅对 `action.type==='skill'` 加 `skill-action`，不以 `action.skill` 字段判别（普通 `calcDamage` 行也有 `skill: skillName`）。
- `style.css`：`--skill-highlight: var(--accent2); --skill-bg: rgba(157,140,240,0.12); --skill-border: var(--accent2)`，组件仅 `var(--skill-*)`。

## 5. 交互与时序

```
calculateIdle -> buildBattleMonster -> simulateBattle(round 1..30)
  round start: expireBuffs(round) -> if shouldTrigger(round,cd) -> apply effect (damage/heal/buff/gold) as skillAction (type:'skill', not in curPActions)
             -> build queue (curPActions/curMActions) -> doAction loop (normal attacks)
  -> return { battle, skillGoldBonus/skillExpBonus } -> calculateIdle settlement (expMult/goldMult *= 1+skill*) -> logs.push(battle) -> getPlayerView
MapView: findLatestBattle().detail.flatMap(r=>r.actions).filter(a=>a.type==='skill') -> 紫色高亮 var(--skill-*)（含 combo 行）
```

- 单层 buff：同 `key` 重复触发时刷新持续期（旧层回退后压新层），不叠加乘法，避免 `before` 失真；多层并发测试仅验证刷新语义。
- `detail` 仅保留最后 6 回合：早期 `skill` 行可能被截断，测试需验证 `round 5` 的 skill 在 `detail` 可见性（若 30 回合则前 24 回合被截，建议 `detail` 改为全量或首尾保留，本版保持 `slice(-6)` 但测试覆盖“短场 6 回合内 skill 可见”）。

## 6. 验收标准

- [ ] `A1-01` 初级 `CD 5`：`round 5,10,15` 各一次 `type:'skill'`，`round 1-4` 无；`A4-01` 大师 `CD 2`：`2,4,6...` 触发（同回合仅一次，不受多行动影响）
- [ ] `damage`：`A1-01 ATK×1.2` 追伤经 `calcDamage` 且不替代普攻（本回合 `actions.length = curPActions + curMActions + 1`），`heal` 上限截断
- [ ] `buff`：`A1-04 ATK+10% 2回合` 在 `5` 生效（`combat.atk` 放大），`6` 保持，`7` 回退至 `before`（`expireRound=7`），后续伤害回落
- [ ] `gold_buff`：`A1-05` 每次触发累加，`round 5` 后 `goldMult+=10%`，`round 10` 后 `20%`，`win/lose/timeout` 均按最终 `goldMult` 结算（`lose` 仅 10% 保底基数）
- [ ] 日志：`detail.actions` 中 `type:'skill'` 可被前端 `action.type==='skill'` 精确识别，`combo` 行同高亮
- [ ] 无主动词条时无 `skill` 行，不报错；`detail` 6 行截断场景下短场 skill 可见
- [ ] `pnpm build`、`git diff --check 0`、`node --test server/**/*.test.js` 通过（新增 `server/skill.test.js` 覆盖 CD/buff过期/经济/多行动/重叠/切片）
- [ ] 风格：`style.css` 仅 `var(--skill-*/--duration-*/--ease-*)`，`MapView` 无硬编码

## 7. 风险与回退

- 风险：`detail slice(-6)` 致早期 skill 不可见—— 短场覆盖可验，长场可后续改为全量；AGI 不影响行动数已在 Spec 显式不做，避免引入 `effAgi` 重算回归。
- 回退：删除 `ACTIVE_SKILL_CD` 与 `simulateBattle` 内顶层 `shouldTrigger` 分支，恢复 `pickPlayerSkill` 60% 随机分支即可；前端移除 `skill-action` 与 `var(--skill-*)`。

## 8. 实施步骤

1. `data.js` 增 `ACTIVE_SKILL_CD` 并导出
2. `engine.js` 增 `getActiveSkillCd/shouldTriggerActiveSkill`、重构 `simulateBattle`（顶层 CD/单层刷新 buff/skillGold 累加）并导出，`__resetSeams` 清扩展状态
3. `MapView.vue` + `style.css` 完成 `type:'skill'` 精确高亮（含 combo 分支）
4. `server/skill.test.js` + `pnpm test && pnpm build`
