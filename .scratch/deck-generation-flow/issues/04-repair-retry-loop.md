# Issue 04: 模块内固化 render-fix 与 self-review-fix 重试闭环

Status: ready-for-agent
Type: AFK

## Parent

.scratch/deck-generation-flow/PRD.md

## What to build

让 Deck Generation Flow Module 明确拥有页面 authoring prompt、render-fix prompt context、self-review prompt、self-review-fix context、重试上限和日志写入策略。

当页面 render 失败时，模块应把 render error 带回下一轮 authoring，进入 render-fix 闭环；当 self-review 不通过时，模块应把 self-review 结果带回下一轮 authoring，进入 self-review-fix 闭环；当重试耗尽时，模块返回结构化 failed completion。

## Acceptance criteria

- [ ] render 失败后，模块记录 render attempt 和错误，并进入 render-fix authoring。
- [ ] render-fix 成功后，流程继续进入 render、self-review 和后续步骤。
- [ ] self-review 不通过后，模块记录 self-review attempt、review 结果和 revision request，并进入 self-review-fix authoring。
- [ ] self-review-fix 成功后，流程继续进入 render、self-review 和后续步骤。
- [ ] render retry 耗尽时返回 failed completion，failure reason 可被 Workspace 展示。
- [ ] self-review retry 耗尽时返回 failed completion，failure reason 可被 Workspace 展示。
- [ ] Agent authoring / self-review 日志写入仍在模块内部完成，日志失败不应中断生成。
- [ ] mock 单测覆盖 render 失败后修复成功、self-review 失败后修复成功、retry 耗尽失败。

## Blocked by

- .scratch/deck-generation-flow/issues/01-confirmed-outline-success-path.md
- .scratch/deck-generation-flow/issues/02-progress-contract-and-ui.md
- .scratch/deck-generation-flow/issues/03-structured-completion.md

