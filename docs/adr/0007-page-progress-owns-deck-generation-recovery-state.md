# page-progress 拥有 Deck Generation 恢复状态

> ADR-0041 取代了本文关于“用户取消会把活动页面转为可恢复 `interrupted` 状态”的决定。进程异常退出仍使用 `interrupted` 恢复语义，但用户主动“停止并放弃”会废弃整个影子运行；Page Progress 继续拥有未放弃运行内部的恢复状态。

Deck Generation 的恢复判断需要同时覆盖单页前的规划/准备、未完成 Page Generation Unit、Page Refinement Resume，以及所有页面 accepted 后的 Final Deck Render。决定由 `page-progress.json` 的顶层 deck-level 状态拥有这些恢复元数据，而不是新增独立恢复文件；这样恢复入口只需要围绕一个进度 artifact 做 gate 判断。

新的 Authoring Kit 主路径同样用顶层 recovery 记录 `authoring-kit`、`style-guide`、`prepare-page-sources`、`page-authoring` 和 `final-render` 等步骤。`style-guide.md` 的存在且非空才是艺术指导就绪事实；recovery 只记录运行位置和错误摘要，详细 LLM 尝试属于独立的 `style-guide` AI Interaction Log，不新增艺术指导状态文件。

Persisted page entries own runtime state only. They are keyed by `page_id` and no longer copy Outline-owned `index` or `title`, deterministic Page Source paths, removed data-file paths, or deleted Content Review state. App-facing progress views join the current Confirmed Outline by `page_id` to project page order and display titles.

Recovery gates use Page Progress to determine whether required deck-level artifacts may be safely recreated. In particular, a missing Workspace Style Guide is recreatable only while every page remains in its initial pending state; after Page Authoring has advanced, the same missing artifact is an unresumable consistency failure rather than a normal Resume step.

The same ownership rule applies per page: Resume may recreate a missing Page Source from the Bootstrap only while that page is still in its initial pending state. If the page has ever advanced into authoring, rendering, review, accepted, or a failure state, a missing Page Source is unresumable because its authoritative page content has been lost. A missing or stale Deck Manifest remains safely rebuildable whenever the Confirmed Outline and required Page Sources exist.

The migrated page status set is limited to `pending`, `authoring`, `rendering`, `render_fixing`, `visual_review`, `visual_review_fixing`, `accepted`, `interrupted`, `agent_failed`, `agent_infrastructure_failed`, and `render_failed`. Visual states appear only when the user enables Page Visual Review; exhausted visual-fix attempts still end in `accepted` with diagnostics preserved. Content Review and `needs_user_review` states are removed, and deck cancellation reconciles an active page to `interrupted` rather than adding a page-level cancelled state.

The user-visible generation sequence is reduced to preparing the Authoring Kit, creating the Workspace Style Guide, preparing Page Sources, generating pages with render and optional visual-review substeps, Final Deck Render, and completion. Page Plan, Theme Token, Research, and Content Review steps are absent. Style Guide Creation shows step-level status rather than streaming its Markdown; Live Page Streams remain page-authoring UI, and Resume follows the persisted top-level recovery step.

ADR-0024 后续删除了 `pages.json`，并让 Page Progress 同时保存 Final Deck Render 成功后的 HTML 与截图引用；本 ADR 关于 Page Progress 拥有恢复状态的决定保持有效。

**考虑过的方案**

- 新增 `deck-generation.json` 或 `deck-render.json`。拒绝，因为恢复判断会被拆到多个 artifact，容易和 page progress 不一致。
- 把 Final Deck Render 状态放入独立的成功产物索引。最初拒绝把失败状态放入旧 `pages.json`；ADR-0024 在统一 Page Source 主路径中进一步删除该索引，由 Page Progress 同时保存状态和成功渲染引用。
- 让 `page-progress.json` 顶层拥有 Deck Generation 恢复状态。选择这个方案，因为它已经是继续生成和单页状态恢复的核心 artifact，扩展顶层 deck-level 状态能让 accepted 页面、未完成页面和 final render 处于同一个恢复判断边界内。
