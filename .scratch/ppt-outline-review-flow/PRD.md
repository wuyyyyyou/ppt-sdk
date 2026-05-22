# PPT Outline and Generation Review UX
Status: ready-for-agent

## Problem Statement

The current PPT App generation experience mixes review, editing, and long-running deck generation on the same screens. When a user confirms an Outline and starts Deck Generation, the app can still visually remain on the Outline Review page, where the confirmed Outline stays visible and editable-looking. The standalone confirmation button also feels visually detached from the Outline it acts on, and the Outline list has no clear titled container.

The generation progress panel currently shows only the latest live stream. When the flow advances from one Generation Step to another, the previous stream disappears from the user-facing UI. This makes a long Deck Generation process hard to inspect, especially when each page goes through authoring, render, self-review, and fix attempts.

The current Outline editing model is also too easy to trigger accidentally. Direct inputs autosave on change, so a user can alter the Outline and downstream artifacts without an explicit editing mode or save boundary. Once a Deck exists, this risks presenting a Stale Deck as if it still matched the latest Outline.

## Solution

Create a clearer review and generation workflow around the existing artifact-driven PPT authoring model.

The Outline Review page should present the Outline inside a titled card, keep it read-only by default, and require the user to enter an explicit edit mode before changing it. All Outline changes, including manual edits and LLM revision, should remain local until the user clicks save. Saving an Outline change should return the Outline to draft status and mark downstream generation results as stale without physically deleting artifacts.

The confirmation action should move into the Outline card footer and use clearer wording: "Confirm and generate" in English and "确认并生成" in Chinese. Once confirmed, the app should leave the Outline Review page and enter a dedicated Generating stage.

The Generating stage should be a first-class main workflow node. It should be used whether the user starts from the one-click deck creation path or from a reviewed Outline. It should show generation progress, current status, stop controls, and a two-level stream history UI. The top-level timeline should show a small number of major Generation Steps; the page-level details should expose per-page authoring, render, and self-review streams without losing prior step output during the current generation session.

When Deck Generation completes successfully, the app should automatically open the review experience for the finished Deck. When Deck Generation fails or is cancelled, the app should remain on the Generating stage and show the failed or cancelled point with options to return to the Outline or run generation again.

## User Stories

1. As a deck author, I want the Outline to appear inside a titled card, so that I know the list below generation progress is the Outline.
2. As a deck author, I want the Outline Review page to separate revision controls from the Outline content, so that I understand what each area controls.
3. As a deck author, I want the confirm action to live in the Outline card footer, so that the action clearly applies to the reviewed Outline.
4. As a deck author, I want the confirm button to say "Confirm and generate", so that I understand the next action starts Deck Generation.
5. As a Chinese-language user, I want the confirm button to say "确认并生成", so that the action is concise and natural.
6. As a deck author, I want the Outline to be read-only by default, so that I do not accidentally change the deck structure.
7. As a deck author, I want a "Modify Outline" action, so that editing the Outline is an explicit decision.
8. As a deck author, I want Outline fields to become editable only after I enter edit mode, so that accidental clicks do not mutate artifacts.
9. As a deck author, I want Outline edits to stay local until I click save, so that I can review my changes before committing them.
10. As a deck author, I want to cancel Outline editing, so that I can discard draft changes without affecting the saved Outline.
11. As a deck author, I want to save Outline edits explicitly, so that the workspace only changes when I approve the edit.
12. As a deck author, I want LLM-based Outline revision to follow the same edit/save boundary, so that AI revisions do not bypass the explicit save model.
13. As a deck author, I want Outline editing to be disabled during Active Deck Generation, so that the running generation flow has a stable confirmed Outline.
14. As a deck author, I want a saved Outline edit after Deck Generation to mark downstream results stale, so that I do not mistake an old Deck for a current one.
15. As a deck author, I want stale downstream artifacts to remain on disk, so that previous outputs are not destroyed before I regenerate.
16. As a deck author, I want the UI to stop presenting a Stale Deck as current, so that I know I need to confirm and regenerate.
17. As a deck author, I want one-click deck creation to move to a dedicated Generating stage, so that I am not left on the Brief page while the app is generating.
18. As a deck author, I want reviewed Outline creation to move to the same Generating stage after confirmation, so that both generation paths feel consistent.
19. As a deck author, I do not want the Generating stage to show editable Outline content, so that the generation experience is focused on progress rather than review.
20. As a deck author, I want the Generating stage to show a high-level timeline, so that I can see where the generation process is.
21. As a deck author, I want the high-level timeline to use a small number of major nodes, so that it stays readable for decks with many pages.
22. As a deck author, I want the major nodes to include Outline generation, page planning, file preparation, page generation, and final preview, so that the timeline matches the real workflow.
23. As a deck author, I want to expand the page generation node, so that I can inspect each slide page's progress.
24. As a deck author, I want each page to show authoring, render, and self-review state, so that I can understand why a page is taking time.
25. As a deck author, I want live stream output from earlier steps to remain visible during the current generation session, so that moving to the next step does not erase useful context.
26. As a deck author, I want to click a step or page to inspect its stream details, so that I can diagnose what happened without scanning one large log.
27. As a deck author, I want completed pages to remain visible while later pages generate, so that I can see accumulated progress.
28. As a deck author, I want failed pages to be clearly identified, so that I know what needs attention.
29. As a deck author, I want cancellation to leave me on the Generating stage, so that I can see what was completed before the stop.
30. As a deck author, I want a failed Deck Generation to remain on the Generating stage, so that I can review the failed step before deciding what to do.
31. As a deck author, I want successful Deck Generation to open the review experience automatically, so that I can inspect the finished Deck immediately.
32. As a deck author, I want returning from review to show the Deck as the current main workflow stage, so that the workflow state matches the completed output.
33. As a deck author, I want refreshed or reopened workspaces to recover page progress even if detailed stream history is not restored, so that persisted status remains useful.
34. As a deck author, I want detailed stream history to be current-session only for this release, so that the feature improves the immediate experience without requiring a new log-reading contract.
35. As a developer, I want the workflow to remain artifact-driven, so that stages are derived from workspace artifacts and stale status rather than a fragile single state field.
36. As a developer, I want the Generating stage to reuse the existing backend generation pipeline, so that the UX change does not fork generation behavior.
37. As a developer, I want Outline edit state to be represented separately from saved workspace artifacts, so that cancelling edits is straightforward and testable.
38. As a developer, I want downstream stale handling to be explicit, so that future agents do not accidentally treat old page plans or decks as current.

## Implementation Decisions

- Add a first-class Generating main workflow stage between Outline Review and Deck.
- Route both generation entry points into the Generating stage as soon as Deck Generation starts.
- Keep successful completion behavior aligned with the current product direction: automatically open the finished Deck in the review experience.
- Keep failed and cancelled generation attempts on the Generating stage, with visible failed/cancelled status and recovery actions.
- Do not introduce a formal persistent "pause" domain state. The only new glossary distinction is Active Deck Generation: generation is currently running, and the confirmed Outline is not open to edits.
- Keep detailed stream history current-session only. Persisted workspace recovery should continue to rely on page progress and generated artifacts.
- Do not add a frontend contract for reading workspace debug logs in this PRD.
- Represent the generation timeline as two levels: a small major-step timeline and expandable per-page detail under page generation.
- Treat authoring, rendering, self-review, retry, failed, accepted, cancelled, and final preview as displayable progress states in the Generating UI.
- Preserve previous current-session stream entries when new stream events arrive, instead of replacing the visible stream with only the latest step.
- Add an Outline card with a title, read-only display mode, edit mode, and footer actions.
- Move the confirmation CTA into the Outline card footer and rename it to "Confirm and generate" / "确认并生成".
- Replace immediate Outline autosave with an explicit edit/save/cancel model.
- Maintain a local unsaved Outline draft while the user edits.
- Allow manual Outline edits only in edit mode.
- Allow LLM-based Outline revision only in edit mode, and keep its result unsaved until the user saves or cancels.
- Disable Outline editing during Active Deck Generation.
- When saved Outline content differs from the previously saved Outline after downstream artifacts exist, mark the Deck as stale and return the Outline to draft status.
- Do not physically delete downstream artifacts when marking them stale.
- Ensure stale downstream artifacts are not presented as the current Deck until regeneration completes.
- Preserve the existing Anna Runtime tool boundary: frontend components call the backend adapter, and workspace file mutation remains behind app-facing tools.
- Prefer extracting a focused Outline editing state module or hook that exposes a small interface: begin edit, apply local change, apply LLM revision, save, cancel, and read dirty status.
- Prefer extracting a focused generation progress view model that converts pipeline progress events and page progress artifacts into timeline nodes and expandable stream details.
- Avoid making the Generating stage a modal or overlay. It should be a normal workflow node.

## Testing Decisions

- Tests should assert user-visible workflow behavior and saved artifact effects, not component implementation details.
- Add tests for the Outline Review behavior: default read-only state, entering edit mode, local draft editing, save, cancel, and disabled editing during Active Deck Generation.
- Add tests that LLM Outline revision follows the edit/save/cancel boundary and does not persist until saved.
- Add tests that saving Outline changes after a generated Deck marks downstream results stale and stops presenting the old Deck as current.
- Add tests for the Generating stage routing: one-click creation enters Generating, reviewed Outline confirmation enters Generating, successful completion opens review, and failure/cancellation stays on Generating.
- Add tests for generation progress view-model behavior: current stream history is appended to the current-session timeline and prior step streams remain visible after later steps start.
- Add tests for workspace restoration behavior: persisted page progress can be restored, but detailed stream history is not expected to survive refresh or reopening.
- Reuse existing frontend build and validation commands as the baseline verification.
- If a focused hook or view-model module is extracted, prefer unit tests for that module because it can encode the workflow rules without requiring full browser rendering.
- Keep visual regression testing out of scope unless the repo already has an established lightweight screenshot test path for this app.

## Out of Scope

- Persistent detailed stream history after refresh or reopening a workspace.
- Adding a new app-facing tool to read workspace log files.
- Introducing a formal pause/resume domain state.
- Physically deleting old page plans, page progress, rendered pages, or export artifacts when the Outline changes.
- Reworking the underlying page authoring, render, self-review, or export pipeline.
- Changing template discovery, template preview generation, or template selection behavior.
- Adding collaborative Outline editing.
- Adding per-slide Outline item reorder, insert, or delete behavior unless it already exists in the local editor flow being touched.
- Replacing the current review experience after successful generation.
- Changing Anna Runtime invocation shape or tool IDs.

## Further Notes

This PRD supersedes the earlier outline-review behavior that allowed immediate Outline autosave. The updated decision is that Outline changes require explicit edit mode and explicit save.

The key product principle is that the user should always know which mode they are in: reviewing an Outline, editing an unsaved Outline draft, actively generating a Deck, reviewing a finished Deck, or looking at a stale result that needs regeneration.

The key technical principle is to keep the workflow artifact-driven. The UI may introduce clearer stages, but truth should continue to come from the saved Outline, page plan, page progress, pages, and rendered artifacts.
