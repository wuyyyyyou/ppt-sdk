# Outline Review Card and Explicit Manual Edit Mode
Status: ready-for-agent

## Parent

.scratch/ppt-outline-review-flow/PRD.md

## What to build

Refactor Outline Review so the Outline appears inside a titled card with clear footer actions. The confirmation action should move into the Outline card footer and use the wording "Confirm and generate" in English and "确认并生成" in Chinese.

Replace direct autosave editing with an explicit read-only and edit-mode workflow. By default, the Outline is read-only. The user clicks "Modify Outline" to enter edit mode. Manual changes update only a local unsaved draft until the user clicks save. Cancel discards the local draft. During Active Deck Generation, Outline editing should be disabled.

## Acceptance criteria

- [ ] The Outline list is visually contained in a card with an "Outline" / "大纲" title.
- [ ] The revision controls are visually separate from the Outline card.
- [ ] The confirm action appears in the Outline card footer.
- [ ] The confirm action uses "Confirm and generate" / "确认并生成".
- [ ] The Outline is read-only by default.
- [ ] A clear "Modify Outline" action enters edit mode.
- [ ] Manual title and outline body edits are possible only in edit mode.
- [ ] Manual edits update a local unsaved draft, not the saved workspace artifact.
- [ ] Saving writes the local draft to the saved Outline artifact.
- [ ] Cancelling exits edit mode and restores the saved Outline content.
- [ ] Active Deck Generation prevents entering edit mode and prevents saving Outline changes.
- [ ] Existing Outline confirmation behavior still starts Deck Generation from a confirmed Outline.
- [ ] Behavior is covered by tests for read-only, edit, save, cancel, and Active Deck Generation lock states.
- [ ] Build and existing validation commands pass.

## Blocked by

None - can start immediately
