# Issue 03: 将取消与可预期失败改为结构化 completion

Status: ready-for-agent
Type: AFK

## Parent

.scratch/deck-generation-flow/PRD.md

## What to build

将 Deck Generation 的可预期终态收敛为结构化 completion，避免把取消、页面生成失败、Agent infrastructure failure 和未知异常都混成普通 thrown Error。

模块应返回 `completed`、`cancelled`、`failed` 三类终态。Workspace 根据终态选择 UI 行为：取消是正常停止，不显示普通错误 toast；可恢复/不可恢复失败展示明确原因；Agent infrastructure failure 与页面质量失败可区分。

## Acceptance criteria

- [ ] Deck Generation Module 对可预期终态返回结构化 completion：`completed`、`cancelled`、`failed`。
- [ ] 取消生成时返回 cancelled completion，并保留最后可用 progress。
- [ ] Workspace 处理 cancelled completion 时不把它当成普通错误 toast。
- [ ] 不可恢复页面失败返回 failed completion，并包含 page-level failure reason。
- [ ] Agent infrastructure failure 返回 distinct failed completion，与页面生成失败可区分。
- [ ] unexpected programming error 仍可抛出，不被错误包装成业务失败。
- [ ] mock 单测覆盖 cancelled、unrecoverable page failure、Agent infrastructure failure 三种终态。

## Blocked by

- .scratch/deck-generation-flow/issues/01-confirmed-outline-success-path.md
- .scratch/deck-generation-flow/issues/02-progress-contract-and-ui.md

