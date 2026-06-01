Status: ready-for-agent

# PRD: 并发 Page Generation 与会话历史

## Problem Statement

当前 Deck Generation 的“逐页生成”阶段按页面串行执行。每个 Page Generation Unit 都要依次完成 authoring、render、self-review 和自动修复循环，导致完整 Deck 生成耗时过长。用户在等待时只能看到一个当前页面的实时流，无法同时观察已经并发启动的多个 Active Page Generation。

当前 UI 的“当前会话流”也容易让用户误解：它既像实时流，又像历史记录。用户希望正在生成的页面都能展示 Live Page Stream，而历史 agent run 作为 Generation Session History 默认收起，点击后再查看。

## Solution

Deck Generation 在页面维度并发执行，固定最多同时运行 5 个 Page Generation Unit。系统按 Page Plan 顺序启动页面，前 5 页先启动；任一页面完成后，调度下一个未开始页面。每个页面内部的自动恢复策略保持不变，仍按现有 render、self-review 和 agent failure 重试预算自动修复，只有自动恢复耗尽或需要人工 review 后才成为 Failed Page Generation。

前端展示改为聚合 Deck Generation Progress：主状态展示整体数量与状态，不再绑定一个 current page。所有 Active Page Generation 默认展示 Live Page Stream；Generation Session History 默认收起，仅承载已结束 agent run 的历史快照。普通页面失败不 fail-fast，其他页面继续生成；最终只有所有 Page Generation Unit 都达到 accepted 后才执行整 Deck render 并进入 Review。

失败页展示“重跑本页”按钮。Page Generation Retry 只重跑被点击的失败页，复用当前 Confirmed Outline、Page Plan、Template 和该页已有文件，开始时清零该页本轮尝试计数并重新获得完整自动恢复预算。若该页重跑成功后所有页面都已 accepted，系统自动执行最终整 Deck render 并进入 Review。

## User Stories

1. As a deck author, I want multiple pages to generate at the same time, so that I spend less time waiting for a full Deck.
2. As a deck author, I want page generation concurrency to be bounded, so that the app remains stable while still becoming faster.
3. As a deck author, I want the app to keep page order in the progress view, so that I can understand the Deck structure while generation is running.
4. As a deck author, I want the main progress message to summarize the whole Deck Generation, so that I do not see a misleading single “current page” while several pages are active.
5. As a deck author, I want every Active Page Generation to show its Live Page Stream, so that I can see what each running agent is doing.
6. As a deck author, I want Live Page Streams to be expanded while active, so that I can monitor the currently running pages without extra clicks.
7. As a deck author, I want each Live Page Stream to have its own scrollable area, so that long streams do not push the whole page out of control.
8. As a deck author, I want completed agent runs to move into Generation Session History, so that I can inspect prior work without cluttering the active view.
9. As a deck author, I want Generation Session History to be collapsed by default, so that historical logs do not distract from the current generation state.
10. As a deck author, I want to expand Generation Session History when needed, so that I can diagnose a failed or suspicious page.
11. As a deck author, I want ordinary page failures not to stop unrelated pages, so that the app preserves useful work and continues making progress.
12. As a deck author, I want failed pages to be clearly marked, so that I know which pages need attention.
13. As a deck author, I want each Failed Page Generation to show its own error, so that I can understand what went wrong for that page.
14. As a deck author, I want the main error message to summarize how many pages failed, so that I do not mistake one page error for the whole failure picture.
15. As a deck author, I want a “重跑本页” action on eligible failed pages, so that I can recover a single page without regenerating the whole Deck.
16. As a deck author, I want Page Generation Retry to preserve the failed page's current files, so that useful partial fixes are not thrown away.
17. As a deck author, I want Page Generation Retry to reset the page's attempt counters, so that the retry has a fair chance to recover.
18. As a deck author, I want Page Generation Retry to stay on the Generating page, so that I can see that only this page is being repaired.
19. As a deck author, I want successful retries to automatically finish the Deck when all pages are accepted, so that I do not need to click another continuation button.
20. As a deck author, I want accepted pages to stay accepted during a failed page retry, so that already good work is not disturbed.
21. As a deck author, I want the app to avoid starting two runs for the same page, so that page preview files and page status do not overwrite each other.
22. As a deck author, I want the Stop action to stop new page generation from starting, so that I can cancel a long-running Deck Generation.
23. As a deck author, I want already-running page work to finish its current step before cancellation is reflected, so that cancellation does not leave page files in a half-written state.
24. As a deck author, I want cancellation to keep accepted and failed page results, so that useful progress is not discarded.
25. As a deck author, I want final Deck render to happen only after all pages are accepted, so that I never review a Deck containing failed or partial pages.
26. As a deck author, I want infrastructure errors to stop global scheduling, so that session or authorization problems do not cascade across many pages.
27. As a deck author, I want normal render or self-review failures to use the existing automatic recovery loop, so that a single failure does not immediately require manual action.
28. As a developer, I want page-progress writes to be serialized per workspace, so that concurrent page generation does not lose page status updates.
29. As a developer, I want a testable page-generation scheduler, so that concurrency, cancellation, failure, and retry behavior can be verified without relying on the full UI.
30. As a developer, I want the Anna Agent session model to stay run-scoped, so that concurrent pages do not share one long-lived session accidentally.
31. As a developer, I want the UI progress model to support multiple active streams, so that rendering the concurrent state is straightforward.
32. As a developer, I want old stream history to remain in memory for the current app session, so that failed page diagnostics remain visible during retries.

## Implementation Decisions

- Add or extract a deep module for page-generation scheduling. Its public behavior should express: ordered page scheduling, fixed concurrency of 5, cooperative cancellation, ordinary page failure continuation, infrastructure failure stop scheduling, and final completion only when every page is accepted.
- Keep Page Generation Unit boundaries strict. A page agent may work on the selected page's content and page-level assets, but not shared deck structure or template-wide assets. Shared work belongs before concurrent page generation or in a separate future flow.
- Keep page scheduling ordered by Page Plan. Start pages in index order up to the concurrency limit; when a running page reaches a terminal state, start the next pending page if scheduling has not been stopped.
- Fix the concurrency limit at 5. This is a product/system rule, not a user-facing setting.
- Keep each page's internal retry behavior unchanged. The existing render retry, self-review retry, and agent failure budgets continue to apply within a single Page Generation Unit.
- Define Failed Page Generation as a terminal page state reached after automatic recovery attempts are exhausted or manual review is required. Do not convert one transient render or self-review failure into manual failure.
- Ordinary Failed Page Generation does not fail-fast. The scheduler continues other active pages and continues filling available slots until all pages are terminal or cancellation/infrastructure failure stops scheduling.
- Agent infrastructure errors stop global scheduling. Do not start more pages after such an error; already-running pages follow cooperative cancellation semantics.
- Cooperative cancellation means no new Page Generation Units are started after the user cancels. Already-running page work may finish its current step before cancellation is reflected.
- Final whole-Deck render only runs when every Page Generation Unit is accepted. If any page is failed, cancelled, pending, or active, the app stays in the Generating experience.
- A failed overall Deck Generation still uses the existing failed completion category. Do not add a top-level partial-failed completion state; multiple failed pages are represented in page-level progress.
- Add a Page Generation Retry action for eligible failed pages. It reruns exactly one selected Failed Page Generation and does not regenerate Page Plan, reprepare all page files, or rerun accepted pages.
- Page Generation Retry is available only when no Active Deck Generation batch is running. Do not allow manual retry while the main concurrent batch is still active.
- Eligible retry statuses are content/quality page failures such as render failure, agent failure, and manual-review-required failure. Infrastructure failure is not a single-page retry case.
- Page Generation Retry resets that page's attempt counters and failure status for the new run while preserving historical session records.
- Page Generation Retry preserves the current page TSX/data files as the repair starting point. It is not a page reset.
- If a Page Generation Retry succeeds and all pages are accepted, automatically run final whole-Deck render and transition to Review.
- Ensure one Page Generation Unit has at most one active run at a time. This allows existing stable preview artifact paths to remain usable without adding run-specific output paths.
- Extend the Deck Generation Progress model to represent multiple active streams. A compatibility field for the most recently updated stream may remain during migration, but UI should render from the multi-stream representation.
- Change the main generation message to aggregate counts and global state. Avoid single-page messages such as “Agent 正在编辑第 N 页” as the primary Deck Generation Progress text.
- Show Live Page Streams for all Active Page Generation entries, expanded by default. Limit each stream's visual height with internal scrolling.
- Change “当前会话流” into Generation Session History. It should be collapsed by default and store completed agent run snapshots rather than active live streams.
- Keep Generation Session History in frontend memory for this PRD. Continue writing workspace logs, but do not build log replay from workspace files.
- Keep failed page retry history appended to the current Generation Session History. Only a full Deck Generation restart clears history.
- Serialize same-workspace page-progress writes in the engine app-facing tool layer. Concurrent Page Generation can run in parallel, but writes to the shared page-progress artifact must not lose updates.
- Scope the write serialization to page-progress updates for this PRD. Other workspace artifact mutations are kept out of Active Deck Generation by frontend flow constraints.
- Continue sharing one AgentClient adapter from the app state, but do not share an Anna Agent session. Each authoring or self-review run remains run-scoped and creates/deletes its own session.
- Do not create an ADR for this work. The decisions are feature-local and reversible enough; glossary updates and tests are sufficient.

## Testing Decisions

- Tests should verify external behavior rather than implementation details. Good tests assert progress events, page states, scheduler outcomes, retry eligibility, cancellation behavior, and final render gating.
- Add focused tests around the page-generation scheduler or extracted flow module. These tests should simulate pages with different completion timing, failures, cancellation, and infrastructure errors without requiring real Anna Agent sessions.
- Cover ordered concurrency: first 5 pages start, a later page starts only when a slot opens, and display/order-facing progress remains page-index ordered.
- Cover ordinary page failure continuation: one page reaches a failed terminal status after retry exhaustion while other pages continue and can become accepted.
- Cover infrastructure failure: scheduling stops after infrastructure failure and the Deck Generation result is failed with the infrastructure error semantics.
- Cover cooperative cancellation: no new pages start after cancellation, and already-started page work is allowed to reach a checkpoint before the final cancelled result.
- Cover final render gating: final whole-Deck render is not called unless every page is accepted.
- Cover Page Generation Retry: the selected failed page is reset for a new run, accepted pages are skipped, current files are not reset by the retry flow, and successful retry triggers final render when it completes the Deck.
- Cover multi-stream progress: when multiple pages are active, progress exposes multiple active streams and completed streams can become history snapshots.
- Cover page-progress serialization in engine tests. A good test should simulate overlapping page-progress updates for different pages in the same workspace and assert that both updates survive.
- Reuse the existing deck-generation test style as prior art. The current tests already use mocked backend, AI client, and agent client to verify Deck Generation behavior without running real browser or Anna infrastructure.
- Reuse existing app-workspace tests as prior art for artifact mutation behavior. The page-progress serialization test should assert persisted artifact state, not private lock implementation.
- For frontend UI, prefer component-level or integration-level checks that assert visible behavior: active page streams, collapsed Generation Session History, failed page retry buttons, aggregate failure message, and disabled retry while generation is active.

## Out of Scope

- Do not change the single-page internal retry budgets.
- Do not add a user-facing setting for concurrency.
- Do not allow page agents to modify shared template-wide assets during concurrent Page Generation.
- Do not implement workspace log replay for Generation Session History.
- Do not add a reset-page action that restores a page from blueprint.
- Do not add run-id-specific preview artifact paths unless a later requirement allows same-page concurrent runs.
- Do not implement multi-client or cross-process workspace-wide locking.
- Do not redesign PPTX or PDF export.
- Do not change Outline Creation, Outline Review, or Template selection behavior.
- Do not create an ADR for this feature.

## Further Notes

- The domain glossary now includes Page Generation Unit, Active Page Generation, Deck Generation Progress, Live Page Stream, Generation Session History, Failed Page Generation, Page Generation Retry, and Deck Generation Cancellation.
- Existing app constraints still apply: React pages call PptBackend only; workspace file reads/writes and gate logic belong in engine app-facing tools; frontend must not directly read or write the local filesystem.
- If implementation touches engine source, rebuild the engine before validating the app because the local plugin imports from the built engine output.
- If implementation touches only app source, start with the app type check and then run build or validation as needed.
