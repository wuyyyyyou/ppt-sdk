---
status: accepted
---

# Presentation Requirements is a required Workspace stage

Presentation Requirements will be a required, user-confirmed stage between the Brief and Outline Creation. Its draft candidates, current selections, source Brief, and confirmed values belong to a standalone Workspace requirements artifact, and its LLM activity belongs to a separate requirements interaction log; this gives the requirements an explicit lifecycle and authority instead of treating them as temporary UI context owned by the Outline.

Presentation Requirements Creation occurs only when the user explicitly requests it, and Presentation Requirements Review is never skipped automatically. Editing the Brief does not implicitly invalidate or regenerate existing requirements; a successful explicit regeneration replaces and persists the current review draft. Later candidate changes remain local until the user explicitly saves the draft, while confirmation saves concrete values for every field before downstream work may continue.

**Considered Options**

- Keep requirements in React state until Outline Creation writes `outline.source.context`. Rejected because requirements would be lost across app sessions and would remain owned by a later artifact.
- Reuse the legacy task-state-machine `requirements.json`. Rejected because it belongs to a different project lifecycle and uses a different domain model.
- Derive new requirements automatically from legacy context rows. Rejected because fields such as purpose and desired outcome cannot be reconstructed without falsely presenting inferred data as user-confirmed requirements.

**Consequences**

- New PPT App Workspaces use a standalone `requirements.json` and do not migrate legacy context rows or old Workspace data during the current local-development phase.
- Before an Outline exists, the requirements artifact owns Workspace recovery: `empty` returns to the Brief, while `draft` and `confirmed` return to Presentation Requirements Review without automatically invoking an LLM or starting downstream work.
- The PPT App provides review-time validation, while `ppt-engine` owns deterministic requirements validation and blocks new Outline Creation work unless the Workspace has complete Confirmed Presentation Requirements.
- Requirements LLM calls use a dedicated `requirements` log domain rather than the `outline` domain.
- During the staged refactor, Confirmed Presentation Requirements are temporarily projected into the existing context-row and Workspace-setting inputs so the current Outline Creation implementation can continue unchanged; that projection is removed when Outline Creation is refactored to consume the confirmed requirements directly.
