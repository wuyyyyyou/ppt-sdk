Status: ready-for-agent

# 端到端验证并发生成、失败恢复和取消体验

## Parent

[PRD: 并发 Page Generation 与会话历史](../PRD.md)

## What to build

为并发 Page Generation 的完整体验补充组合回归验证，覆盖 engine artifact 安全、并发调度、多 active streams、Generating 页面展示、Failed Page Generation、Page Generation Retry、取消、基础设施错误和 final render gate。

这个切片主要补验证和修整集成缝隙，不应重新设计前面切片已完成的行为。

严禁：

- 严禁借此切片扩大功能范围。
- 严禁引入真实 Anna Agent、真实 LLM 或真实浏览器作为必需单测依赖。
- 严禁要求默认启动 dev server。
- 严禁改变已确认的并发上限、retry 预算或 final render gate。
- 严禁把历史回放、重置本页、多客户端锁等 Out of Scope 内容加入实现。

## Acceptance criteria

- [ ] 组合测试覆盖 5 并发上限和按 Page Plan 顺序补位。
- [ ] 组合测试覆盖普通 Failed Page Generation 不阻塞其他页面。
- [ ] 组合测试覆盖 Agent infrastructure error 停止新页面调度。
- [ ] 组合测试覆盖 Deck Generation Cancellation 不再启动新页面。
- [ ] 组合测试覆盖所有页面 accepted 前不会 final render。
- [ ] 组合测试覆盖全部 accepted 后 final render 并进入完成路径。
- [ ] 组合测试覆盖多个 active streams 在进度模型和 UI 中可见。
- [ ] 组合测试覆盖 Generation Session History 默认收起。
- [ ] 组合测试覆盖多个失败页的聚合错误和单页错误展示。
- [ ] 组合测试覆盖 Page Generation Retry 成功后自动 final render 的路径。
- [ ] 运行项目约定的相关 typecheck/build/test 命令，并在 issue 评论或 PR 说明中记录结果。

## Blocked by

- [01-serialize-page-progress-writes.md](./01-serialize-page-progress-writes.md)
- [02-concurrent-page-generation-scheduler.md](./02-concurrent-page-generation-scheduler.md)
- [03-multi-active-stream-progress-model.md](./03-multi-active-stream-progress-model.md)
- [04-concurrent-live-stream-ui.md](./04-concurrent-live-stream-ui.md)
- [05-page-generation-retry.md](./05-page-generation-retry.md)
