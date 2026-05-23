# Issue 03: 让 Page Progress 写入命令通过 Task State Semantics

Status: ready-for-agent
Type: AFK

## Parent

- Task State Semantics PRD
- Issue 02 - 深化 Task State Machine Transition Module

## User stories covered

PRD user stories: 2, 3, 4, 5, 6, 7, 8, 19, 26, 27, 31, 35, 36

## What to build

将 Page Progress 写入路径迁移到 Task State Semantics。`record_page_progress` 和 deck review feedback 相关路径应通过同一套命令语义来 normalize legacy Page state、更新 Current Page、更新 Page Progress、更新 Deck state、计算 blocked reasons、计算 allowed operations，并生成一致的事件意图。

完成后，`page_rendered` 和 `page_review_pending` 仍可作为兼容输入，但会在命令 Seam 归一为 `page_review`。当全部 Page locked 后，Deck state 应自动进入 `deck_html_ready`。普通主线不应绕过 Page state 的权威流转规则。

## Acceptance criteria

- [ ] `record_page_progress` 接受 `page_rendered` 和 `page_review_pending`，并将内部 Page state 归一为 `page_review`。
- [ ] `page_selected -> page_authoring -> page_review -> page_fix_required / page_accepted -> page_locked` 主线流转由同一套语义规则驱动。
- [ ] 记录 `page_locked` 时，如果 Page Plan 中所有 Page 都已 locked，Deck state 自动进入 `deck_html_ready`。
- [ ] deck review feedback 能把目标 Page 标回 `page_fix_required`、解除 locked，并让当前页指向第一张待修 Page。
- [ ] Current Page、Page Progress、State 和事件记录在成功写入后保持一致，并有集成级回归测试覆盖。

## Blocked by

- Issue 01 - 通过 Task State Semantics 派生查询状态
- Issue 02 - 集中 Page Plan 到 Page Progress 的同步规则

## Comments

这个 slice 是写入侧的主干。完成后，查询侧和 Page 写入侧会共享同一套状态语义。
