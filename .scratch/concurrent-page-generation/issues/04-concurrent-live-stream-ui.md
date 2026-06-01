Status: ready-for-agent

# 重做 Generating 页面并展示并发 Live Page Streams

## Parent

[PRD: 并发 Page Generation 与会话历史](../PRD.md)

## What to build

更新 Generating 页面，让它展示聚合 Deck Generation Progress 和多个 Active Page Generation 的 Live Page Stream。主进度文案表达整体数量和状态，不再主要展示“Agent 正在编辑第 N 页”这种单 current page 文案。

将“当前会话流”改为“会话历史”或等价中文文案。Generation Session History 默认收起，用户点击后展开查看已结束 agent run。

失败状态需要清晰：主区域展示聚合失败信息，例如几页失败；每个失败页展示自己的错误信息。这个切片只展示失败信息，不实现“重跑本页”闭环。

严禁：

- 严禁隐藏 Active Page Generation 的 Live Page Stream 到默认收起历史里。
- 严禁展示 pending 页的空 live stream。
- 严禁用单一 currentPageIndex 作为主 UI 的唯一状态来源。
- 严禁在本切片实现 Page Generation Retry 行为。
- 严禁改变 Outline、Template、Export 页面行为。
- 严禁让长 stream 撑破布局；每个 stream 必须有内部滚动或等价限制。

## Acceptance criteria

- [ ] 主进度展示聚合 Deck Generation Progress，不再误导为只有一个 current page 在运行。
- [ ] 所有 Active Page Generation 的 Live Page Stream 默认展开显示。
- [ ] 每个 Live Page Stream 的内容区域有高度限制和滚动能力。
- [ ] pending 页面只显示等待/排队状态，不显示空 stream 面板。
- [ ] accepted、active、failed、cancelled 等页面状态在页面列表中可区分。
- [ ] 多个失败页时，主信息显示聚合失败数量或聚合失败文案。
- [ ] 每个失败页显示自己的 last_error 或等价错误摘要。
- [ ] Generation Session History 默认收起，点击后展开。
- [ ] Generation Session History 展示已结束 run 快照，不展示当前 active stream。
- [ ] 中英文文案同步更新。
- [ ] UI 测试或等价验证覆盖 active streams、collapsed history、multiple failed pages。

## Blocked by

- [03-multi-active-stream-progress-model.md](./03-multi-active-stream-progress-model.md)
