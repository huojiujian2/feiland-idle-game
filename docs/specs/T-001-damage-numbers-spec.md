# T-001 战斗伤害数字飘字 — 技术方案 Spec

## 1. 背景与目标

- 现状：`MapView.vue` 战斗日志为文字叙述，无伤害数字直观反馈，`server/engine.js:calculateIdle()` 已返回结构化战斗数据但前端未可视化。
- 目标：在战斗日志区域上方添加浮动伤害数字 overlay（红物理/蓝法术/绿治疗/黄暴击放大），向上飘移淡出约 1.5s，暴击更大+抖动，复用 `engine.js` 已有数据，零后端变更，纯前端增强。

## 2. 需求澄清

- 展示内容：玩家对怪物伤害、怪物对玩家伤害、治疗、闪避文字、暴击标记。
- 颜色：`--danger` 红（物理）、`--accent2` 蓝紫（法术/怪物）、`--success` 绿（治疗）、暴击黄 `#ff6b3d` 放大。
- 触发时机：监听 `player.logs` 新增 `type:'battle'`，提取 `log.detail[].actions` 中 `damage/heal/dodge`。
- 容器：`MapView.vue` 的 `log-section` 内叠加 `position:absolute` 的 `damage-layer`，`pointer-events:none`。
- 动画：`translateY(0→-60px)` + `opacity 0→1→0` 1.5s，暴击 `scale(1.3)` + `shake` 0.15s。
- 性能：每场战斗最多 ~30 个数字，队列截断 12 个，多余丢弃，定时清除防止堆积。
- 可访问性：`aria-live="polite"` 但 `aria-hidden` 对装饰数字，避免读屏干扰。
- 无后端变更，不新增 API。

## 3. 涉及文件

- `client/src/components/MapView.vue` — 新增 `damage-layer` overlay + JS 逻辑 `damageItems`。
- `client/src/style.css` — 新增飘字 keyframes 与颜色变量（复用现有 `--danger/--success/--accent2`，新增 `--dmg-crit` 可选）。
- 无 `server/*` 变更。

## 4. 数据与落点

- 数据源：`props.player.logs[0]`（最新 battle log，因 `getPlayerView` 返回 `logs.reverse()`，最新在 0 位；轮询时 `watch logs` 触发）。
- 提取：`log.detail.flatMap(r=>r.actions).filter(a=>a.damage||a.heal||a.dodge)`。
- 类型判定：`a.actor==='player' && a.damage` → 玩家伤害；`actor==='monster' && a.damage` → 怪物伤害；`a.heal` → 治疗；`a.dodge` → 闪避。
- 暴击：`a.crit===true`。

## 5. 交互与时序

```
watch(player.logs) -> detect new battle log (compare lastLogTime)
  -> extract actions -> push to damageItems[] with uid, stagger 80ms
  -> CSS animation 1.5s -> setTimeout remove (1.6s)
```

- 去重：记录 `lastBattleTime`，相同 `log.time` 不重复触发。
- 节流：若 `damageItems.length>12` 仅保留最新 12，丢弃旧的。
- 降级：无新战斗时不显示；`prefers-reduced-motion` 时直接淡出无位移。

## 6. 动画规范

- 普通伤害：`damage-float 1.5s var(--ease-out) forwards`
- 暴击：`damage-float 1.5s var(--ease-out) forwards, crit-shake 0.15s 0.05s`
- 治疗：同上但绿色，略慢 `1.4s`
- 闪避：`miss-float 1.2s forwards`（灰色+小字）
- 必须使用 CSS 变量时长/缓动，不硬编码。

## 7. 验收标准

- [ ] 新战斗产生时，伤害数字从日志区中部向上飘出并 1.5s 消失
- [ ] 玩家伤害红、怪物伤害蓝紫、治疗绿、暴击黄放大+抖动可区分
- [ ] 连续战斗不堆积卡顿，旧数字及时清除
- [ ] 无障碍：数字 `aria-hidden`，不干扰读屏
- [ ] `pnpm build` 通过，`git diff --check` 0
- [ ] 风格：颜色/动效使用 `var(--*)`，无硬编码

## 8. 风险与回退

- 风险：轮询延迟 3s 导致飘字延迟——可接受（与日志一致）。
- 回退：移除 `damage-layer` 与 `watch` 逻辑即可。
