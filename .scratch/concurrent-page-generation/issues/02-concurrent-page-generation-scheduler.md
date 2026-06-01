Status: ready-for-agent

# 引入并发 Page Generation 调度器

## Parent

[PRD: 并发 Page Generation 与会话历史](../PRD.md)

## What to build

将 Deck Generation 的页面间执行从串行改为固定最多 5 个 Page Generation Unit 并发。调度必须按 Page Plan 顺序启动页面：先启动最多 5 个，任一页面到达终态后再补下一个未开始页面。

每个 Page Generation Unit 内部的 authoring、render、self-review、自动修复循环保持原语义。普通 Failed Page Generation 不 fail-fast，其他页面继续生成；Agent infrastructure error 停止继续调度新页面；最终 whole-Deck render 只有在全部页面 accepted 后才能执行。

严禁：

- 严禁修改单页内部自动 retry 预算。
- 严禁把一次 render 或 self-review 失败直接变成需要用户手动重跑。
- 严禁新增用户可配置的并发上限；并发上限固定为 5。
- 严禁让 page agent 修改共享 deck 结构或 template-wide 资产。
- 严禁在有未 accepted 页面时执行最终 whole-Deck render。
- 严禁新增 `partial_failed` 之类顶层完成状态；多个失败页通过 page-level progress 表达。
- 严禁让同一个 Page Generation Unit 同时存在两个 active run。

## Acceptance criteria

- [ ] Deck Generation 最多同时运行 5 个 Page Generation Unit。
- [ ] 页面按 Page Plan 顺序调度，完成一个 active page 后补下一个 pending page。
- [ ] 每页内部 render/self-review/agent failure 自动恢复策略保持不变。
- [ ] 普通页面失败达到终态后，其他 active 或 pending 页面仍继续生成。
- [ ] Agent infrastructure error 后不再启动新页面，整体返回 failed，并保留已产生的 page progress。
- [ ] 用户取消后不再启动新页面；已进入当前步骤的页面按 cooperative cancellation 语义收尾。
- [ ] 只有全部页面 accepted 时才调用最终 whole-Deck render。
- [ ] 有任意页面 failed/cancelled/pending/running 时，不进入 Review 完成路径。
- [ ] 测试覆盖 ordered concurrency、普通失败继续、基础设施错误停调度、取消、final render gate。

## Blocked by

- [01-serialize-page-progress-writes.md](./01-serialize-page-progress-writes.md)
