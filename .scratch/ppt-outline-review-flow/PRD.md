# PPT Outline Review Flow
Status: ready-for-agent

## Problem Statement

Today the PPT App behaves like a single uninterrupted generation flow. A user can start from a brief and end up with a generated deck, but there is no first-class way to pause after the outline, review it, edit it in the UI, or ask the LLM to rewrite it before the rest of the deck is produced.

That makes it hard to use the app for cases where the outline itself is the main decision point. Users need a controlled checkpoint where they can inspect structure, adjust slide ordering, change titles, and iterate with LLM help before the expensive downstream work starts.

## Solution

Add an optional outline-review gate to the PPT generation flow.

The default experience stays the same: one click still runs the full generation pipeline. If the user enables the review option in Brief, the app should stop after producing a draft Outline, switch to the Outline view, and wait.

In the Outline view, the user can:

1. Edit the outline directly in the frontend.
2. Enter a rewrite request for the LLM to regenerate the full outline from the current draft.
3. Confirm the outline when they are done.

Once the outline is confirmed, the app automatically continues into page planning and preview generation.

## User Stories

1. As a user, I want the default generation flow to stay one-click, so that I do not have extra steps when I do not need outline review.
2. As a user, I want to opt into outline review from the Brief screen, so that I can pause before the deck is fully generated.
3. As a user, I want the app to stop after generating a draft Outline when outline review is enabled, so that I can inspect structure before any downstream work starts.
4. As a user, I want to edit outline titles directly in the Outline view, so that I can fix structure without waiting for an AI round trip.
5. As a user, I want outline edits to save immediately, so that refreshing or switching views does not lose my work.
6. As a user, I want to add, delete, and reorder outline entries, so that I can reshape the deck structure during review.
7. As a user, I want to enter a rewrite request for the LLM, so that I can ask for a full outline revision in natural language.
8. As a user, I want the LLM rewrite to use the current draft as its basis, so that my latest edits and constraints are reflected in the new outline.
9. As a user, I want the LLM rewrite to replace the draft outline in full, so that I can review one clean result instead of merging patches.
10. As a user, I want to confirm the outline explicitly, so that downstream generation only starts from an approved draft.
11. As a user, I want confirmation to automatically continue into page planning and preview generation, so that I do not have to click through another handoff step.
12. As a user, I want a confirmed outline to remain editable, so that I can reopen it and make more changes if I change my mind.
13. As a user, I want any post-confirmation edit to turn the outline back into a draft, so that the approval state always matches the actual content.
14. As a user, I want the app to preserve the current one-click deck generation path when outline review is not enabled, so that existing behavior does not regress.

## Implementation Decisions

- Add an explicit outline-review gate to the deck workspace flow.
- Keep the default path unchanged unless the user opts into outline review.
- Treat the current outline draft as the single source of truth while the user is editing.
- Model the outline as a draft until it is explicitly confirmed.
- When the user edits the outline after confirmation, revert it to draft status.
- Keep manual edits and LLM rewrites in the same Outline view.
- Use direct frontend editing for titles and outline entries, with immediate persistence.
- Support add, delete, and reorder actions in the Outline editor.
- Use a single rewrite request input for LLM-based outline regeneration.
- Pass the current draft outline and user rewrite request to the outline-revision prompt.
- Have the LLM return a complete revised outline, not a partial patch.
- After confirmation, continue automatically into page planning and preview generation.
- Leave page authoring, final deck rendering, and export behavior unchanged outside of the new gate.
- Keep the existing workspace artifact model as the place where outline state and confirmation state are recorded.

## Testing Decisions

- Add behavior-focused tests for the deck workspace flow to cover both paths: default one-click generation and review-gated generation.
- Add tests for the outline editor behavior, including direct edits, add/delete/reorder actions, and immediate persistence.
- Add tests for the outline revision path to verify that the current draft and rewrite request are passed through and that a complete outline replaces the previous draft.
- Add tests for the confirm-and-continue handoff so that confirmation advances into page planning automatically.
- Prefer tests that assert visible state transitions and persisted artifacts rather than implementation details.
- Reuse the existing style of flow-level and client-level tests used elsewhere in the PPT App rather than introducing a new testing shape.

## Out of Scope

- Changing the page authoring pipeline.
- Changing deck rendering or export behavior.
- Changing template discovery, template preview rendering, or template selection rules.
- Introducing a separate revision history UI.
- Introducing collaborative editing.
- Introducing per-item AI patch merging.

## Further Notes

The intended UX is: default fast path for casual users, outline gate for users who need control, and a clear approval boundary before the expensive downstream generation work starts.

