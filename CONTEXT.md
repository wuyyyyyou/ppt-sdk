# PPT App Glossary

This context defines the project language for the PPT authoring workflow and keeps the terms stable across UI, prompts, and artifacts.

## Language

**Workspace**:
The container for one PPT request and its artifacts.

**Brief**:
The user's initial input that describes what the deck should cover.
User-facing Chinese label: 需求描述

**Presentation Requirements**:
The Workspace-owned structured requirements for a Deck, derived from the Brief and resolved through user choices. They contain an explicit audience, purpose, desired outcome, positive page count, output language, and visual tone; the user's later explicit choices override the corresponding expression in the Brief, while Outline Review may synchronize the page count to the saved Outline without changing the other requirements.
User-facing Chinese label: 演示需求
_Avoid_: Context, Background

**Presentation Requirements Draft**:
A Workspace-owned set of ordered candidate Presentation Requirements and current selections that remains open to user review and editing across app sessions. The first candidate for each field is recommended and may be selected by default without making the requirements confirmed.
_Avoid_: Confirmed Presentation Requirements

**Presentation Requirements Candidate**:
A selectable proposed value within a Presentation Requirements Draft. Each field has one candidate when the Brief is explicit and two to four materially distinct candidates only when genuine ambiguity remains; semantic candidates pair a concise label with a one-sentence description, while page-count and output-language candidates are simple values.

**Confirmed Presentation Requirements**:
The complete Presentation Requirements accepted by the user as the primary constraints for downstream creation; page count and output language are always concrete rather than automatically deferred. A draft may carry a replaceable Visual Style Preset identity, but only confirmation creates the Workspace's authoritative preset snapshot and style guidance. Any later field change, including changing or clearing a Visual Style Preset, returns them to a draft until the whole set is confirmed again, except that saving a valid Outline synchronizes `slide_count` to the Outline entry count while the requirements remain confirmed; the Brief remains the original source record without overriding a conflicting confirmed field.

**Presentation Requirements Creation**:
The explicit user-requested process that derives a new Presentation Requirements Draft solely from the current Brief and current Visual Style Preset choice. It may infer missing requirements but never content facts; when a preset is selected, the process does not generate or alter Visual Tone, and when no preset is selected, Visual Tone remains an inferred and editable requirement. Changing or clearing the preset requires a new creation before the prior draft may be reviewed again. Each resulting draft retains its source Brief and preset snapshot, and a successful new creation replaces and persists the current review draft as a whole while a failed attempt leaves it unchanged. Later review edits are persisted only when the user explicitly saves or confirms them.

**Presentation Requirements Review**:
The required user step where every Presentation Requirements field is resolved from generated candidates or manual entry and the whole set is explicitly confirmed by the user; it is never skipped automatically. Default selections remain a draft until this confirmation action occurs. Editing does not auto-save: Save persists a draft, while confirmation saves the complete set as confirmed before downstream work begins.
User-facing Chinese label: 确认演示需求

**Presentation Purpose**:
The use scenario and task the Deck is intended to serve, such as an investor pitch, operating review, or training session.
User-facing Chinese label: 用途
_Avoid_: Goal

**Desired Outcome**:
The intended change in the audience's understanding, attitude, decision, or action after experiencing the Deck.
User-facing Chinese label: 预期效果
_Avoid_: Goal

**Visual Tone**:
The qualitative visual character requested for a Deck when no Visual Style Preset is selected; it may use a recognizable editorial or cultural reference and describe visual intensity, headline character, compositional feel, and intended reading experience without fixing exact colors, typography, templates, or page layouts. It is an input to Workspace Style Guide Creation rather than a Style Profile or Workspace Style Guide.
User-facing Chinese label: 视觉气质
_Avoid_: Theme, Template, Style Guide

**Visual Style Preset**:
A selectable, reusable visual direction for a Deck. It has a user-facing name, a concise description, and one complete visual guidance document that may prescribe shared placement and composition tendencies but never an executable page template, fixed content, or code dependency; when selected, its name and description replace the independently editable Visual Tone in Presentation Requirements, while its preview images communicate the choice to the user but are not visual or factual inputs to Page Authoring. A Workspace keeps the confirmed preset snapshot even if the catalog later removes or disables that preset.
User-facing Chinese label: 模板
_Avoid_: Template Group, Executable Template, Template Catalog

**Outline**:
A Workspace-owned presentation title and ordered list of slide-level Outline Entries. It has an `empty`, `draft`, or `confirmed` lifecycle and does not own output language, template selection, or visual theme creation.

**Outline Entry**:
The content intent for one planned slide, consisting of a one-line title, a one-line Core Message, and Required Content expressed as a Markdown bullet list. An Outline Draft entry has no page identity; Outline Confirmation assigns a stable opaque `page_id` for the lifetime of that Confirmed Outline and its Deck Generation.

**Core Message**:
The single idea the audience should remember from an Outline Entry; on an analytical page it will usually be the page's core conclusion.
User-facing Chinese label: 核心信息
_Avoid_: Page Summary, Speaker Note

**Required Content**:
The non-empty set of content requirements that a generated page must cover, stored as a Markdown string whose primary structure is unordered bullet points with optional nested bullets. It describes required coverage rather than final page copy or layout.
User-facing Chinese label: 必要内容
_Avoid_: Final Copy, Page Layout

**Outline Draft**:
A complete and deterministically valid Outline that is still open to user confirmation. Manual edits remain local until explicitly saved, while a successful Rewrite Request saves the resulting Outline Draft automatically.

**Confirmed Outline**:
An Outline accepted by the user for downstream generation. Confirming it first saves and validates the current content, then automatically starts the downstream workflow; any later saved content change returns it to an Outline Draft.

**Outline Review**:
The required user step where an Outline Draft is directly edited, reordered, expanded, reduced, saved, or revised through a Rewrite Request before explicit confirmation. It is never skipped, and saving synchronizes the confirmed Presentation Requirements page count to the current Outline entry count.

**Outline Creation**:
The process that automatically starts after Presentation Requirements Confirmation and creates a new Outline Draft from the current Confirmed Presentation Requirements. It uses the source Brief only through those requirements, treats their explicit selections as authoritative over conflicting Brief wording, and does not perform template selection or visual theme creation.

**Rewrite Request**:
A natural-language instruction used to revise the currently displayed Outline Draft, including unsaved manual edits. A successful revision must be complete and valid, may add, remove, merge, split, or reorder entries, and is saved automatically; failure preserves the displayed Outline unchanged.

**Outline Confirmation**:
The explicit user action that first preserves the currently displayed content as the current Outline Draft, then validates every entry, assigns a new opaque `page_id` to every entry, marks the run's Outline confirmed, and automatically starts the downstream workflow. If that first Deck Generation is abandoned, the confirmation does not become current and the preserved Outline Draft remains; otherwise, when an existing Deck is present, successful Generation Commit replaces its current generation state and page identities rather than maintaining parallel Deck versions.

**Authoring Kit**:
The released page-authoring foundation used to initialize Deck Generation work. It provides a stable Page Source Bootstrap together with reusable foundations and reference guidance, but it is not a selectable visual style and does not determine a Deck's final visual identity.
_Avoid_: Template, Template Catalog

**Workspace Authoring Kit**:
A Workspace-owned, read-only snapshot of the Authoring Kit used to create and reproduce that Workspace's pages. Page Authoring cannot modify it, and later Authoring Kit releases never change it implicitly.
_Avoid_: Live Authoring Kit Reference, Selected Template

**Foundation Module**:
A stable, supported module in the Workspace Authoring Kit that Page Sources may import for reusable authoring capabilities. Only foundational, broadly applicable technical or low-level presentation behaviour belongs here; a Foundation Module never prescribes page composition.
_Avoid_: Reference Implementation, Template Component

**Reference Implementation**:
A read-only example in the Workspace Authoring Kit that demonstrates a presentation technique or visual pattern for an Agent to inspect, copy, decompose, or rewrite. Page Sources do not import Reference Implementations as dependencies, and their interfaces are not compatibility contracts.
_Avoid_: Foundation Module, Blueprint, Importable Reference Component

**Reference Library**:
The read-only, hierarchically documented collection of Reference Implementations in the Workspace Authoring Kit. Agents navigate it through layered README guidance; it has no catalog, registry, selectable identity, or engine-level discovery semantics.
_Avoid_: Template Catalog, Blueprint Registry, Reference Registry

**Page Source Bootstrap**:
The stable, engine-owned minimal TSX resource used to initialize a new Page Source. It contains only the required fixed slide canvas and export behaviour, carries no content, page metadata, style guidance, or prescribed composition, and is not part of the Workspace Authoring Kit snapshot.
_Avoid_: Blueprint, Blank Template Layout, Example Slide

**Workspace Style Guide**:
The Workspace-owned Markdown style guidance artifact that defines the Deck's shared visual direction, including exact values, qualitative rules, and allowed page-level variation. It guides Page Authoring rather than configuring rendering at runtime, and changing it makes affected Page Sources stale until they are re-authored.
User-facing Chinese label: 艺术指导
_Avoid_: Workspace Theme Token, Runtime Theme, Preset Theme

**Workspace Style Guide Creation**:
The required automatic generation-time step that synthesizes the original Brief, Confirmed Presentation Requirements, and Confirmed Outline into the Workspace Style Guide before Page Authoring. The Brief remains original user context, while later confirmed requirements and outline decisions override conflicting Brief wording; there is no separate user confirmation step, and failure leaves Page Authoring blocked until creation succeeds.
_Avoid_: Workspace Theme Creation, Theme ID Selection, Preset Theme Selection

**PPTX Rasterization**:
The process that turns a user-provided PPTX into page-level images for visual inspection. It is a reusable preparation step and is not itself Style Profile Creation or Uploaded Source Analysis.
_Avoid_: PPT parsing, PPT import, PPT analysis

**Reference Slide Image**:
A PNG page image produced from reference material so an Agent can inspect visual style. Reference Slide Images may guide Style Profile Creation, but they are not factual grounding evidence for Page Authoring.
_Avoid_: Research Evidence, Visual Research Evidence

**Style Profile**:
A reusable textual visual style guide created from reference slide images or uploaded style-reference images. It can guide Workspace Style Guide Creation, but it does not preserve factual content from its references and is not Research Evidence, Uploaded Source Material, an Authoring Kit, a Workspace Style Guide, or an Agent Skill.
_Avoid_: Research Evidence, Uploaded Source Material, Authoring Kit, Template, Skill

**Style Profile Library**:
The app-level collection of reusable Style Profiles available across Workspaces. It is separate from Workspace-owned artifacts, Research Evidence, and the Authoring Kit.
_Avoid_: Workspace, Authoring Kit, Template Catalog

**Style Profile Creation Workspace**:
A temporary app-level work area used while creating one Style Profile from reference material. It is not a deck Workspace and does not participate in Outline Creation, Uploaded Source Analysis, Research Discovery, or Deck Generation.
_Avoid_: Workspace, Uploaded Source Material

**Selected Style Profile**:
A Workspace-owned copy of the Style Profile guidance chosen for that Workspace. It preserves the reusable guidance used by Workspace Style Guide Creation even if the original Style Profile later changes; changing or clearing it makes the current Workspace Style Guide and affected Page Sources stale.
_Avoid_: Live Style Profile Reference

**Style Profile Creation**:
The process that turns reference slide images or uploaded style-reference images into a reusable Style Profile. It is separate from Deck Generation and does not produce a Deck.
User-facing Chinese label: 创建风格画像
_Avoid_: Deck Generation, Uploaded Source Analysis

**Research Discovery**:
The deck-level iterative process that decides what external material is still needed, collects candidate web and image material, curates it into Research Evidence, and stops when enough useful evidence has been collected or the iteration limit is reached. It happens before Page Generation Units are authored. When Uploaded Source Analysis exists, Research Discovery treats it as prior source context and should search only for unresolved gaps, required current external facts, public benchmarks, or additional visual assets. Web material is discovered before visual material so image needs can be informed by curated facts and insights; visual material does not become factual evidence by itself. Interrupted Research Discovery work is not complete discovery work and must not be promoted into the Research Discovery Evidence Pool.
User-facing Chinese label: 事实收集
_Avoid_: Research Planning

**Research Discovery Evidence Pool**:
The deck-level curated evidence pool produced during Research Discovery before evidence is assigned to Page Generation Units. It supports further Research Discovery decisions and Page Evidence Assignment, but it is not by itself an allowed grounding source for Page Authoring.
_Avoid_: Shared Research Evidence, Page Research Evidence

**Research Collection Ledger**:
A Workspace-owned record of which web and image query intents have already been collected during Research Discovery or later refinement research. It is used to avoid repeating completed query intents while preserving existing Research Evidence; interrupted research work must not make a query intent count as completed collection.

**Research Search Control**:
A Workspace-level or run-level user preference that disables new web or visual external search and fetch during Research Discovery. It does not disable reuse of existing Research Evidence, Page Evidence Assignment, Uploaded Source Material, or Uploaded Source Analysis.
_Avoid_: Disable evidence, disable uploaded sources

**Research Requirement**:
The decision that more external material is needed because the deck or a refinement target depends on real-world facts, current information, source-backed data, or external visual assets that are not already available in Research Evidence.

**Research Evidence Gap**:
A case where Research Discovery, Research Curation, or Page Evidence Assignment cannot produce enough Research Evidence for a requested deck or page intent. It does not block Page Generation and does not make completed research work partially failed; unsupported concrete details must be omitted, generalized, or marked as TBD / 待补充. Reaching a Research Discovery iteration limit may produce a Research Evidence Gap. Generation Abandonment or interruption during research is unfinished work, not a Research Evidence Gap.

**Page Evidence Assignment**:
The deck-level step after Research Discovery that assigns relevant facts, derived insights, and visual assets to Page Generation Units and directly materializes page-assigned Research Evidence before Page Authoring. It does not create a Page Plan, choose page composition, modify the Confirmed Outline, or make Raw Research Material or full Uploaded Source Analysis a Page Authoring grounding source.

**Raw Research Material**:
External material collected by search, fetch, or image lookup before cleanup or selection. It is not grounding evidence until promoted into Research Evidence.
_Avoid_: Evidence, source of truth

**Uploaded Source Material**:
User-provided files uploaded into a Workspace as source material for the requested deck, such as documents, spreadsheets, images, or HTML. Uploaded Source Material is Workspace-owned from upload time; it is not a browser-temporary input that can silently move between Workspaces. Its identity is stable and not derived from the original filename, so files with the same display name can still be distinct uploaded materials. Uploaded Source Material is not Raw Research Material and is not Research Evidence by itself. It must be analyzed or curated before its facts or visual assets can be used as grounding evidence in deck generation.
User-facing Chinese label: 上传资料
User-facing English label: Source material

**Uploaded Source Analysis**:
A deck-level analysis result produced from Uploaded Source Material before Outline Creation or Deck Generation uses the uploaded material. It captures selected factual content, visual asset understanding, source-use constraints, gaps, and rejected or unusable material. Uploaded Source Analysis may inform Outline Creation and later evidence assignment, but it is not the same artifact as the Research Discovery Evidence Pool. It combines the continuation decisions from the factual and visual analysis drafts into the overall decision about whether Outline Creation may continue. When the Uploaded Source Material set or file content changes, existing Uploaded Source Analysis becomes stale, and any Outline Draft or Confirmed Outline that depended on it must be regenerated or reconfirmed before downstream generation uses the changed material.

**Uploaded Source Analysis Continuation Decision**:
A structured decision inside a valid Uploaded Source Analysis result that states whether downstream Outline Creation may continue when some Uploaded Source Material could not be fully parsed or understood. The decision is valid only after the analysis draft itself has been written and passed deterministic validation. Agent session failure, missing or invalid analysis drafts, or missing continuation decisions are analysis failures, not continuable uploaded-source gaps.

**Uploaded Source Factual Analysis Draft**:
An intermediate analysis result that selects factual claims, tables, metrics, source excerpts, gaps, and rejected material from Uploaded Source Material. It owns the continuation decision for factual uploaded-source analysis. It must not select visual assets for page use.

**Uploaded Source Visual Analysis Draft**:
An intermediate analysis result that interprets images, screenshots, charts, diagrams, and other visual material found in Uploaded Source Material, including suitability for PPT use and user-provided use constraints. It owns the continuation decision for visual uploaded-source analysis. Uploaded images and embedded visuals are not page-usable Visual Research Evidence until selected through Uploaded Source Visual Analysis and later assigned to a page. It must not promote visual text or chart content as factual evidence unless that content is separately captured by factual analysis.

**Research Curation**:
The step that turns Raw Research Material into Research Evidence by selecting relevant facts, sources, and visual assets for a Page Generation Unit.

**Research Curation Draft**:
An intermediate curation result selected from Raw Research Material before it is promoted into a Research Discovery Evidence Pool or page-assigned Research Evidence. Drafts from interrupted research work are not valid inputs for Research Evidence until the research stage is completed again.

**Web Research Curation Draft**:
A Research Curation Draft that contains candidate factual evidence, source judgments, derived insights, rejected material, and gaps from web material.

**Visual Research Curation Draft**:
A Research Curation Draft that contains candidate visual assets, visual judgments, rejected material, and gaps from image material.

**Research Log**:
A Workspace-owned diagnostic record of Research Discovery, Research Collection, Research Curation, and Page Evidence Assignment activity. It is separate from Page Generation Stage Records and is used for troubleshooting evidence decisions.

**Research Evidence**:
Curated facts, sources, and visual assets selected from Raw Research Material for use in Page Generation. Page-assigned Research Evidence is materialized for one Page Generation Unit from the Research Discovery Evidence Pool and evidence-assignment decisions. It is an allowed grounding source for generated page content.
_Avoid_: Raw search results, raw crawl output

**Visual Research Evidence**:
A curated visual asset selected for a Page Generation Unit because it fits the page intent and is visually usable. Text, charts, or claims visible inside the asset are not grounded facts unless separately captured as Research Evidence.

**Shared Research Evidence**:
Curated deck-level material that can support multiple Page Generation Units without belonging exclusively to one page.

**Deck**:
The finished presentation content before export.

**Stale Deck**:
A deck that was generated from an earlier Confirmed Outline, Workspace Authoring Kit, Workspace Style Guide, style input, or setting and should not be presented as current until regenerated.

**Deck Generation**:
The process that turns a confirmed outline into presentation pages; it does not include outline creation from a brief.

**Deck Generation Public Facade**:
The stable app-facing entry boundary for Deck Generation, Deck Generation Resume, Generation Abandonment, and future refinement workflows. It exposes the workflow capabilities without owning their internal workflow decisions.
_Avoid_: Workflow implementation, orchestration module

**Active Deck Generation**:
A deck generation process that is currently running; the official Workspace's presentation content is frozen during this period and is replaced only by successful Generation Commit.

**Interrupted Deck Generation**:
A Deck Generation that is neither running nor finished, with the Workspace Style Guide, research, evidence assignment, or Page Source preparation not yet ready, one or more Page Generation Units not yet accepted, or final Deck artifacts not yet ready, and no page actively authoring. It can be resumed as the same run while keeping accepted pages, and the Workspace state that preceded the run remains current until Generation Commit succeeds.
_Avoid_: Abandoned Generation — Generation Abandonment permanently discards its run rather than creating resumable work.

**Unresumable Deck Generation**:
A Deck Generation that cannot be safely resumed because the authoritative pre-run Workspace artifacts are missing, stale, invalid, or inconsistent with the run state. The run ends without replacing the pre-run Workspace, and the user must correct or recreate its authoritative inputs before starting a new run.
_Avoid_: Failed Deck when the issue is an artifact or state blocker rather than a Page Generation failure.

**Generation Step**:
A visible part of deck generation, such as creating the Workspace Style Guide, discovering or assigning evidence, preparing Page Sources, authoring a page, rendering, visual review, or final rendering.

**Final Deck Render**:
The deck-level Generation Step that turns the current accepted version of every Page Generation Unit into final previewable page artifacts and one ordered Deck-level Rendered HTML Snapshot. A current Manual Page Revision participates in place of that page's Page Source render; Final Deck Render is not owned by any single Page Generation Unit, and Deck Generation is not complete until it has succeeded.

**Page Generation Unit**:
One planned page being authored, rendered, optionally manually revised, and optionally visual-reviewed as an independent part of Deck Generation. It owns exactly one stable Page Source, at most one current Manual Page Revision, and that page's content and page-level assets; shared deck structure and Workspace Authoring Kit assets belong outside the unit.
Its stable identity is the Confirmed Outline entry's `page_id`; the identity is never reused, while page index is ordering rather than identity.

**Page Source**:
The Workspace-owned TSX entry point and authoritative authoring source for exactly one Page Generation Unit. Its accepted render is the current page unless a Manual Page Revision supersedes it; the Confirmed Outline provides intent and Research Evidence provides factual grounding without acting as separate render data.
_Avoid_: Deck Source, Shared Page Entry, Template Layout, Page Data JSON

**Manual Page Revision**:
A Workspace-owned, user-confirmed content and visual revision of exactly one Page Generation Unit created after its Page Source has rendered. While present it is that page's current version, and its explicitly saved text and numbers are user-provided content; it remains current until the user restores the Page Source version, a full Deck Generation replaces the page identity, or accepted Page Authoring supersedes it.
User-facing Chinese label: 人工页面修订
_Avoid_: HTML Override, Edited Snapshot, Manual Draft

**Rendered HTML Snapshot**:
The Workspace-owned, engine-generated static DOM representation captured after Page Sources have completed browser rendering at the fixed slide viewport. A Page Generation Unit owns one page snapshot, while Final Deck Render produces a separate ordered Deck snapshot in which every accepted page is simultaneously available to whole-Deck consumers; both are rebuildable derived artifacts rather than authoritative Page Authoring sources, and neither carries interactive viewing behaviour.
User-facing Chinese label: 渲染后 HTML 快照
_Avoid_: Page Source, Executable React HTML, Runtime HTML

**Render Readiness**:
The condition in which all tracked dependencies affecting visible content have settled and the rendered DOM and layout are stable enough to capture. A Rendered HTML Snapshot may be published only after this condition is reached; timeout, interruption, or Generation Abandonment leaves rendering unfinished and produces no partial snapshot.
User-facing Chinese label: 渲染就绪
_Avoid_: Fixed Settle Time, Best-effort Ready

**Deck Manifest**:
The engine-owned, rebuildable rendering index that maps the current Confirmed Outline page sequence to Page Sources. It carries no page-planning, evidence-assignment, generation-state, or authoring decisions and is not edited by an Agent.
_Avoid_: Page Plan, Page Source of Truth, Agent-authored Manifest

**Active Page Generation**:
A Page Generation Unit that has started and has not yet reached an accepted, failed, or interrupted terminal state. Its live stream may be shown while it is active.

**Deck Generation Progress**:
The aggregate progress of an Active Deck Generation across all Page Generation Units. It describes counts and overall state rather than naming one current page.

**Page Progress**:
The Workspace-owned persisted execution state for Deck Generation, keyed by Outline Entry `page_id`. It owns deck/page recovery state and the latest successful rendered HTML and screenshot references, while page title and order remain projected from the Confirmed Outline.
_Avoid_: Pages Index, Deck Content Source

**Live Page Stream**:
The visible stream for an Active Page Generation. It shows the current page run while that page is still active.

**Page Generation Stage Record**:
The user-facing record of what happened within one Page Generation Unit across stages such as authoring, rendering, review, and fixing. It may include live or completed agent output, but it is presented as page work rather than as session history.

**Page Visual Review**:
The optional, user-enabled Page Generation check that judges whether a rendered page screenshot is visually usable as a PPT page, including layout completeness, readability, overlap, cutoff, contrast, missing or broken visuals, unintended blank areas, and fit within the canvas. It does not read or judge the Workspace Style Guide or Visual Style Preset, and does not review factual grounding, output language, or content correctness; after its bounded automatic fix attempts are exhausted, the page is accepted with the unresolved review recorded so the user can inspect the completed Deck instead of being blocked.
_Avoid_: Self Review when referring to the visual-only screenshot check.

**Generation Session History**:
The collapsed-by-default record of completed agent runs from Deck Generation. It is historical context, not the primary place for Live Page Streams, and abandoned runs remain diagnostic-only rather than appearing as resumable or completed generation history.
_Avoid_: User-facing labels such as "Session History" when the record is really page generation work.

**AI Interaction Log**:
A Workspace-owned diagnostic record of each LLM completion or Agent run used to produce, revise, inspect, or repair deck artifacts, including runs later abandoned by the user. It is for troubleshooting and auditability, separate from user-facing Generation Session History.
_Avoid_: Session History, Live Page Stream

**Workspace Storage Transfer Log**:
A Workspace-owned diagnostic record of Host Upload and APS Files transfer activity associated with the Workspace, including transfer lifecycle phases, source operation associations, storage identifiers, and failure responses. It is separate from AI Interaction Logs and does not store file contents; it exists to trace transport and persistence boundaries for troubleshooting.
_Avoid_: Agent Session Log, Export History, Uploaded Source Material

**Failed Page Generation**:
A Page Generation Unit that reached a terminal state without becoming accepted after its automatic recovery attempts are exhausted or manual review is required. Its run and accepted pages remain available for retry while the pre-run Workspace stays current; only Generation Abandonment discards them, and Generation Commit cannot begin until every failed page is resolved.

**Interrupted Page Generation**:
A Page Generation Unit that was Active but whose run is no longer owned by any process because the app exited or lost the run before the unit reached an accepted or failed verdict, including interruption during Research Collection or Research Curation. It is unfinished in intent but terminal in fact: no run is advancing it, so it must be explicitly resumed or retried.
_Avoid_: Abandoned Page — Generation Abandonment discards the whole run rather than leaving resumable page state. Distinguish from Failed Page Generation, which exhausted recovery or needs review.

**Agent Session Cache Miss**:
A transient Agent Session infrastructure failure where the platform cannot continue an Agent run because the app session authorization is unavailable. It is treated as infrastructure failure, not as a Page Generation content or render failure.

**Deck Refinement**:
A user-requested revision of an accepted Deck as a whole after Deck Generation. It may update deck-level context, output language, Confirmed Outline, page-assigned Research Evidence, and selected Page Generation Units while preserving unaffected accepted pages when safe.
When the Confirmed Outline changes without changing output language, only Page Generation Units whose outline intent changed are affected unless the request explicitly asks for a global style, language, or narrative rewrite.
Deck Refinement preserves the Deck title unless the request explicitly changes it. A changed title updates the Workspace and active Confirmed Outline authorities but affects only the Page Generation Units that the reconciliation identifies as needing to express the new title.
An explicit output-language change updates the Confirmed Presentation Requirements, rewrites the active Confirmed Outline in the new language, and makes every retained Page Generation Unit a refinement target. Merely using foreign terms or examples does not change the Deck output language.
Deck Refinement does not change the Confirmed Presentation Requirements audience, purpose, desired outcome, or visual tone. Its final page count is synchronized from the reconciled Confirmed Outline rather than decided as a separate requirement update.
Deck Refinement preserves the current Workspace Style Guide unless the request changes the Deck's shared visual direction. In a Workspace with a confirmed Visual Style Preset, the preset's Style Guide is immutable: a shared visual request may override it for targeted Page Generation Units through the active Deck Refinement Request, but never replaces the Workspace Style Guide. Without a confirmed preset, replacing the Workspace Style Guide makes every retained Page Generation Unit a refinement target, while page-local visual changes leave the shared guide unchanged.
For retained Page Generation Units, Deck Refinement preserves the existing Page Source; requested layout changes are handled by Page Authoring against that source.
New Page Generation Units introduced during Deck Refinement are initialized from the engine's Page Source Bootstrap because they do not yet have a Page Source.
Deleted Page Generation Units are removed from the current Confirmed Outline, progress, manifest, and render artifacts, but their old workspace files may remain as unreferenced artifacts.
Deck Refinement uses the active request and existing Workspace material as its available grounding. It does not invent unsupported facts, numbers, dates, names, claims, or source-dependent visuals when that material is insufficient.
Target Page Generation Units in Deck Refinement receive both the deck-level request and a page-level refinement reason so page authoring can preserve useful existing work while applying the whole-deck change.
Deck Refinement outline reconciliation is operation-based so retained Page Generation Units keep their `page_id` identity across keep, update, add, and delete decisions.
The final operation order owns the resulting page order, so retained Page Generation Units may move without changing identity. Deck Refinement should add, delete, or reorder Page Generation Units only when the request explicitly asks to change page count, structure, sequence, section organization, or narrative flow; ordinary quality or whole-deck improvement requests preserve page count and order.
_Avoid_: Starting a new Deck Generation when accepted pages can be preserved.

**Deck Refinement Request**:
The user's active instruction for revising an accepted Deck as a whole. It may explicitly change the Deck title, output language, page structure, page intents, or shared visual direction, while requirement fields other than output language remain unchanged.

**Deck Refinement Planning**:
The pre-commit decision process that reconciles a Deck Refinement Request into the resulting Deck title, output-language decision, ordered page operations, complete changed or added Outline Entries, shared Style Guide decision when the Workspace has no Visual Style Preset, and page-level refinement reasons. With a confirmed preset, the planning result keeps the preset Style Guide and still identifies every Page Generation Unit affected by the active request. It does not author Page Sources and preserves page count and order unless the request explicitly authorizes structural change.

**Deck Refinement Resume**:
The user action that continues an unfinished Deck Refinement from persisted deck-level decisions and target pages. It does not reinterpret completed context, outline, evidence-assignment, or research-routing decisions as a new request.
The committed target Page Generation Units already own their refinement execution states, while the persisted Deck Refinement Request and page-level reasons preserve the authoring intent needed to continue without replanning.

**Deck Refinement Preparation**:
The visible pre-commit phase of Deck Refinement that derives the complete page reconciliation and, when allowed, a replacement Workspace Style Guide without changing the accepted Deck's authoritative artifacts. A confirmed Visual Style Preset never allows Style Guide replacement; a recoverable preparation failure keeps the same run available to retry the failed stage, while invalid authoritative inputs make the run unresumable.

**Deck Refinement Commit**:
The tool-call-level transition that accepts a prepared Deck Refinement decision as the Workspace's new active generation state, including its reconciled Confirmed Outline, any permitted Workspace Style Guide decision, target Page Generation Units, and recovery state. A confirmed Visual Style Preset keeps its Style Guide unchanged. Deck Refinement Resume applies only after this transition has succeeded.

**No-op Deck Refinement**:
A Deck Refinement whose review and reconciliation steps determine that no workspace artifacts or Page Generation Units need to change. It completes without rerunning page authoring or final deck render.

**Deck Refinement Context Review**:
The deck-level portion of Deck Refinement Planning that decides whether the request explicitly changes output language or the shared visual direction. An output-language change updates only that Confirmed Presentation Requirements field and the active Confirmed Outline. Without a confirmed Visual Style Preset, a shared visual-direction change may replace the Workspace Style Guide; with a confirmed preset, the request instead remains a page-authoring override and leaves the preset Style Guide unchanged. The original Brief and all other confirmed requirement fields remain unchanged.

**Page Refinement**:
A user-requested revision of one or more accepted Page Generation Units after Deck Generation that re-authors only the target Page Sources without modifying the Confirmed Outline or Workspace Style Guide. The current target Outline Entry and Workspace Style Guide remain the original creation baseline, while the active Page Refinement Request is authoritative wherever it conflicts with either baseline.
_Avoid_: Deck Generation Resume, Page Visual Review, Visual Review Fix

**Page Refinement Request**:
The user's active instruction for a Page Refinement during the current run. It overrides conflicting target Outline Entry or Workspace Style Guide guidance for the target page without modifying those baseline artifacts; the request and existing Workspace material are the only factual grounding available to the refinement, and the resulting page must not invent unsupported facts, numbers, dates, names, claims, or source-dependent visuals.
_Avoid_: Visual Review Issue, Rewrite Request

**Page Refinement Resume**:
The user action that continues an unfinished Page Refinement using the same persisted Page Refinement Request and the same target pages. It preserves non-target accepted pages and does not reinterpret the refinement as a new request.

**Page Refinement Visual Context**:
The last successful rendered screenshot preserved for a target page when Page or Deck Refinement resets that page's execution state. It is an optimization-before baseline for visual and layout changes until a new successful render replaces it, but text, numbers, charts, and claims visible in it are not grounding evidence unless separately present in allowed sources.

**Deck Generation Resume**:
The user action that continues the same unfinished Deck Generation by completing missing Workspace Style Guide, research, evidence-assignment, or Page Source preparation work, re-running any Page Generation Unit that is not accepted yet, including Interrupted Page Generations, pending pages, infrastructure failures, and Failed Page Generations, or by continuing Final Deck Render when all pages are accepted but final Deck artifacts are not ready. It keeps accepted pages from that run without replacing the pre-run current Workspace until Generation Commit succeeds; an unfinished page keeps its previous state until its resumed work actually starts.
_Avoid_: Regenerate, Restart — those discard accepted pages and start the whole Deck over.

**Generation Abandonment**:
The explicit user-confirmed action available throughout an active Deck Generation, Page Refinement, or Deck Refinement before its final commit; it permanently discards that run and returns to the Workspace state that preceded it. An abandoned run cannot be resumed or prevent a new run from starting, and any work that finishes afterward cannot become current Workspace content or final Deck artifacts.
User-facing Chinese label: 停止
_Avoid_: Cancellation, Pause, Interrupted Generation

**Generation Commit**:
The final transition that makes a fully prepared Deck Generation, Page Refinement, or Deck Refinement result current in its Workspace. Generation Abandonment may win before this transition begins and is unavailable while the commit is running; if the commit fails, the result never becomes current and the Workspace returns to its pre-run state after the user acknowledges the failure.
_Avoid_: Page Acceptance, Final Deck Render

**Export Artifact**:
A final PPTX or PDF produced from a Workspace for the user to download. The Workspace-owned file remains authoritative even when a separate downloadable copy exists.

**Export Artifact Mirror**:
A PPT App-internal downloadable copy of an Export Artifact stored under an internal path in the user's APS Files namespace. A Workspace has at most one current mirror per export format; replacing it does not create Export History. Its `user` storage scope is a transport constraint and does not by itself make it a My Files Export or create a user-facing file record.
_Avoid_: User File, My Files Export

**Export Download Preparation**:
The process that makes an Export Artifact downloadable by creating its current Export Artifact Mirror. Its failure leaves the Export Artifact intact and may be retried without regenerating the export.
_Avoid_: Export Generation

**My Files Export**:
A user-owned copy of an Export Artifact explicitly saved for reuse outside the PPT App. It is distinct from the PPT App-internal Export Artifact Mirror and requires an explicit user action.
_Avoid_: Export Artifact Mirror

**Workspace Diagnostic Bundle**:
A temporary downloadable archive containing the contents observed while collecting one official Workspace for troubleshooting and, when present, its current foreground or interrupted generation transaction and complete shadow Workspace. It may be collected while generation is active, is not an atomic point-in-time snapshot, changes no Workspace, creates no Diagnostic Bundle History, and produces neither an authoritative Workspace artifact nor an Export Artifact or Export Artifact Mirror.
User-facing Chinese label: 问题排查包
_Avoid_: Log Bundle, Log Export, Export Artifact, Diagnostic Bundle History

**Task State Semantics**:
The authoritative state-meaning module for the Task State Machine. It derives effective deck/page state, allowed operations, blockers, recommendations, and page progress synchronization from Workspace artifacts such as the Confirmed Outline, manifest, and Page Progress.

## Example Dialogue

Dev: "The requirements page already selected the first candidate for every field. Can Outline Creation start now?"

Expert: "No. Those selections are still a Presentation Requirements Draft until the user explicitly confirms the whole set; the requirements gate must block Outline Creation before then."

Dev: "The user selected a template on the Brief page. Is that already the Workspace's visual authority?"

Expert: "No. It is a draft Visual Style Preset choice until Presentation Requirements Confirmation. Confirmation records the preset snapshot and its complete Style Guide; the preview images remain UI-only."

Dev: "The user changed the template after the requirements draft was generated. Can they keep reviewing the old draft?"

Expert: "No. The template change requires a new Presentation Requirements Creation. The old draft cannot be confirmed against a different Visual Style Preset."

Dev: "The user edited the Brief after confirming the requirements. Should we mark them stale immediately?"

Expert: "No. Editing the Brief does not change the current requirements. Only an explicit Presentation Requirements Creation action can replace the active draft, and the new draft retains the Brief used to generate it."

Dev: "The workspace has a draft outline, but not a confirmed outline yet."

Expert: "Good. Outline Review is required. Let the user edit the title, Core Message, and Required Content for every entry, then explicitly confirm the valid Outline before the downstream workflow starts."

Dev: "If they edit the outline after confirmation, what happens?"

Expert: "It becomes a draft again until they confirm it one more time."

Dev: "The confirmed requirements requested eight pages, but the user saved a six-page Outline. Do the requirements become a draft again?"

Expert: "No. Outline Review is allowed to synchronize `slide_count` to six while the requirements remain confirmed; output language and every other requirement still belong to Presentation Requirements Review."

Dev: "Does a new page choose a Template or blueprint?"

Expert: "No. The engine assigns an opaque page identity, copies the stable Page Source Bootstrap, and Page Authoring creates that page's composition."

Dev: "Can the page Agent import a card from the Reference Library?"

Expert: "No. It may import a Foundation Module, but a Reference Implementation is only something to inspect, copy, or rewrite into the current Page Source."

Dev: "How do independently authored pages keep a consistent style without a Theme Token?"

Expert: "Every Page Authoring Agent reads the same Workspace Style Guide and applies its exact values, qualitative rules, and allowed variation in the Page Source."

Dev: "Is the generated Deck HTML another source that Page Authoring can edit?"

Expert: "No. It is a Rendered HTML Snapshot derived from Page Sources after browser rendering; Page Sources remain authoritative and the snapshot is rebuilt when needed."

Dev: "The PPTX was generated, but Export Download Preparation failed. Should we generate the PPTX again?"

Expert: "No. Keep the Export Artifact and retry only its Export Artifact Mirror."

Dev: "Does publishing that mirror also save the PPTX to My Files?"

Expert: "No. An Export Artifact Mirror is PPT App-internal transport under an internal path in the user's APS Files namespace. A My Files Export requires a separate explicit user action and product record."

Dev: "Can the support action be called Log Export if it includes the whole Workspace?"

Expert: "No. Call it a Workspace Diagnostic Bundle so users understand that uploaded sources, authoring files, logs, and generated artifacts may all be included."
