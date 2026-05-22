# Stale Deck Handling After Saved Outline Changes
Status: ready-for-agent

## Parent

.scratch/ppt-outline-review-flow/PRD.md

## What to build

When the user saves Outline changes after downstream generation artifacts already exist, treat the existing Deck as stale. The saved Outline should return to draft status, and the UI should stop presenting the old Deck as the current result until the user confirms the updated Outline and regenerates.

This should be artifact-driven. Do not physically delete old page plans, page progress, rendered pages, or export artifacts. The app should preserve files while making the stale state clear and preventing stale output from being mistaken for current output.

## Acceptance criteria

- [ ] Saving an Outline change detects whether downstream generation artifacts already exist.
- [ ] If downstream artifacts exist, the saved Outline becomes a draft rather than remaining confirmed.
- [ ] If downstream artifacts exist, downstream results are marked or interpreted as stale.
- [ ] Stale downstream artifacts are not physically deleted.
- [ ] The UI stops presenting a Stale Deck as the current Deck.
- [ ] The user is directed back to Outline Review to confirm and regenerate from the updated Outline.
- [ ] Existing export or review affordances do not imply that stale artifacts match the saved Outline.
- [ ] Workspaces restored from disk interpret stale downstream state consistently.
- [ ] Saving Outline changes before any downstream artifacts exist does not create a false stale Deck state.
- [ ] Behavior is covered by tests for generated, partially generated, and no-downstream-artifact cases.
- [ ] Build and existing validation commands pass.

## Blocked by

- .scratch/ppt-outline-review-flow/issues/03-outline-review-card-edit-mode.md
