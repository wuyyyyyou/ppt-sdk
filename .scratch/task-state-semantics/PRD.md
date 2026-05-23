# PRD: Task State Semantics Module

Status: ready-for-agent
Parent: Issue 02 - 深化 Task State Machine Transition Module

## Problem Statement

Task State Machine 现在已经承载了 Workspace 里的核心 PPT 生成流程：收集 Requirements、选择 Template、生成 Outline、派生 Page Plan、逐页 authoring、render、review、lock，再继续生成 Deck HTML、PPT model 和 PPTX。这个流程对 Anna Agent 很关键，因为 Agent 会通过当前状态、allowed transitions、recommended action 和 promote 文档决定下一步行动。

当前问题是这些状态语义分散在多个 Implementation 中：Page state 的 allowed transitions、Page Progress 派生、legacy state normalize、blocked reasons、recommended action、required inputs、expected artifacts、recovery 修复逻辑和 promote 指引各自维护一部分规则。用户看到的是 Agent 偶尔需要依赖隐含约定继续工作；维护者看到的是同一条状态规则需要在多个地方同步修改，容易出现漂移。

这个 PRD 专门解决 Issue 02：把 Task State Machine 的状态语义收敛到一个更 Deep 的 Module，让查询、写入、recovery、promote 都共享同一套权威规则。

## Solution

引入一个 Task State Semantics Module，作为 Task State Machine 的权威语义层。它不替代现有 storage，也不改变外部工具调用方式，而是在现有工具入口和 Workspace 文件记录之间建立一个稳定 Seam。

从用户视角看，现有工具仍然可用：`query_task_state` 继续返回 compact/full 结果并生成 promote 文档，`record_page_progress` 继续推进页面状态，`advance_task_state` 继续存在。不同的是，查询结果、状态写入、promote 指引和 recovery 修复都会来自同一套状态语义，因此 Agent 更稳定，维护者更容易验证状态机行为。

设计上采用以下已确认约束：

- `advance_task_state` 保留为 escape hatch，但不作为正常主线状态推进路径。
- `query_task_state` 保持兼容，继续生成 promote 文档；promote 生成改为消费 Recommendation 结果，而不是自己重新推导状态。
- Page Progress 始终从 Page Plan 派生并自动补齐；Page Plan 是页面列表源，Page Progress 是每页状态表。
- `page_rendered` 和 `page_review_pending` 作为 legacy 输入继续接受，但在命令 Seam 立即 normalize 成 `page_review`。
- Promote 文档里的 recommended action、allowed operations、required inputs 至少共享同一套状态语义；长文案可以保留，但必须通过测试避免和状态语义冲突。

## User Stories

1. 作为 Anna Agent，我想查询 Workspace 当前状态时得到稳定的 recommended action，以便不用猜下一步应该调用哪个工具。
2. 作为 Anna Agent，我想在 `page_rendered` 或 `page_review_pending` 旧输入被接受时自动进入 `page_review`，以便旧调用不会中断当前任务。
3. 作为 Anna Agent，我想在 Page authoring 完成后记录 `page_authoring`，以便下一次查询明确告诉我要渲染当前页。
4. 作为 Anna Agent，我想在当前页 PNG 已生成后记录 `page_review`，以便下一次查询明确告诉我要做截图审查。
5. 作为 Anna Agent，我想在截图审查失败后记录 `page_fix_required`，以便下一次查询明确告诉我要修复当前页。
6. 作为 Anna Agent，我想在截图审查通过后记录 `page_accepted`，以便下一次查询明确告诉我要锁定当前页。
7. 作为 Anna Agent，我想在页面锁定后记录 `page_locked`，以便下一次查询明确告诉我要切换下一页或进入整套 Deck 阶段。
8. 作为 Anna Agent，我想在全部 Page 都 locked 后自动进入 `deck_html_ready`，以便无需额外猜测整套 Deck 是否可以生成。
9. 作为 Anna Agent，我想在没有当前页但已经有 Page Plan 时得到开始第一页的 recommended action，以便任务可以从 Outline 后自然进入 Page authoring。
10. 作为 Anna Agent，我想在当前页 locked 且仍有未锁定 Page 时得到下一页建议，以便逐页 authoring 能连续推进。
11. 作为 Anna Agent，我想在当前页 locked 且所有 Page 都已 locked 时得到 Deck HTML 阶段建议，以便继续生成整套 Deck。
12. 作为 Anna Agent，我想在 `query_task_state` compact 模式下只拿到必要状态和 promote 路径，以便上下文更轻。
13. 作为 Anna Agent，我想在 `query_task_state` full 模式下拿到完整 snapshot、recommendation 和可用 Template 选项，以便调试或展示完整上下文。
14. 作为 Anna Agent，我想在 `requirements_collected` 时得到选择 Template 的 recommended action，以便先让用户确认 Template。
15. 作为 Anna Agent，我想在 `project_forked` 时得到写 Outline 的 recommended action，以便先建立叙事结构再写页面。
16. 作为 Anna Agent，我想在 `outline_ready` 时得到开始 Page authoring 的 recommended action，以便从 Outline 进入逐页实现。
17. 作为 Anna Agent，我想在 `deck_html_ready` 时得到生成整套 Deck HTML 的 recommended action，以便进入用户审阅阶段。
18. 作为 Anna Agent，我想在 `deck_review_pending` 时得到请求用户确认的 recommended action，以便不跳过人工审阅。
19. 作为 Anna Agent，我想在用户反馈某些 Page 需要修改后，让这些 Page 回到 `page_fix_required`，以便重新走修复、渲染、审查和锁定流程。
20. 作为 Anna Agent，我想在 `deck_reviewed` 时得到转换 PPT model 的 recommended action，以便继续导出流程。
21. 作为 Anna Agent，我想在 `model_ready` 时得到生成 PPTX 的 recommended action，以便完成最终产物。
22. 作为 Anna Agent，我想在 `pptx_ready` 时得到 complete task 的 recommended action，以便归档任务。
23. 作为 Anna Agent，我想在 `failed` 或不可恢复状态时得到 recovery 的 recommended action，以便先恢复 Workspace 再继续。
24. 作为用户，我想 Agent 在 Workspace 各阶段给出的下一步建议保持一致，以便任务不会因为状态漂移卡住。
25. 作为用户，我想 Page Plan 的每一页都能在 Page Progress 中出现，以便生成进度不会漏页。
26. 作为用户，我想已锁定 Page 不会被普通主线无意修改，以便已通过审查的页面保持稳定。
27. 作为维护者，我想 Page state transition 只有一处权威实现，以便修改状态流转时不用跨多个 Implementation 搜索同步点。
28. 作为维护者，我想 Page Progress 派生只有一处权威实现，以便新增 Page Plan 字段或恢复缺失记录时不会产生不同结果。
29. 作为维护者，我想 recommended action、required inputs 和 expected artifacts 可以独立测试，以便不用启动完整 RPC 才能验证状态语义。
30. 作为维护者，我想 `query_task_state` 的 promote 生成副作用保持兼容，以便现有 Agent 流程不需要迁移。
31. 作为维护者，我想 `advance_task_state` 被明确定位为 escape hatch，以便正常主线不会绕过状态语义。
32. 作为维护者，我想 recovery 使用同一套状态语义重建 allowed transitions 和 blocked reasons，以便修复后的 Workspace 能继续被 Agent 正确理解。
33. 作为维护者，我想 compact/full 查询结果都由同一套 effective state 派生，以便两种响应模式不会互相矛盾。
34. 作为维护者，我想 promote 文档中的状态指引与 recommended action 保持一致，以便 Agent 读文档和读机器结果时不会收到冲突信号。
35. 作为维护者，我想新增状态或调整状态名时有集中测试失败提示，以便能快速定位需要更新的语义规则。
36. 作为 AFK agent，我想 issue 中有清晰的验收标准和测试范围，以便可以独立完成实现并验证回归。

## Implementation Decisions

- 建立 Task State Semantics Module，作为 Task State Machine 状态语义的 Deep Module。它负责 effective state、allowed operations、blocked reasons、allPagesLocked、currentPageId、legacy state normalize、recommended action、required inputs、expected artifacts 的权威派生。
- 现有工具入口保留为 Adapter。它们继续负责参数读取、兼容旧调用、调用 storage、返回现有响应形状，但不再各自维护状态语义。
- Storage 继续是文件记录 Adapter。Task、State、Current Page、Page Plan、Page Progress、Artifacts 和 Events 的读写职责不迁移到语义 Module 内部。
- Page Plan 是页面列表源。Page Progress 是每页状态表。每次记录 Outline、更新 Page Plan、开始 Page iteration、记录 Page progress、recovery 修复时，都应通过同一套同步规则补齐和排序 Page Progress。
- Legacy Page state 输入 `page_rendered` 和 `page_review_pending` 必须继续接受，以保持历史调用兼容；语义 Module 在命令 Seam 将它们 normalize 成 `page_review`。
- Page state 的主线流转保持：`page_selected -> page_authoring -> page_review -> page_fix_required / page_accepted -> page_locked`。
- 当所有 Page Plan 中的 Page 都在 Page Progress 中 locked，且当前 Page 推进到 `page_locked` 后，Deck state 自动派生为 `deck_html_ready`。
- `query_task_state` 保持当前 compact/full 行为，且继续 materialize promote 文档。改变的是它先通过 Recommendation 语义得到推荐动作、必要输入、预期产物和允许操作，再交给 Promote Adapter 生成文档。
- Promote 长文案可以分阶段保留，但 recommended action、allowed operations、required inputs、expected artifacts 必须来自同一套 Recommendation 语义。
- `advance_task_state` 保留为 escape hatch，用于恢复、人工推进或特殊情况。它不应成为普通 Requirements、Template、Outline、Page、Deck 生成主线的推荐路径。
- Recovery 必须复用语义 Module 来重建 effective state、allowed operations、blocked reasons 和 Page Progress，避免恢复后状态与查询结果冲突。
- 不做破坏性 schema 迁移。现有 Workspace 文件应继续可读；必要时只做兼容性补齐和 normalize。
- 外部工具名称、主要参数和响应意图保持兼容。PRD 目标是深化 Module 和集中规则，不是重新设计工具协议。
- 如果在实现中确认 “Task State Semantics” 成为长期项目术语，应把该术语补充到项目 glossary 中，说明它是 Task State Machine 的权威状态语义 Module。

## Testing Decisions

- 好测试只验证外部行为，不锁死 Implementation 细节。测试应关注给定 Workspace snapshot 或命令后，得到的 effective state、allowed operations、recommended action、required inputs、expected artifacts、records-to-write 和 events 是否正确。
- 为 Task State Semantics Module 写纯单元测试，不依赖真实文件系统。测试输入应是内存中的 Task、State、Current Page、Page Plan、Page Progress、Artifacts 记录。
- 为 Page Progress 同步写单元测试，覆盖缺失 Page Progress、Page Plan 增删页、已有进度保留、页序排序、locked 状态保留、current page 渲染路径保留。
- 为 legacy state normalize 写单元测试，覆盖 `page_rendered` 和 `page_review_pending` 输入归一到 `page_review`。
- 为主要 Deck state 写推荐动作测试，至少覆盖 project ready、requirements collected、project forked、outline ready、page iteration active、deck html ready、deck review pending、deck reviewed、model ready、pptx ready、completed 和 failed。
- 为主要 Page state 写推荐动作测试，至少覆盖 page selected、page authoring、page review、page fix required、page accepted、page locked。
- 为 allPagesLocked 派生写测试，覆盖无 Page Plan、有 Page Plan 但未锁定、部分锁定、全部锁定。
- 为 `query_task_state` 写集成级回归测试，确认 compact/full 两种响应使用同一套 effective state，并且 promote 路径仍然返回。
- 为 `record_page_progress` 写集成级回归测试，确认状态写入、Current Page、Page Progress、State、Event 之间保持一致。
- 为 recovery 写集成级回归测试，确认缺失 Page Progress 或缺失 Current Page 时，修复结果的 allowed operations 和 blocked reasons 与语义 Module 一致。
- 先参考现有 validate 和 local-template 测试风格：优先小输入、小断言、行为明确；新增 Task State Machine 测试时沿用项目现有单测命令。

## Out of Scope

- 不重写 Anna Agent 的 Deck Generation Flow。
- 不重写前端 Workspace 页面状态管理。
- 不改变 Template 发现、fork 或渲染链路。
- 不改变 PPT model 转换和 PPTX 生成链路。
- 不重新设计所有 JSON-RPC 工具名称和参数。
- 不移除 `advance_task_state`。
- 不强制重写所有 promote 长文案；本 PRD 只要求 promote 的行动语义与 Recommendation 结果一致。
- 不做历史 Workspace 的批量迁移；只要求新逻辑能兼容读取和补齐。

## Further Notes

- 这个 PRD 专门覆盖 Issue 02，不覆盖 Deck Generation Flow Module 和 Manifest Deck Render Plan Module。
- 当前优先级最高的 tracer bullet 是：先建立 Task State Semantics 的纯派生能力，并让 query 和 page progress 写入共享它。这样可以最早发现状态语义是否足够深。
- 实现完成后，Issue 02 的验收标准应能通过自动化测试证明，而不是只靠人工阅读状态文件。
