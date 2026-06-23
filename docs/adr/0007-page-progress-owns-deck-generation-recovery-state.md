# page-progress 拥有 Deck Generation 恢复状态

Deck Generation 的恢复判断需要同时覆盖单页前的规划/准备、未完成 Page Generation Unit、Page Refinement Resume，以及所有页面 accepted 后的 Final Deck Render。决定由 `page-progress.json` 的顶层 deck-level 状态拥有这些恢复元数据，而不是新增独立恢复文件或把失败/中断状态写入 `pages.json`；这样恢复入口只需要围绕一个进度 artifact 做 gate 判断，`pages.json` 继续只代表 Final Deck Render 成功后的 Deck 产物。

**考虑过的方案**

- 新增 `deck-generation.json` 或 `deck-render.json`。拒绝，因为恢复判断会被拆到多个 artifact，容易和 page progress 不一致。
- 把 Final Deck Render 状态放入 `pages.json`。拒绝，因为 `pages.json` 应继续表示成功渲染后的 Deck 产物，不适合承载失败、中断或运行中状态。
- 让 `page-progress.json` 顶层拥有 Deck Generation 恢复状态。选择这个方案，因为它已经是继续生成和单页状态恢复的核心 artifact，扩展顶层 deck-level 状态能让 accepted 页面、未完成页面和 final render 处于同一个恢复判断边界内。
