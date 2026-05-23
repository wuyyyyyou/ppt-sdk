# Issue 04: 对齐 Recommendation 和 Promote 的状态语义

Status: ready-for-agent
Type: AFK

## Parent

- Task State Semantics PRD
- Issue 02 - 深化 Task State Machine Transition Module

## User stories covered

PRD user stories: 1, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 29, 30, 34, 35, 36

## What to build

将 recommended action、required inputs、expected artifacts 和 allowed operations 的派生收敛到 Task State Semantics，并让 promote 生成消费同一份 Recommendation 结果。`query_task_state` 仍然保持 compact/full 兼容，并继续 materialize promote 文档；改变的是 promote 不再重新推导行动语义。

完成后，Agent 从机器可读 recommendation 和 promote 文档中看到的下一步行动必须一致。长文案可以继续保留，但其行动类型、必要输入、预期产物和允许操作不能与 Task State Semantics 冲突。

## Acceptance criteria

- [ ] recommended action、required inputs、expected artifacts 和 allowed operations 来自同一套 Task State Semantics 规则。
- [ ] `query_task_state` compact 和 full 模式仍返回兼容结果，并且 promote 路径仍会生成。
- [ ] requirements collected、project forked、outline ready、page iteration active、deck html ready、deck review pending、deck reviewed、model ready、pptx ready、completed、failed 等主要 Deck state 都有推荐动作测试。
- [ ] page selected、page authoring、page review、page fix required、page accepted、page locked 等主要 Page state 都有推荐动作测试。
- [ ] Promote 文档中的行动类型、必要输入、预期产物和 allowed operations 与 Recommendation 结果一致。

## Blocked by

- Issue 01 - 通过 Task State Semantics 派生查询状态
- Issue 03 - 让 Page Progress 写入命令通过 Task State Semantics

## Comments

这个 slice 保持 `query_task_state` 生成 promote 的现有副作用，但把状态行动语义集中到同一处。
