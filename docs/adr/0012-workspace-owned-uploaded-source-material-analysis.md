# Workspace-owned Uploaded Source Material analysis

Deck authoring will support user-uploaded source files as Workspace-owned Uploaded Source Material. Uploaded files are saved and indexed as Workspace artifacts from upload time; their identity is a stable uploaded-source id, not the original filename, so same-name or same-content uploads can remain distinct. Deleting an attachment removes it from the active uploaded-source set by default rather than making filename reuse overwrite older material. The first version uses an allowlist and size limits instead of accepting arbitrary files.

Uploaded Source Material is not Raw Research Material and is not Research Evidence by itself. The app will not run a fixed extraction pipeline for Excel, Word, HTML, or other supported files before analysis. Instead, Uploaded Source Factual Analysis and Uploaded Source Visual Analysis run in separate Agent sessions that receive the uploaded artifact paths and decide how to inspect them with available session tools. Each Agent writes a draft; app code applies deterministic draft gates and merges valid drafts into a deck-level Uploaded Source Analysis. A valid draft may report that some uploaded material could not be parsed or understood and still allow continuation through a structured continuation decision. Agent session failure, missing drafts, invalid drafts, or missing continuation decisions are analysis failures.

Uploaded Source Analysis may inform Outline Creation and Evidence-Aware Page Planning, but Page Authoring must not read the full Uploaded Source Analysis as a grounding source. Evidence-Aware Page Planning should prioritize assigning relevant uploaded-source facts and visual assets, use uploaded-source factual content as fully as the deck intent, requested page count or structure, and page readability allow, and materialize only assigned uploaded-source evidence into page-level Research Evidence. Research Discovery treats Uploaded Source Analysis as prior source context and searches only for unresolved gaps, required current external facts, public benchmarks, or additional visual assets.

**Considered Options**

- Treat uploaded files as Raw Research Material. Rejected because user-provided files have a different trust and lifecycle boundary from web/image search results, and they must inform Outline Creation before Research Discovery exists.
- Let Page Authoring read full Uploaded Source Analysis directly. Rejected because it would bypass page-level evidence assignment and reintroduce a deck-level grounding pool into page authoring.
- Run a deterministic app-side extraction pipeline before Agent analysis. Rejected for this design because the intended behavior is to rely on Agent session capabilities to inspect supported uploaded artifacts, while app code owns persistence, indexing, path handling, stale checks, draft gates, and merging.
- Use original filenames as uploaded material identity or dedupe same-name/same-content uploads automatically. Rejected because filenames are display metadata, not stable identity, and automatic dedupe would obscure user operation history and replacement/deletion semantics.
- Merge uploaded factual and visual analysis into one Agent draft. Rejected for the same reason Research Curation drafts are split: factual evidence and visual-asset judgment have different failure modes and must not promote image text or chart content as factual evidence unless separately captured.

**Consequences**

- Uploading requires a Workspace; if none exists, the app must create or select one before saving Uploaded Source Material.
- Uploading, removing, or replacing Uploaded Source Material makes existing Uploaded Source Analysis stale and requires dependent Outline Drafts or Confirmed Outlines to be regenerated or reconfirmed before downstream generation uses the changed material.
- Uploaded Source Analysis introduces a blocking pre-outline failure path when the user explicitly depends on uploaded material and no valid continuation decision allows generation to proceed.
- Page-assigned Research Evidence remains the Page Authoring grounding boundary, even when evidence originates from uploaded files.
- The app must expose uploaded-source indexing, active/removed status, duplicate warnings, Agent file-tool paths, draft validation, and analysis freshness without implementing format-specific content extraction as the default path.
