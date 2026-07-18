# Fresh-session deterministic retry for local gates

Page Generation and Research Curation need to recover from cases where an Agent run reports success but the expected Workspace artifact was not actually changed, is stale, or is invalid, or where the generated page fails an immediate local render/typecheck gate. Decide to keep fresh Agent sessions as the only Agent lifecycle for these workflows. Deterministic local gate failures may retry, but every retry sends a full prompt through a new Agent session and closes that session before app-facing backend gates inspect Workspace artifacts.

This replaces the earlier same-session repair direction. The retained design value is deterministic local retry; the rejected design value is retaining Anna Agent session state across local gates. Live diagnosis showed that retained Agent sessions can make Research Curation Draft writes invisible to the app-facing backend gate, producing false no-write or unreadable-file outcomes even when raw research files exist.

Supported retry categories are Page Authoring no-change, Page Authoring render/pre-render TypeScript failure, Web Research Curation Draft no-write/no-change/stale/invalid output, and Visual Research Curation Draft no-write/no-change/stale/invalid output. Page Authoring no-change and Research Curation draft gate failures use an original plus three fresh-session retry budget. Render/typecheck failures keep existing render attempt accounting. Research Curation remains non-blocking; exhausted curation retry becomes a Research Evidence Gap and Page Generation continues.

Under the single-Page-Source contract, the Page Authoring no-change gate compares only the current `slides/<page_id>.tsx` fingerprint before and after the Agent run. Agent-reported `files_read`, `authoring_kit_sources_read`, and `changed_files` are diagnostic records and never determine whether the run changed the page.

The workflow deliberately does not fingerprint or reject changes to every other Workspace file in the first migration. The prompt forbids those edits, while the deterministic success gate remains limited to whether the current Page Source changed.

**Considered Options**

- Reuse one Agent session for deterministic same-stage repair prompts. Rejected because retained Anna session state can delay or hide file visibility from app-facing backend gates, especially for Research Curation Drafts.
- Share one Agent session across an entire Page Generation Unit. Rejected because Research Curation, Page Authoring, and Page Visual Review have different tool boundaries, grounding rules, and artifact ownership.
- Always create a fresh Agent session and resend the full prompt for each deterministic retry. Accepted because it restores the known working Agent lifecycle while preserving deterministic gates and bounded retry.
- Treat draft validation failures as blocking Page Generation failures. Rejected because Research Evidence is required but non-blocking; exhausted curation retry should become a Research Evidence Gap.
