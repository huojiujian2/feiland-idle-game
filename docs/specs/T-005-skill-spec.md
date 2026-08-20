# T-005 手动技能释放（主动词条实战） — Spec v4

> 优先级 🔴 高 · 难度 ★★★★ · 分支 `feat/T-005-skill` · 依赖 无 · 对应 `GAMEPLAY_GUIDE.html:2.2 T-005` / `GAMEPLAY_TASKS.md:2.2`
> 本版修复 v3 剩余 3×P1（A2-04 复合/普攻回归/顺序断言）+ 回合顶部判定契约，其余沿用 v3

## 1. 背景与目标

- 现状（同 v2）：`AFFIX_TREE 40` 主动、`simulateBattle` 60% 随机 `pickPlayerSkill` 已部分执行 `damage/heal/buff/gold`，但随机非 CD、增益不回退、经济未入结算、AGI 不影响行动。
- 目标：按指南六类 `damage/heal/atk_buff/def_buff/agi_buff/gold_buff` 在挂机战斗中按等级 CD 自动追加，`type:'skill'` 高亮，无手动。

成功标准：六类按 `5/4/3/2` CD 精确、伤害在普攻后追加、buff 到期回退、金币仅胜利生效、日志完整可渲染。

## 2. 需求澄清

- 触发：自动、**回合顶部判定一次** `shouldTrigger = activeAffix && shouldTriggerActiveSkill(round, cd)`（`round % cd === 0`，`1-indexed`），结果存 `roundShouldTrigger`，普攻后仅执行已确定的触发，不再重复判定。随机分支 `pickPlayerSkill` 彻底下线，普通攻击统一走 `doPlayerNormalAction`（见 §4.2）。本版技能为**追加**而非替代，且在**本回合第一条 player 普通攻击后**追加（符合指南“普通攻击后追加 `ATK×mult`”），若怪物先手则怪物首动后仍在同一回合内于首条 player 普通后追加；若首攻已击杀则本回合不再追加。
- CD 映射：`1→5, 2→4, 3→3, 4→2`（`data.js` 单一数据源）。
- 效果矩阵（唯一归一化，不自相矛盾）：

| 指南六类 | `effect.type` 精确匹配 | 归一化执行 | 本版是否改 `combat`/结算 |
|---|---|---|---|
| damage | `damage` | `calcDamage(combat.atk, mDef, mult, dmgBonus=0, 0, ignoreDef, crit/critDmg)` 追伤，不替代普攻 | 是 |
| heal | `heal` | `pHp = min(maxHp, pHp+floor(maxHp*value))` | 是 |
| atk_buff | `atk_buff` | `combat.atk = floor(combat.atk*(1+value))` 持续 `turns` | 是 |
| def_buff | `def_buff` | `combat.def = floor(combat.def*(1+value))` 持续 `turns` | 是 |
| agi_buff | `agi_buff` | `combat.agi = floor(combat.agi*(1+value))` 持续 `turns`（**不**重算 `effAgi/curPActions`，显式不做） | 是（仅数值） |
| gold_buff | `gold_buff` | `skillGoldBonus += value` 累加（每次 CD 触发 +10%，可叠） | 是（仅胜利） |

其它 `type`（`crit_buff/all_buff/agi_atk_buff/atk_def_buff/def_regen_buff/burn/bleed/exp_gold_*` 等）**本版仅日志**：统一产 `type:'skill'` 日志但不改 `combat`、不入结算，避免越界。复合字段**统一处理附带 `heal`**：主路径执行后，若 `eff.heal` 存在则额外 `pHp = min(maxHp, pHp+floor(maxHp*eff.heal))`（覆盖 `A2-04 def_buff+heal` 与 `A4-02 damage+heal` 等所有含 `heal` 的主动，§4.2 统一分支）。对外不宣称 40 全生效。

- 前端：仅 `action.type==='skill'` 判别高亮（`action.skill` 字段普通行也有，不得以此判别）。
- 不做：手动释放、打断/沉默、敌方 debuff 属性下调、AGI 重算行动数、EXP 类技能（见下）、音效/特效。

## 3. 涉及文件

- `server/data.js` — 新增 `ACTIVE_SKILL_CD` 并导出
- `server/engine.js` — 随机→CD、普攻后追加、buff 单层刷新、**仅金币**经济链路
- `client/src/components/MapView.vue` — `type:'skill'` 精确高亮（含 `combo` 分支保留，字段补齐）
- `client/src/style.css` — 新增 `--skill-*` 语义化 token（仅 `var(--*)`）
- `server/skill.test.js` — 新增，覆盖 CD/顺序/多行动/重叠/金币仅胜利/日志字段/切片

> 不改：`server/index.js`、`server/store.js`、`client/src/api.js`、`App.vue`

## 4. 数据与落点

### 4.1 常量

```js
// server/data.js
const ACTIVE_SKILL_CD = { 1: 5, 2: 4, 3: 3, 4: 2 };
module.exports = { ..., ACTIVE_SKILL_CD }
```

### 4.2 战斗落点（闭合 P0）

- `getCombatStats` 不变。
- `simulateBattle(player, monster)`（伪代码为契约，最终代码以此为准）：

```js
function getActiveSkillCd(level){ return ACTIVE_SKILL_CD[level] || 5; }
function shouldTriggerActiveSkill(round, cd){ return round % cd === 0; }

function simulateBattle(player, monster){
  const combat = getCombatStats(player);
  const activeAffix = player.affixes?.active ? findAffix(player.affixes.active) : null;
  const cd = activeAffix ? getActiveSkillCd(activeAffix.level) : null;
  let skillGoldBonus = 0; // P0：仅金币，删除 skillExpBonus，避免无来源
  let buffs = []; // { key, value, before, expireRound }
  function applyBuff(key, value, turns, round){
    const expireRound = round + turns; // 5+2→7；5,6 生效，7 顶部回退
    const idx = buffs.findIndex(b=>b.key===key);
    if(idx!==-1){
      const old = buffs[idx];
      if(old.key==='crit') combat.crit = old.before; else combat[old.key] = old.before;
      buffs.splice(idx,1);
    }
    const before = combat[key];
    combat[key] = Math.floor(combat[key]*(1+value));
    buffs.push({ key, value, before, expireRound });
  }
  function expireBuffs(round){
    const remain=[];
    for(const b of buffs){
      if(round >= b.expireRound){ combat[b.key] = b.before; }
      else remain.push(b);
    }
    buffs = remain;
  }
  function doPlayerNormalAction(){
    // 统一普通攻击：保留现有被动（吸血 calcDamage 后回血），彻底移除 pickPlayerSkill 随机
    const r = calcDamage(combat.atk, mDef, 1, combat.dmgBonus, 0, combat.ignoreDef, combat.crit, combat.critDmg);
    mCurHp -= r.value;
    if(combat.lifesteal>0) pHp = Math.min(combat.maxHp, pHp + Math.floor(r.value*combat.lifesteal));
    actions.push({ actor:'player', skill:'普通攻击', damage:r.value, crit:r.isCrit, targetHp:Math.max(0,mCurHp), targetMaxHp:mHp });
    return r;
  }
  function doMonsterNormalAction(){
    if(_rand() < (combat.dodge||0)){
      actions.push({ actor:'player', skill:'闪避!', dodge:true, targetHp:pHp, targetMaxHp:combat.maxHp });
      return;
    }
    const mSkill = pickMonsterSkill(monster);
    let mult=1, skillName='普通攻击';
    if(mSkill){ mult=mSkill.mult; skillName=mSkill.name; }
    const d = calcDamage(mAtk, combat.def, mult, 0, combat.defBonus, 0, 0, 0);
    let dmg=d.value; if(combat.dmgTaken) dmg=Math.floor(dmg*(1+combat.dmgTaken));
    pHp -= dmg;
    if(combat.thorns>0) mCurHp -= Math.floor(dmg*combat.thorns);
    if(combat.regen>0 && pHp>0) pHp=Math.min(combat.maxHp, pHp+Math.floor(combat.maxHp*combat.regen));
    actions.push({ actor:'monster', skill:skillName, damage:dmg, targetHp:Math.max(0,pHp), targetMaxHp:combat.maxHp });
  }
  // 校验指南：玩家技能不使用 defBonus，calcDamage 第5参传 0
  for(let round=1; round<=30; round++){
    expireBuffs(round);
    const roundShouldTrigger = activeAffix && shouldTriggerActiveSkill(round, cd); // 回合顶部判定
    // 队列（curPActions/curMActions）按 effAgi snapshot 计算，AGI buff 本版不触发重算
    const queue = buildQueue(round, combat, effAgi); // 含 playerFirst 逻辑
    let firstPlayerNormalIdx = -1; // 记录首条 player 普通在 actions 中的下标，用于顺序断言
    for(const actor of queue){
      if(pHp<=0 || mCurHp<=0) break;
      if(actor==='player' && firstPlayerNormalIdx===-1){
        const beforeLen = actions.length;
        doPlayerNormalAction();
        firstPlayerNormalIdx = beforeLen;
        // 追加技能（普攻后，复用顶部判定）
        if(roundShouldTrigger && mCurHp>0 && pHp>0){
          const eff = activeAffix.effect;
          let skillPushed = false;
          if(eff.type==='damage'){
            const d = calcDamage(combat.atk, mDef, eff.mult, combat.dmgBonus, 0, combat.ignoreDef, combat.crit, combat.critDmg);
            mCurHp -= d.value;
            if(combat.lifesteal>0) pHp = Math.min(combat.maxHp, pHp + Math.floor(d.value*combat.lifesteal));
            actions.push({ actor:'player', skill:activeAffix.name, damage:d.value, crit:d.isCrit, type:'skill', targetHp:Math.max(0,mCurHp), targetMaxHp:mHp });
            skillPushed = true;
          } else if(eff.type==='heal'){
            const h=Math.floor(combat.maxHp*eff.value); pHp=Math.min(combat.maxHp,pHp+h);
            actions.push({ actor:'player', skill:activeAffix.name, heal:h, type:'skill', targetHp:pHp, targetMaxHp:combat.maxHp });
            skillPushed = true;
          } else if(['atk_buff','def_buff','agi_buff'].includes(eff.type)){
            const key=eff.type.split('_')[0]; applyBuff(key, eff.value, eff.turns, round);
            actions.push({ actor:'player', skill:activeAffix.name, buff:eff.value, type:'skill', targetHp:pHp, targetMaxHp:combat.maxHp });
            skillPushed = true;
          } else if(eff.type==='gold_buff'){
            skillGoldBonus += eff.value;
            actions.push({ actor:'player', skill:activeAffix.name, buff:eff.value, type:'skill', targetHp:pHp, targetMaxHp:combat.maxHp });
            skillPushed = true;
          } else {
            actions.push({ actor:'player', skill:activeAffix.name, type:'skill', note:eff.type, targetHp:pHp, targetMaxHp:combat.maxHp });
            skillPushed = true;
          }
          // 统一处理附带 heal（覆盖 A2-04 def_buff+heal 与 A4-02 damage+heal 等所有含 heal 的主动）
          if(skillPushed && eff.heal){
            const h=Math.floor(combat.maxHp*eff.heal); pHp=Math.min(combat.maxHp,pHp+h);
            // 将 heal 合并进最后一条 skill 日志（若已有 heal 则累加，否则追加 heal 字段）
            const last = actions[actions.length-1];
            if(last.heal) last.heal += h; else last.heal = h;
            // 同步 targetHp
            last.targetHp = pHp;
          }
        }
      } else if(actor==='monster'){
        doMonsterNormalAction();
      } else {
        // 后续 player 普通攻击（非首条，不追加技能）
        doPlayerNormalAction();
      }
    }
    rounds.push({ round, actions, pHp:Math.max(0,pHp), mHp:Math.max(0,mCurHp), pActions:curPActions, mActions:curMActions });
    if(mCurHp<=0){ result='win'; break; }
    if(pHp<=0){ /* 复活/护盾 */ }
  }
  return { result, rounds, playerHp:Math.max(0,pHp), playerMaxHp:combat.maxHp, monsterHp:Math.max(0,mCurHp), skillGoldBonus };
}
```

- `calculateIdle`（仅胜利金币）：

```js
const battle = simulateBattle(player, battleMonster);
let expMult = 1 + total.expBonus + lawBonus.exp + (raceBonus.exp||0);
let goldMult = 1 + total.goldBonus + lawBonus.gold;
if(player.godhood==='demigod') expMult*=1.5; if(player.godhood==='god') expMult*=2;
const stratEff = STRATEGIES[player.strategy]?.effects||{};
if(stratEff.exp) expMult *= (1+stratEff.exp);
if(stratEff.gold) goldMult *= (1+stratEff.gold);
if(battle.result==='win'){
  if(battle.skillGoldBonus) goldMult *= (1 + battle.skillGoldBonus); // P1：仅胜利追加
  let expGain = Math.floor(monster.exp * expMult);
  let goldGain = Math.floor(monster.gold * goldMult);
  // talents.killExp / total.killExp / flatExp / doubleKill 仅 win
} else if(battle.result==='lose'){
  expGain = Math.floor(monster.exp * 0.1 * expMult); // 无金币
} else { // timeout
  expGain = Math.floor(monster.exp * 0.3 * expMult);
}
// goldGain 仅 win 分支产生；lose/timeout 即使 skillGoldBonus>0 也不产生金币
```

- 返回仅 `skillGoldBonus`（删 `skillExpBonus`），`exp_gold_*` 本版不入结算。

### 4.3 前端落点（字段闭合）

- `MapView.vue`：
  - `processActions()` 的 `combo` 分支保留 `type:'skill'` 时追加 `skill-action`（紫色高亮），不以 `skill` 字段判别；
  - `actionClass(a)`：`a.type==='skill'`→`skill-action`；
  - 日志字段：所有 `type:'skill'` 的 `actions` 必须含 `targetHp/targetMaxHp`（damage 行取 `mCurHp/mHp`，heal/buff 行取 `pHp/maxHp`），`MapView.vue:154` 的 `targetHp` 渲染不再空；
  - 仅日志的 `note` 行：模板增加 `v-else-if="a.note"` 兜底显示 `{{a.skill}}（{{a.note}}）`，避免空行。
- `style.css`：`--skill-highlight/--skill-bg/--skill-border` 映射 `var(--accent2)` 等，组件仅 `var(--skill-*)`。

## 5. 交互与时序

```
calculateIdle -> buildBattleMonster -> simulateBattle(round 1..30)
  round: expireBuffs -> roundShouldTrigger=shouldTriggerActiveSkill(round,cd) (顶部) -> build queue -> firstPlayerNormal -> if roundShouldTrigger && alive -> skill追加(type:'skill', after first normal) -> 剩余 queue (doMonsterNormal/doPlayerNormal)
  -> return { battle, skillGoldBonus } -> calculateIdle win时 goldMult*=1+skillGoldBonus -> logs.push(battle)
MapView: findLatestBattle().detail.flatMap(r=>r.actions).filter(a=>a.type==='skill') -> 紫色高亮（含 combo）
```

- `detail slice(-6)`：早期 skill 可能截断，测试覆盖短场（≤6 回合）可见性，长场后续可改为全量。
- 同 key buff 单层刷新：先回退 `before` 再压新层，不叠乘。

## 6. 验收标准

- [ ] `CD`：`A1-01 5→5,10,15` 各一次，`B4-05 2→2,4,6...` 各一次，同回合仅一次（`shouldTrigger` 于回合顶部判定）
- [ ] 顺序：player actions 中第一条普通攻击后紧邻 `type:'skill'`（`queue` 内 `firstPlayerNormalIdx` 的下一条即 skill），分别覆盖玩家先手（`actions` 首条为 player 普通）与怪物先手（首条为 monster，首条 player 普通后仍紧邻 skill），首攻击杀则不追加
- [ ] `damage`：`A1-01 ATK×1.2` 经 `calcDamage(..., defBonus=0)` 且不替代普攻；所有含 `heal` 的主动（`A2-04 def_buff+heal`/`A4-02 damage+heal` 等）在主效果后统一回血
- [ ] `buff`：`A1-04 10% 2回合` `5` 生效，`6` 保持，`7` 回退至 `before`
- [ ] `gold_buff`：`A1-05` 每次累加，`5→+10%`，`10→+20%`，仅 `win` 的 `goldGain` 放大，`lose/timeout` 不产生金币
- [ ] 日志：`type:'skill'` 均含 `targetHp/targetMaxHp`，`note` 行有兜底渲染，`combo` 行同高亮
- [ ] 无主动时无 `skill`，不报错；短场 skill 在 `detail` 可见
- [ ] `pnpm build`/`git diff --check 0`/`node --test server/**/*.test.js` 通过（`server/skill.test.js` 覆盖 CD/顺序/多行动/重叠/金币仅胜利/字段/切片）
- [ ] 风格：仅 `var(--skill-*/--duration-*/--ease-*)`

## 7. 风险与回退

- 风险：`slice(-6)` 截断—— 短场覆盖；AGI 不重算已显式。
- 回退：删 `ACTIVE_SKILL_CD` 与顶层追加分支，恢复 `pickPlayerSkill` 60% 随机。

## 8. 实施步骤

1. `data.js` 增 `ACTIVE_SKILL_CD`
2. `engine.js` 增 `getActiveSkillCd/shouldTriggerActiveSkill`、重构 `simulateBattle`（普攻后追加/单层刷新/仅金币）、`calculateIdle` 仅胜利结算
3. `MapView.vue` + `style.css` 精确高亮与字段兜底
4. `server/skill.test.js` + `pnpm test && pnpm build`
