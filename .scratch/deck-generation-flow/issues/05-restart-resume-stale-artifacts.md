# Issue 05: 实现 restart / resume 启动语义与 stale artifacts 失败

Status: ready-for-agent
Type: AFK

## Parent

.scratch/deck-generation-flow/PRD.md

## What to build

为 Deck Generation Flow Module 引入显式启动语义：`restart` 和 `resume`。这应消除当前“UI 看起来可以恢复，但实际可能重新生成 Page Plan”的模糊行为。

`restart` 应明确重新生成 Page Plan，并重置或覆盖当前 Confirmed Outline 对应的 Page Progress。`resume` 只在现有 Page Plan 和 Page Progress 与当前 Confirmed Outline / Template 匹配时复用，跳过已 accepted 的页面并继续未完成页面。如果 artifacts 已过期或不兼容，模块应返回 stale-artifacts failed completion，而不是静默重新规划。

## Acceptance criteria

- [ ] 模块主入口接受 `restart` / `resume` start mode。
- [ ] `restart` 会重新生成 Page Plan，并为当前 Confirmed Outline 建立新的 Page Progress。
- [ ] `resume` 会校验现有 Page Plan / Page Progress 是否匹配当前 Confirmed Outline 和 Template。
- [ ] `resume` 匹配成功时复用现有 Page Plan / Page Progress，并跳过 accepted 页面。
- [ ] `resume` 检测到 stale artifacts 时返回 failed completion，failure type 可区分为 stale artifacts。
- [ ] stale artifacts 失败不会静默触发重新生成 Page Plan。
- [ ] mock 单测覆盖 restart、resume 跳过 accepted 页面、resume stale artifacts failure。

## Blocked by

- .scratch/deck-generation-flow/issues/01-confirmed-outline-success-path.md
- .scratch/deck-generation-flow/issues/02-progress-contract-and-ui.md
- .scratch/deck-generation-flow/issues/03-structured-completion.md

