# Issue 01: 通过 Task State Semantics 派生查询状态

Status: ready-for-agent
Type: AFK

## Parent

- Task State Semantics PRD
- Issue 02 - 深化 Task State Machine Transition Module

## User stories covered

PRD user stories: 1, 9, 10, 11, 12, 13, 24, 27, 29, 33

## What to build

建立 Task State Semantics 的第一条可运行路径：查询 Workspace 当前状态时，不再由查询入口自行推导 Page state、allowed operations、blocked reasons、allPagesLocked 和 currentPageId，而是统一从 Task State Semantics 派生。

完成后，`query_task_state` 的 compact 和 full 两种模式仍保持兼容，但两者展示的 effective state 必须来自同一套语义。这个 slice 不要求一次性迁移所有写入命令，但要给后续 Page Progress、Recommendation、Promote 和 Recovery 迁移留下稳定 Seam。

## Acceptance criteria

- [ ] `query_task_state` compact 和 full 模式都通过 Task State Semantics 派生 effective state、allowed operations、blocked reasons、allPagesLocked 和 currentPageId。
- [ ] Page iteration active 下的 Page state allowed operations 只有一处权威规则，查询结果不再维护另一份 transition 表。
- [ ] 无当前页、有当前页、当前页 locked、全部 Page locked 等查询场景都有行为测试。
- [ ] compact 和 full 查询结果在相同 Workspace snapshot 下不会产生互相矛盾的 deck/page state。
- [ ] 外部工具名称、参数和响应意图保持兼容。

## Blocked by

None - can start immediately

## Comments

这是 Task State Semantics 的 tracer bullet。目标是先让一个真实 RPC 查询路径穿过新 Module，而不是只创建纯函数后悬空。
