# Style Profile Library uses Markdown workspace copies

> Implementation note: Style Profile Creation, library browsing, and Workspace selection are sealed during the first Authoring Kit Page Source migration. This ADR remains the prior domain design for a later dedicated redesign and is not an active input to the migrated Deck Generation flow.

PPT App stores reusable Style Profiles in an app-level Style Profile Library rather than in individual deck Workspaces or the Uploaded Source Material pipeline. A Style Profile is a Markdown guidance file created from Reference Slide Images by an Agent writing into a Style Profile Creation Workspace; only a validated published profile enters the library index, and the published profile may keep its reference images for preview and diagnostics. When a Workspace selects a Style Profile, `ppt-engine` copies only the Markdown guidance and minimal selection metadata into that Workspace so theme generation, page authoring, refinement, and retry use a reproducible Workspace-owned style input even if the global profile later changes or is deleted.

This chooses simple prompt-ready text over a structured style schema, because the first version needs reusable visual guidance rather than a machine-merged design-token model. It also chooses Workspace copies over live global references so existing decks remain reproducible and global profile edits affect only future selections.

Style Profile Creation analyzes at most five Reference Slide Images across the combined ordered reference set for a creation run. When more than five reference images are available, the analyzed set is sampled evenly across that combined ordered set and includes both the first and last image, instead of taking only the first five or taking five per uploaded file.

Selected Style Profiles are injected into Workspace Style Guide Creation only. Page Authoring reads the resulting Workspace Style Guide rather than receiving the Selected Style Profile as a parallel visual authority. Selected Style Profiles are not inputs to Page Visual Review, Research Discovery, Page Evidence Assignment, or uploaded-source analysis, because they are style guidance rather than grounding evidence or a review gate.

The published Markdown guidance is intentionally compact. The first version validates `profile.md` as a non-empty text file between 200 bytes and 8 KB so it remains suitable for repeated prompt injection during page authoring.

Workspace Style Guide Creation inlines the selected Markdown guidance instead of only pointing the model at the file path. The Workspace file path and selection metadata may still be included for traceability, but Page Authoring receives only the resulting Workspace Style Guide.
