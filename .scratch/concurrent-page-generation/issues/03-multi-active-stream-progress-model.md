Status: ready-for-agent

# 支持多 Active Page Generation 的进度模型和历史快照

## Parent

[PRD: 并发 Page Generation 与会话历史](../PRD.md)

## What to build

扩展 Deck Generation Progress，使它可以表达多个 Active Page Generation 的 Live Page Stream。UI 后续应能从进度模型中拿到所有正在运行页的 stream，而不是只能读取一个 current stream。

Generation Session History 保持前端内存态，记录已结束 agent run 的快照。当前 active stream 不应被当作默认收起的历史内容。

严禁：

- 严禁实现 workspace log replay。
- 严禁改变 workspace log 写入格式作为本切片目标。
- 严禁把 pending 页伪造成 live stream。
- 严禁清空 failed page retry 前的历史；只有 full restart 才清空 history。
- 严禁让 UI 继续依赖单一 current page 才能表达正在生成状态。

## Acceptance criteria

- [ ] Deck Generation Progress 能同时携带多个 active page streams。
- [ ] 多个 active streams 按 page index 可稳定排序或可由 UI 稳定排序。
- [ ] 为迁移保留最近更新 stream 兼容字段时，不影响多 stream 的真实来源。
- [ ] 已完成 agent run 能生成 Generation Session History 快照。
- [ ] Active Page Generation 的 Live Page Stream 不进入默认收起的历史区域。
- [ ] Full restart 清空 history；Page Generation Retry 追加 history，不清空旧记录。
- [ ] 测试覆盖多个 active streams 同时存在、stream 更新、run 完成后生成历史快照。

## Blocked by

- [02-concurrent-page-generation-scheduler.md](./02-concurrent-page-generation-scheduler.md)
