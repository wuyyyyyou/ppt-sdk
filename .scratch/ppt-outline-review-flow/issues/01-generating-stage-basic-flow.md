# Generating Stage Basic Flow
Status: ready-for-agent

## Parent

.scratch/ppt-outline-review-flow/PRD.md

## What to build

Add a first-class Generating main workflow stage for Deck Generation. Both generation entry points should enter this stage as soon as Deck Generation starts: one-click deck creation and confirmation from Outline Review. The stage should give the user a focused place to monitor progress instead of leaving them on the Brief or Outline Review page.

This slice should preserve the existing generation pipeline behavior. It only changes where the user lands while generation is running and how completion, failure, and cancellation route through the app. A successful run should automatically open the finished Deck in the review experience. A failed or cancelled run should remain on the Generating stage and expose recovery actions to return to the Outline or start generation again.

## Acceptance criteria

- [ ] Starting one-click deck creation navigates to the Generating stage before long-running Deck Generation begins.
- [ ] Confirming an Outline navigates to the Generating stage before page planning or page authoring begins.
- [ ] The Generating stage is a normal main workflow node, not a modal or overlay.
- [ ] The Generating stage does not show editable Outline content.
- [ ] Existing progress, page status, cancellation, and error information remain visible during generation.
- [ ] Successful Deck Generation opens the review experience automatically.
- [ ] Failed Deck Generation stays on the Generating stage and shows the failure point.
- [ ] Cancelled Deck Generation stays on the Generating stage and shows the cancelled state.
- [ ] The user can navigate from a failed or cancelled Generating state back to Outline Review.
- [ ] The user can start generation again from an appropriate recovery action.
- [ ] Existing Anna Runtime tool boundaries remain unchanged.
- [ ] Build and existing validation commands pass.

## Blocked by

None - can start immediately
