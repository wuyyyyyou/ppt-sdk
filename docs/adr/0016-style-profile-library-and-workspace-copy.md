# Style Profile Library uses Markdown workspace copies

PPT App stores reusable Style Profiles in an app-level Style Profile Library rather than in individual deck Workspaces or the Uploaded Source Material pipeline. A Style Profile is a Markdown guidance file created from Reference Slide Images by an Agent writing into a Style Profile Creation Workspace; only a validated published profile enters the library index, and the published profile may keep its reference images for preview and diagnostics. When a Workspace selects a Style Profile, `ppt-engine` copies only the Markdown guidance and minimal selection metadata into that Workspace so theme generation, page authoring, refinement, and retry use a reproducible Workspace-owned style input even if the global profile later changes or is deleted.

This chooses simple prompt-ready text over a structured style schema, because the first version needs reusable visual guidance rather than a machine-merged design-token model. It also chooses Workspace copies over live global references so existing decks remain reproducible and global profile edits affect only future selections.

Style Profile Creation analyzes at most five Reference Slide Images across the combined ordered reference set for a creation run. When more than five reference images are available, the analyzed set is sampled evenly across that combined ordered set and includes both the first and last image, instead of taking only the first five or taking five per uploaded file.

Selected Style Profiles are injected into Workspace Theme Creation and page authoring flows only. They are not inputs to Page Content Review, Page Visual Review, Research Discovery, Evidence-Aware Page Planning, or uploaded-source analysis, because they are style guidance rather than grounding evidence or a review gate.

The published Markdown guidance is intentionally compact. The first version validates `profile.md` as a non-empty text file between 200 bytes and 8 KB so it remains suitable for repeated prompt injection during page authoring.

Theme generation and page authoring prompts inline the selected Markdown guidance instead of only pointing the model or Agent at the file path. The Workspace file path and selection metadata may still be included for traceability, but the prompt text itself is the authoritative style input.
