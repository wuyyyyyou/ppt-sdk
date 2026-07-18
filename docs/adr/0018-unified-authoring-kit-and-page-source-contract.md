---
status: accepted
---

# Use one immutable Authoring Kit and Page Source contract

Deck Generation will replace selectable Template groups with one released Authoring Kit. Its Foundation Modules, Reference Library, and README guidance are copied into each Workspace as a conventionally read-only snapshot, while a stable engine-owned Page Source Bootstrap remains outside that snapshot and initializes each new `./slides/<page_id>.tsx` Page Source. Page Sources may import stable Foundation Modules; the README-routed Reference Library is source material to inspect, copy, or rewrite rather than an importable design system.

The engine-owned Deck Manifest is a rebuildable rendering index containing only a deck `title` and ordered slide `id`/`source` pairs, where `source` is a contained relative path string. The new contract has no Template selection, group or catalog metadata, blueprint registry, layout discovery, page data file, per-slide theme, or source type, and it deliberately provides no compatibility or migration path for old manifests, Template groups, or Workspaces.

Opening an old template/Page Plan Workspace fails with an explicit unsupported-workspace diagnostic and does not infer or convert new artifacts. Existing files are left untouched; users create a new Workspace for the Authoring Kit flow.

Every newly created Workspace records `task.json.workspace_format` as the exact value `authoring-kit-v1` before any Authoring Kit installation. Opening requires that marker; a missing or different value is unsupported. Directory contents such as the presence of `authoring-kit/` or legacy files are not used to guess the format.

The new Workspace `setting.json` owns runtime preferences only: page-generation concurrency, optional visual-review enablement and failure limit, and temporarily retained web/image search controls. Legacy audience, goal, style notes, output language, text density, and Content Review settings are removed; Presentation Requirements and the Workspace Style Guide own those deck decisions.

After Outline Confirmation has persisted page identities, a new Deck Generation installs or reuses the Workspace Authoring Kit, ensures the Workspace Style Guide, prepares or resets the Page Sources and rebuilds the root Deck Manifest, initializes Page Progress directly from the Confirmed Outline, and only then starts concurrent Page Authoring. Page Plan is not an intermediate step in this sequence.

The corresponding user-visible steps are Authoring Kit preparation, Workspace Style Guide Creation, Page Source preparation, concurrent page generation with rendering and optional Page Visual Review, Final Deck Render, and completion. Style Guide Markdown is not streamed to the generation UI; its completion attempts remain diagnostic logs.

**Considered Options**

- Keep multiple selectable Template groups. Rejected because their repeated TSX implementations, blueprints, catalogs, and data contracts increase maintenance cost and push Page Authoring toward homogeneous composition.
- Let Page Sources import Reference Implementations directly. Rejected because references would become a large compatibility surface and a de facto fixed design system.
- Keep the old manifest reader as a compatibility adapter. Rejected because the product is still in local development and dual contracts would preserve the complexity this change is intended to remove.

**Consequences**

- The engine format switch must ship with a minimal runnable Authoring Kit, but the full Reference Library can migrate incrementally afterward.
- The Page Source Bootstrap is maintained with the Authoring Kit release resources but is not copied into the Workspace Authoring Kit or versioned as part of its snapshot.
- Before Page Authoring begins, preparation checks only whether the `authoring-kit/` directory exists and installs the released kit when it does not. After Page Authoring begins, the workflow performs no proactive Authoring Kit existence, version, completeness, repair, or unresumable-state check; later file or render failures surface through the normal page workflow.
- Resume may use the Bootstrap to recreate a missing Page Source only for a page that has not begun authoring. Once a page has advanced, its Page Source is authoritative content and loss of that file is unresumable; the engine may still rebuild the Deck Manifest from intact Page Sources and the Confirmed Outline.
- Old Template directories remain only as temporary migration material and are deleted with discovery, previews, fork logic, and compatibility tests after the new flow is adopted.
- The PPT App migration is complete only after template selection UI and preview assets, Page Plan and Theme Token AI workflows, legacy backend types and calls, and app-facing template/page-plan/theme tools have been removed. These may be deleted in verified implementation steps, but the final architecture does not retain an unused compatibility path.
- The first Page Source migration hides Page Refinement and Deck Refinement entry points and switches only the user-reachable initial generation, resume, rendering, and export path. Existing Refinement implementations may temporarily remain as isolated legacy code with their Page Plan dependencies; ADR-0008 describes their later Page Source target. The final Page Plan deletion is deferred until those hidden flows are migrated.
- The first migration also removes web and image Research stages and their Brief-page switches from the user-reachable generation flow. It does not run Research Discovery, Evidence-Aware Page Planning, or page evidence materialization; existing research implementations remain isolated for a later Page Evidence Assignment migration.
- Deck Workspace uploads, Uploaded Source Analysis, Style Profile Creation, Style Profile Library browsing, and Style Profile selection are also sealed in the first migration. Their existing implementations and app-level artifacts may remain isolated for later redesign, but they are not reachable inputs to Requirements, Outline, Style Guide Creation, or Page Authoring in the new flow.
- During this migration the generated Deck and Review views are read-only apart from preview refresh and export. Deck/Page Refinement, rewrite, layout-change, add, duplicate, delete, reorder, and direct page-title editing entry points are hidden; structural changes return through Outline Review and start a new full generation after confirmation.
- Deck Generation Resume is the only user-facing recovery action. The unused `retryPageGeneration` action and separate Page Generation Retry workflow are removed; internal page runners may still execute one Page Generation Unit as an implementation detail without exposing a parallel recovery concept.
- Ordinary Page Authoring may modify only the current Page Source and page-owned assets, never the Workspace Authoring Kit. The current implementation communicates this boundary through layered README guidance and PPT App prompts rather than filesystem permissions, content locks, or compiler restrictions.
- In the first migration, Page Authoring is instructed to modify only the current `slides/<page_id>.tsx`; it must not modify requirements, outline, Style Guide, manifest, progress, Authoring Kit, other Page Sources, or create new asset files. This is a prompt-level convention rather than a filesystem sandbox or multi-file change gate.
- Page Authoring prompts must name every required Workspace file explicitly instead of assuming the Agent will discover or read it. Before using, copying, adapting, or taking inspiration from any Foundation Module or Reference Implementation, the Agent must fully read that component's TSX source; README summaries or filenames alone are not sufficient preparation for authoring the new page.
- Before editing, the Agent is instructed to read the current Page Source, `requirements.json`, `outline.json`, `style-guide.md`, and `authoring-kit/README.md` in that order; it then follows layered README routing and fully reads every Foundation or Reference TSX it intends to use or imitate. The Agent result records `files_read`, `authoring_kit_sources_read`, and `changed_files` for diagnostics only.
- Page Visual Review remains an optional user-enabled stage after a successful render. It reads the rendered screenshot, the Workspace Style Guide, and the current Outline Entry, and judges only visual usability and style-guide fit; it does not receive sealed Style Profile inputs or perform factual, language, or grounding review.
- Page Visual Review is best-effort rather than a final blocking gate. A failed review returns to Page Authoring while its bounded fix budget remains; when that budget is exhausted, the page is accepted with the unresolved review and diagnostic message preserved so Final Deck Render can complete and the user can inspect the result.
