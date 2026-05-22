# LLM Outline Revision Uses the Same Edit and Save Boundary
Status: ready-for-agent

## Parent

.scratch/ppt-outline-review-flow/PRD.md

## What to build

Make LLM-based Outline revision follow the same explicit edit and save boundary as manual editing. The user should only be able to trigger Outline revision while in Outline edit mode. The LLM revision result should update the local unsaved Outline draft and should not persist to the workspace until the user clicks save. Cancelling edit mode should discard the LLM revision result.

## Acceptance criteria

- [ ] LLM Outline revision is unavailable while the Outline card is in read-only mode.
- [ ] LLM Outline revision is available in Outline edit mode.
- [ ] The revision prompt uses the current local draft as the basis for revision.
- [ ] A successful LLM revision updates the local unsaved draft.
- [ ] A successful LLM revision does not write the saved Outline artifact until the user clicks save.
- [ ] Cancelling edit mode discards unsaved LLM revision results.
- [ ] Saving after an LLM revision writes the revised draft to the saved Outline artifact.
- [ ] Revision loading, success, and error states remain visible and do not exit edit mode unexpectedly.
- [ ] Behavior is covered by tests for revise, save, and cancel paths.
- [ ] Build and existing validation commands pass.

## Blocked by

- .scratch/ppt-outline-review-flow/issues/03-outline-review-card-edit-mode.md
