# Issue 02: 集中 Page Plan 到 Page Progress 的同步规则

Status: ready-for-agent
Type: AFK

## Parent

- Task State Semantics PRD
- Issue 02 - 深化 Task State Machine Transition Module

## User stories covered

PRD user stories: 25, 27, 28, 35, 36

## What to build

把 Page Plan 到 Page Progress 的派生和同步收敛到 Task State Semantics。Page Plan 是页面列表源，Page Progress 是每页状态表；任何记录 Outline、更新 Page Plan、开始 Page iteration 的路径，都应复用同一套同步规则来补齐缺失 Page、保留已有状态、稳定排序并保留渲染路径。

完成后，维护者不需要在多个 Implementation 中分别维护 Page Progress 派生逻辑；Agent 也不会遇到 Page Plan 有页但 Page Progress 缺页的状态漂移。

## Acceptance criteria

- [ ] 记录 Outline 后生成的 Page Progress 使用统一同步规则。
- [ ] 更新 Page Plan 后，已有 Page Progress 的 page state、locked、summary、review notes、rendered paths 能按规则保留，新页面能自动补齐。
- [ ] 开始 Page iteration 时，如果 Page Progress 缺失或不完整，会通过统一规则补齐，而不是复制局部派生逻辑。
- [ ] 同步规则有纯单元测试，覆盖缺失 Page Progress、Page Plan 新增页、已有进度保留、页序排序和渲染路径保留。
- [ ] 已有 Workspace 文件 schema 保持兼容，不要求批量迁移历史 Workspace。

## Blocked by

- Issue 01 - 通过 Task State Semantics 派生查询状态

## Comments

这个 slice 让 Page Progress 的 Locality 先稳定下来，为后续 `record_page_progress` 命令语义迁移提供基础。
