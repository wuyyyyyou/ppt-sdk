Status: ready-for-agent

# 串行化 Page Progress 写入，保障并发状态不丢失

## Parent

[PRD: 并发 Page Generation 与会话历史](../PRD.md)

## What to build

为 engine app-facing tool 层的 Page Progress 更新增加同 workspace 串行保护。多个 Page Generation Unit 可以并发运行，但它们写入同一个 workspace 的 page-progress artifact 时必须按顺序执行，避免读旧快照后整文件写回导致其他页面状态丢失。

这个切片只交付 page-progress 写入安全性，不改变 Deck Generation 调度方式，不改变前端 UI。

严禁：

- 严禁实现全 workspace、跨进程或多客户端文件锁。
- 严禁把锁放到 React 前端层。
- 严禁改变 page-progress artifact 的外部结构。
- 严禁顺手修改 page-plan、pages、outline、template 等其他 artifact 的写入语义。
- 严禁改变现有 Page Generation 状态名或 retry 次数。

## Acceptance criteria

- [ ] 同一个 workspace 内多个 page-progress 更新并发发起时，所有页面的更新都能保留，不发生后写覆盖先写的丢更新。
- [ ] 不同 workspace 的 page-progress 更新不需要互相等待。
- [ ] page-progress 更新失败时，后续同 workspace 更新不会永久卡住。
- [ ] 现有 page-progress 返回值语义保持不变：调用方仍拿到更新后的完整 Page Progress。
- [ ] 新增测试覆盖同 workspace 并发更新不同页面，断言最终 artifact 同时包含所有更新。
- [ ] 新增测试不依赖私有锁实现细节，只断言外部持久化行为。
- [ ] 现有 app-workspace 相关测试继续通过。

## Blocked by

None - can start immediately
