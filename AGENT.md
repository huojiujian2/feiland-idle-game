# AGENTS — 项目协作约定（费兰德世界）

> 本文件为项目级 Agent 协作规则，优先级高于通用约定。新增功能必须严格以 `GAMEPLAY_GUIDE.html` 为唯一范围边界。

## 1. 范围约束（强制）

- 新增/变更功能 **不得超出** `GAMEPLAY_GUIDE.html` 定义的 33 个任务与对应章节描述。
- 禁止自行扩展玩法、数值、系统边界；若指南未提及即视为不做。
- 实现时仅使用指南中指定的文件与落点（见指南各任务“技术要点/涉及文件”），不引入指南外依赖。
- 数值、文案、解锁条件等以指南表格为准；与指南不一致需先修订指南再实现。

## 2. 固定交付流程（三步闸门，严格按序）

### 步骤 1 — 完成 Spec 等待审核

- 在分支 `feat/<T-ID>-<slug>` 上创建 `docs/specs/<T-ID>-<slug>-spec.md`（参考 `docs/specs/T-004-strategy-spec.md` / `T-001-damage-numbers-spec.md` 结构：背景/需求澄清/涉及文件/数据与落点/交互时序/验收标准/风险回退）。
- 同步将 `GAMEPLAY_TASKS.md` 对应任务置为 `🟡 进行中`，填写分支与 Spec 路径，不提前标记完成。
- 产出 `git commit` 但 **不推送**，等待用户审核 Spec（用户回复“没问题/可进入开发”视为通过）。

### 步骤 2 — Spec 审核通过后进入开发

- 仅在 Spec 通过后开始编码；代码变更严格限定于 Spec 列出的文件。
- 保持分层约束：`server/data.js` 静态/`server/engine.js` 逻辑/`server/index.js` 路由/`server/store.js` 持久化/`client/src/components/*.vue` 单功能组件/`client/src/style.css` 变量。
- UI 遵守 4 列 12/页、底部翻页器、遮罩关闭、动效仅 `var(--duration-*/--ease-*/--accent*/--lb-*)`。
- 本地自检：`npx vite build` 通过、`git diff --check` 0、相关单测通过（如有）。

### 步骤 3 — 代码审核通过后再更新进度文档并推送 GitHub

- 开发完成后 **先本地代码审核**，不直接更新 `GAMEPLAY_TASKS.md` 完成态、不 `git push` / `gh pr create`。
- 审核通过后再：
  1. 将 `GAMEPLAY_TASKS.md` 对应章节与“完整任务清单”改为 `✅ 已完成`，填分支/完成时间/备注，并更新顶部总览（已完成/待办/完成率）与更新日志；
  2. `git push -u origin feat/<T-ID>-<slug>` 并 `gh pr create --base main`（PR 正文含 Spec 路径、变更摘要、验证结果）；
  3. 仅在用户确认后合并（不自动 `gh pr merge`）。
- 推送前确认 `gh auth status` 身份为 `yaoyo <942744575@qq.com>`，避免历史作者污染。

## 3. 分支与提交

- 分支：`feat/<T-ID>-<slug>`（如 `feat/T-001-damage-numbers`），基底为最新 `main`。
- 提交信息：`feat(T-XXX): ...` / `fix(T-XXX): ...` / `docs(T-XXX): ...`，正文注明涉及文件与验证。
- 禁止修改 `package.json:packageManager`、`server/db.json`。

## 4. 校验清单

- [ ] 需求在 `GAMEPLAY_GUIDE.html` 范围内
- [ ] Spec 已创建并获审核通过
- [ ] 实现文件 ∈ Spec 涉及文件
- [ ] `pnpm build` / `git diff --check` 通过
- [ ] 审核通过后才更新 `GAMEPLAY_TASKS.md` 并推送
