# Issue 05: 让 Recovery 和 Escape Hatch 服从 Task State Semantics

Status: ready-for-agent
Type: AFK

## Parent

- Task State Semantics PRD
- Issue 02 - 深化 Task State Machine Transition Module

## User stories covered

PRD user stories: 23, 31, 32, 35, 36

## What to build

让 recovery 相关路径使用 Task State Semantics 重建 effective state、allowed operations、blocked reasons 和 Page Progress。`advance_task_state` 继续保留为 escape hatch，但它的行为需要清晰：用于恢复、人工推进或特殊情况，不作为普通 Requirements、Template、Outline、Page、Deck 主线的推荐路径。

完成后，恢复缺失或不完整的 Workspace 状态时，修复结果应能被 `query_task_state` 正确理解；escape hatch 不应悄悄制造与语义 Module 冲突的 allowed operations 或 blocked reasons。

## Acceptance criteria

- [ ] 缺失 Page Progress 时，recovery 通过统一 Page Progress 同步规则重建每页进度。
- [ ] 缺失 Current Page 且 Deck state 处于 Page iteration active 时，recovery 使用统一语义给出安全的 fallback state、blocked reasons 和 allowed operations。
- [ ] Recovery 后立即查询 Workspace，得到的 effective state、allowed operations、blocked reasons 与 Task State Semantics 一致。
- [ ] `advance_task_state` 保留为 escape hatch，并有测试证明它不会成为普通推荐动作主线。
- [ ] recovery 和 escape hatch 场景有集成级回归测试。

## Blocked by

- Issue 01 - 通过 Task State Semantics 派生查询状态
- Issue 02 - 集中 Page Plan 到 Page Progress 的同步规则
- Issue 03 - 让 Page Progress 写入命令通过 Task State Semantics

## Comments

这个 slice 处理异常路径和人工干预路径，避免主线语义集中后，恢复逻辑仍然维护另一套状态规则。
