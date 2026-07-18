---
status: accepted
---

# Presentation Requirements is a required Workspace stage

Presentation Requirements will be a required, user-confirmed stage between the Brief and Outline Creation. Its draft candidates, current selections, source Brief, and confirmed values belong to a standalone Workspace requirements artifact, and its LLM activity belongs to a separate requirements interaction log; this gives the requirements an explicit lifecycle and authority instead of treating them as temporary UI context owned by the Outline.

Presentation Requirements Creation occurs only when the user explicitly requests it, and Presentation Requirements Review is never skipped automatically. Editing the Brief does not implicitly invalidate or regenerate existing requirements; a successful explicit regeneration replaces and persists the current review draft. Later candidate changes remain local until the user explicitly saves the draft, while confirmation saves concrete values for every field before downstream work may continue.

Outline Creation consumes the Confirmed Presentation Requirements directly rather than projecting them into legacy context rows or Workspace settings. The requirements source Brief supplies subject matter, while the confirmed selections override conflicting Brief wording. Output language remains owned by the requirements; page count is the sole exception that Outline Review may synchronize to the saved Outline entry count without returning the requirements to draft.

**Considered Options**

- Keep requirements in React state until Outline Creation writes `outline.source.context`. Rejected because requirements would be lost across app sessions and would remain owned by a later artifact.
- Reuse the legacy task-state-machine `requirements.json`. Rejected because it belongs to a different project lifecycle and uses a different domain model.
- Derive new requirements automatically from legacy context rows. Rejected because fields such as purpose and desired outcome cannot be reconstructed without falsely presenting inferred data as user-confirmed requirements.

**Consequences**

- New PPT App Workspaces use a standalone `requirements.json` and do not migrate legacy context rows or old Workspace data during the current local-development phase.
- Before an Outline exists, the requirements artifact owns Workspace recovery: `empty` returns to the Brief, `draft` returns to Presentation Requirements Review, and `confirmed` with an empty Outline returns to the Outline stage where failed creation can be retried without silently invoking an LLM during recovery.
- The PPT App provides review-time validation, while `ppt-engine` owns deterministic requirements validation and blocks new Outline Creation work unless the Workspace has complete Confirmed Presentation Requirements.
- Requirements LLM calls use a dedicated `requirements` log domain rather than the `outline` domain.
- Saving requirement edits as a draft does not change the existing Outline, but the Outline stage is unavailable until the requirements are confirmed again. Presentation Requirements Confirmation clears the current Outline and automatically starts a fresh Outline Creation.
- Legacy context-row projection and Outline-owned output-language handling are removed from Outline Creation. The Authoring Kit Page Generation migration also removes its temporary Workspace-setting compatibility: downstream Page Authoring reads Confirmed Presentation Requirements rather than legacy audience, goal, output-language, style-note, or text-density settings.
