# PRD: Deck Generation Flow Module

Status: ready-for-agent
Type: PRD

## Problem Statement

当前 Workspace 页面能从 Brief 或 Confirmed Outline 启动 Deck 生成，但维护者需要在 Workspace 页面状态、生成流程实现、Progress 展示和错误处理之间来回跳转，才能理解完整闭环。

主要问题是 Deck Generation 的模块边界不够清晰：从 Brief 创建 Outline、从 Confirmed Outline 生成 Page Plan、逐页 authoring、render-fix、self-review、重试策略、日志写入、取消和最终 Deck 渲染被放在相邻甚至同一层编排里。结果是调用方需要理解过多生成细节，也让测试难以只围绕生成流程本身编写。

用户体验上，用户仍希望保留两条入口：从 Brief 一键生成 Deck，或在 Outline Review 后基于 Confirmed Outline 生成 Deck。但对维护者来说，Deck Generation 应该是一个从 Confirmed Outline 开始的深模块，拥有小而稳定的接口，并把复杂生成策略封装起来。

## Solution

建立一个独立的 Deck Generation Flow Module，把 Deck Generation 明确定义为：

```text
Confirmed Outline -> Page Plan -> Prepared Pages -> Authored Pages -> Reviewed Pages -> Deck
```

该模块只接受 Confirmed Outline，不负责从 Brief 创建 Outline。Brief 入口仍然保留，但由 Workspace 层先完成 Outline Creation，再把 Confirmed Outline 交给 Deck Generation Flow Module。

用户可见体验保持不变：

- 从 Brief 一键生成 Deck 仍然可用。
- 先进入 Outline Review，再确认生成 Deck 仍然可用。
- Progress、取消、失败提示和最终 Deck 预览行为保持一致。

维护者可见结构发生变化：

- Workspace 页面只负责发起生成、展示 Progress、处理取消和导航收尾。
- Deck Generation Flow Module 负责 Page Plan、页面文件准备、逐页 authoring、render、self-review、修复重试、日志写入、失败归因和最终 Deck 渲染。
- 可预期终态通过结构化 completion 返回，而不是把取消、业务失败和基础设施失败全部混成普通异常。
- 模块支持明确的 `restart` 与 `resume` 启动语义，避免“看似续跑但重新生成 Page Plan”的模糊行为。

## User Stories

1. As a deck author, I want to create a Deck directly from a Brief, so that I can quickly get a complete presentation without manually confirming every intermediate step.
2. As a deck author, I want to review an Outline Draft before generating the Deck, so that I can correct the structure before downstream generation begins.
3. As a deck author, I want a Confirmed Outline to be the stable input for Deck Generation, so that downstream pages are generated from an accepted structure.
4. As a deck author, I want the generation progress to remain visible while pages are being authored, rendered, and reviewed, so that I know the process is still moving.
5. As a deck author, I want to cancel an Active Deck Generation, so that I can stop a run that is no longer useful.
6. As a deck author, I want cancellation to feel like a normal stopped state rather than a crash, so that I am not shown misleading failure feedback.
7. As a deck author, I want render errors to trigger repair attempts automatically, so that common generation mistakes are fixed without manual intervention.
8. As a deck author, I want visual self-review failures to trigger repair attempts automatically, so that the generated Deck has fewer obvious layout or content quality issues.
9. As a deck author, I want unrecoverable generation failures to show a clear page-level reason, so that I know which part of the Deck needs attention.
10. As a deck author, I want Agent infrastructure failures to be distinguishable from slide quality failures, so that I can understand whether to retry later or revise content.
11. As a deck author, I want a generated Deck to open in the existing review experience, so that the final result can be inspected without changing workflow.
12. As a deck author, I want existing behavior to remain consistent whether I start from Brief or Confirmed Outline, so that the app feels coherent.
13. As a deck author, I want a partially completed generation to be resumable when safe, so that accepted pages do not need to be recreated unnecessarily.
14. As a deck author, I want stale artifacts to be detected before resuming, so that a Deck is not accidentally completed from an old Outline or Template.
15. As a maintainer, I want Deck Generation to be represented by one deep module, so that generation strategy can be tested and changed without editing Workspace UI state.
16. As a maintainer, I want Workspace to call a small module interface, so that page components do not need to know prompt assembly, retry limits, repair status, or log channels.
17. As a maintainer, I want Deck Generation progress to be a stable display contract, so that UI components do not directly depend on internal Page Progress storage details.
18. As a maintainer, I want Deck Generation steps to use project terminology, so that code, UI, issues, and PRDs all speak the same language.
19. As a maintainer, I want Outline Creation to stay separate from Deck Generation, so that Brief-to-Outline logic does not keep expanding the Deck Generation boundary.
20. As a maintainer, I want `restart` and `resume` to be explicit start modes, so that behavior around existing Page Plan and Page Progress is predictable.
21. As a maintainer, I want expected terminal states to be structured results, so that UI can handle completed, cancelled, and failed runs without fragile string matching.
22. As a maintainer, I want pure mock tests for generation orchestration, so that the critical flow can be verified without launching Anna runtime, Chrome, or Puppeteer.
23. As a maintainer, I want render-fix and self-review-fix behavior covered by tests, so that future changes do not silently remove automatic repair.
24. As a maintainer, I want failure tests to distinguish unrecoverable page failure from Agent infrastructure failure, so that recovery UI and retry guidance stay accurate.
25. As a maintainer, I want generation logs to stay inside the flow implementation, so that observability remains consistent across both entry paths.

## Implementation Decisions

- Build a dedicated Deck Generation Flow Module as an independent feature module rather than keeping the flow inside Workspace orchestration.
- Define Deck Generation strictly as the process that starts from a Confirmed Outline. It does not include Outline Creation from a Brief.
- Keep Brief entry behavior by using a thin Workspace-level adapter: create or confirm the Outline first, then call the Deck Generation module.
- Do not extract a full Outline Creation Module in this PRD. Outline Creation can be deepened later as a separate effort.
- Remove or rename the current Brief-based generation entry so that the Deck Generation module no longer exposes an API that accepts a Brief.
- The module should expose one primary generation operation that accepts Workspace, Confirmed Outline, dependencies, locale, start mode, progress callback, and cancellation input.
- The module should own Page Plan generation, Page Plan persistence, page file preparation, per-page authoring, page render preview, self-review, final Deck render, and generation log writing.
- The module should own prompt assembly for page authoring and self-review, including render-fix and self-review-fix context.
- The module should own retry policy for render attempts, self-review attempts, Agent failures, and Agent infrastructure failures.
- The module should expose structured completion for expected terminal outcomes:

```ts
type DeckGenerationCompletion =
  | { status: "completed"; result: DeckGenerationResult }
  | { status: "cancelled"; progress: DeckGenerationProgress | null }
  | { status: "failed"; error: DeckGenerationError; progress: DeckGenerationProgress | null };
```

- Unexpected programming errors may still throw, but expected cancellation, unrecoverable page failure, stale artifacts, and Agent infrastructure failure should return structured completion.
- Progress should be a module-owned display contract, not a raw storage record passthrough.
- Deck Generation progress should not include an `outline` step, because Outline Creation is outside the Deck Generation boundary.
- Generation steps should use Deck Generation terminology, such as `page-plan`, `prepare`, `page-authoring`, `page-render`, `page-review`, `final-render`, `complete`, `cancelled`, and `failed`.
- Progress may include page summaries, attempt counts, last errors, screenshot references, and live Agent stream details, but those fields should be named as part of the module contract.
- UI should no longer import generation retry constants directly. If attempt limits are shown, they should come through the progress contract or a display helper owned by the module.
- The module should provide or own helper logic for deriving generation history snapshots from live progress events, so Workspace does not need to understand stream identity rules.
- Introduce explicit start modes:

```ts
type DeckGenerationStartMode = "restart" | "resume";
```

- `restart` should generate a new Page Plan and reset or overwrite existing Page Progress for the active Confirmed Outline.
- `resume` should reuse existing Page Plan and Page Progress only when they still match the Confirmed Outline and Template. Accepted pages may be skipped.
- If `resume` detects stale or incompatible artifacts, the module should return a structured failed completion with a stale-artifacts reason rather than silently replanning.
- Workspace should remain responsible for navigation, toast policy, final review state, and applying the rendered Deck to local UI state.
- Workspace should treat cancellation as a stopped terminal state, not as a generic error toast.
- Workspace should use failure type to choose user-facing behavior: infrastructure failure, unrecoverable page failure, stale artifacts, and unknown failure should be distinguishable.
- The final Deck preview behavior should remain consistent with the current review flow.

## Testing Decisions

- Add a lightweight unit test entry for the app package using Node test runner and TypeScript loading.
- Deck Generation Flow Module should be tested with mock dependencies rather than real Anna runtime, Chrome, Puppeteer, or filesystem-heavy rendering.
- Good tests should verify externally observable module behavior: progress sequence, dependency calls, completion status, persisted status patches, and returned failure types.
- Tests should avoid asserting private helper structure or exact prompt text unless that text is part of a deliberate public contract.
- Cover the successful path from Confirmed Outline through Page Plan, page preparation, accepted pages, final render, and completed result.
- Cover render failure followed by render-fix authoring and eventual success.
- Cover self-review failure followed by self-review-fix authoring and eventual success.
- Cover user cancellation as structured `cancelled` completion with no generic error handling requirement.
- Cover unrecoverable page failure after retry exhaustion as structured `failed` completion.
- Cover Agent infrastructure failure as a distinct structured `failed` completion.
- Cover `resume` with matching Page Plan and Page Progress, including skipping accepted pages.
- Cover `resume` with stale artifacts, returning stale-artifacts failure instead of silently restarting.
- Existing engine-side tests remain responsible for lower-level task state and rendering behavior. This PRD's tests focus on app-side orchestration.

## Out of Scope

- Building a full Outline Creation Module.
- Redesigning Outline Review UX.
- Changing the visual design of Progress panels beyond what is needed to align with the new progress contract.
- Changing Anna runtime APIs.
- Changing the template engine's actual rendering behavior.
- Reworking Task State Machine semantics.
- Adding real browser, Chrome, or Puppeteer integration tests for this flow.
- Changing PPTX export behavior.
- Rewriting existing Deck refinement flows.

## Further Notes

- This PRD is based on the agreed design review for Issue 01: Deck Generation Flow Module.
- The glossary has been updated so **Outline Creation** means Brief-to-Outline, and **Deck Generation** means Confirmed Outline-to-Deck.
- The implementation should keep generated issue and PRD markdown Chinese-friendly.
- Current environment cannot launch Chrome/Puppeteer directly without escalation, so automated coverage for this PRD should stay mock-based.
