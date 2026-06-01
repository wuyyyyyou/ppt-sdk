Status: ready-for-agent

# 增加 Page Generation Retry 单页重跑闭环

## Parent

[PRD: 并发 Page Generation 与会话历史](../PRD.md)

## What to build

为 eligible Failed Page Generation 增加“重跑本页”闭环。用户在 Generating 页面点击某个失败页的重跑按钮后，系统只重跑该页，不重新生成 Page Plan，不重新准备全部页面文件，不重跑 accepted 页面。

Page Generation Retry 开始时应清零该页本轮尝试计数和失败状态，保留该页当前 TSX/data 文件作为修复起点，并追加新的 Live Page Stream / Generation Session History。若重跑成功后所有页面 accepted，自动执行最终 whole-Deck render 并进入 Review；否则保持在 Generating 页面继续展示剩余失败页。

严禁：

- 严禁在 Active Deck Generation 仍在运行时允许手动 Page Generation Retry。
- 严禁重跑 accepted 页面。
- 严禁重新生成 Page Plan。
- 严禁重新 prepare 全部 page files。
- 严禁从 blueprint 重置该页文件。
- 严禁把 infrastructure failure 当作单页重跑入口。
- 严禁重跑时清空 Generation Session History。
- 严禁重跑单页成功但仍有失败页时进入 Review。

## Acceptance criteria

- [ ] eligible failed statuses 显示“重跑本页”或等价按钮。
- [ ] Agent infrastructure failure 不显示单页重跑按钮。
- [ ] Active Deck Generation 运行期间，失败页重跑按钮不可用或不显示。
- [ ] 点击重跑后只运行选中的 Page Generation Unit。
- [ ] 重跑开始时该页 render/self-review/agent failure 计数清零。
- [ ] 重跑保留该页当前文件作为修复起点。
- [ ] accepted 页面不被重跑，状态保持 accepted。
- [ ] 重跑过程在原 Generating 页面显示该页 Live Page Stream。
- [ ] 重跑完成后追加 Generation Session History，不清空旧历史。
- [ ] 如果所有页面 accepted，自动执行最终 whole-Deck render 并进入 Review。
- [ ] 如果仍有失败页，继续留在 Generating 页面展示剩余失败页重跑入口。
- [ ] 测试覆盖 eligible/ineligible retry、计数清零、accepted page skip、最终 render gate。

## Blocked by

- [02-concurrent-page-generation-scheduler.md](./02-concurrent-page-generation-scheduler.md)
- [04-concurrent-live-stream-ui.md](./04-concurrent-live-stream-ui.md)
