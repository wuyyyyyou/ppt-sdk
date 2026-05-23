# Issue 06: 用完整 Task Workflow 回归证明 Task State Semantics

Status: ready-for-agent
Type: AFK

## Parent

- Task State Semantics PRD
- Issue 02 - 深化 Task State Machine Transition Module

## User stories covered

PRD user stories: 24, 30, 33, 34, 35, 36

## What to build

补齐一个完整 Task Workflow 的回归验证，证明 Task State Semantics 已贯穿查询、写入、Recommendation、Promote、Recovery 和 escape hatch。这个 slice 还要把 “Task State Semantics” 作为长期项目术语记录到 glossary 中，说明它是 Task State Machine 的权威状态语义 Module。

完成后，AFK agent 可以通过自动化回归确认：从 Requirements 到 Template、Outline、Page authoring、Page review、Page lock、Deck HTML、Deck review、Model、PPTX 的关键状态推进中，compact/full 查询、promote 引用和状态写入始终一致。

## Acceptance criteria

- [ ] 有端到端回归覆盖一个代表性 Task Workflow，从创建 Workspace 状态开始，推进到至少 `deck_html_ready`，并验证每一步 `query_task_state` 的 recommended action 和 promote 路径。
- [ ] compact 和 full 查询在关键阶段使用同一套 effective state，不出现互相矛盾的 allowed operations 或 page state。
- [ ] Workflow 回归覆盖至少一次 legacy Page state 输入 normalize、一次 Page lock 后进入下一页或 Deck 阶段、一次 promote 生成。
- [ ] 项目 glossary 中补充 Task State Semantics 术语，说明它与 Workspace、Page Plan、Page Progress、Deck Generation、Promote 的关系。
- [ ] Issue 02 的验收标准可以通过自动化测试结果证明，而不依赖人工阅读状态文件。

## Blocked by

- Issue 01 - 通过 Task State Semantics 派生查询状态
- Issue 02 - 集中 Page Plan 到 Page Progress 的同步规则
- Issue 03 - 让 Page Progress 写入命令通过 Task State Semantics
- Issue 04 - 对齐 Recommendation 和 Promote 的状态语义
- Issue 05 - 让 Recovery 和 Escape Hatch 服从 Task State Semantics

## Comments

这是收口 slice。它不应该引入新的核心状态规则；如果需要新增规则，应回到前置 issue 中实现。
