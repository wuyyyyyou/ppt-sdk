# Generation Timeline and Current-Session Stream History
Status: ready-for-agent

## Parent

.scratch/ppt-outline-review-flow/PRD.md

## What to build

Upgrade the Generating stage from a single latest-stream panel into a two-level progress experience. The top level should show a small number of major Generation Steps, and the page generation step should expand into per-page detail. Each page should expose the relevant authoring, render, self-review, retry, accepted, failed, and cancelled state.

During the current generation session, stream output from earlier steps should remain inspectable after later steps start. Refreshing or reopening a workspace does not need to restore detailed stream history; persisted recovery should continue to rely on page progress and artifacts.

## Acceptance criteria

- [ ] The Generating stage shows a compact major-step timeline for Outline generation, page planning, file preparation, page generation, and final preview.
- [ ] The active major step is visually distinct from completed and pending steps.
- [ ] The page generation step can be expanded to inspect per-page progress.
- [ ] Each page displays enough state to distinguish pending, authoring, rendering, self-review, retry/fix, accepted, failed, and cancelled outcomes.
- [ ] Clicking or selecting a step/page reveals its current-session stream details.
- [ ] When generation advances to a new step, previously captured stream details from the current session remain available.
- [ ] The latest live stream is still visible for the currently active step.
- [ ] Completed pages remain visible while later pages generate.
- [ ] Failed pages are clearly identified and remain inspectable.
- [ ] Reopening or refreshing a workspace restores page progress but does not claim to restore detailed stream history.
- [ ] No new app-facing log-reading contract is introduced.
- [ ] Behavior is covered by focused tests for the progress view model or equivalent user-visible state.
- [ ] Build and existing validation commands pass.

## Blocked by

- .scratch/ppt-outline-review-flow/issues/01-generating-stage-basic-flow.md
