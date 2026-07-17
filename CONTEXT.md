# PPT App Glossary

This context defines the project language for the PPT authoring workflow and keeps the terms stable across UI, prompts, and artifacts.

## Language

**Workspace**:
The container for one PPT request and its artifacts.

**Brief**:
The user's initial input that describes what the deck should cover.
User-facing Chinese label: 需求描述

**Presentation Requirements**:
The Workspace-owned structured requirements for a Deck, derived from the Brief and resolved through user choices. They contain an explicit audience, purpose, desired outcome, positive page count, output language, and visual tone; the user's later explicit choices override the corresponding expression in the Brief.
User-facing Chinese label: 演示需求
_Avoid_: Context, Background

**Presentation Requirements Draft**:
A Workspace-owned set of ordered candidate Presentation Requirements and current selections that remains open to user review and editing across app sessions. The first candidate for each field is recommended and may be selected by default without making the requirements confirmed.
_Avoid_: Confirmed Presentation Requirements

**Presentation Requirements Candidate**:
A selectable proposed value within a Presentation Requirements Draft. Each field has one candidate when the Brief is explicit and two to four materially distinct candidates only when genuine ambiguity remains; semantic candidates pair a concise label with a one-sentence description, while page-count and output-language candidates are simple values.

**Confirmed Presentation Requirements**:
The complete Presentation Requirements accepted by the user as the primary constraints for downstream creation; page count and output language are always concrete rather than automatically deferred. Any later field change returns them to a draft until the whole set is confirmed again, while the Brief remains the original source record without overriding a conflicting confirmed field.

**Presentation Requirements Creation**:
The explicit user-requested process that derives a new Presentation Requirements Draft solely from the current Brief. It may infer missing requirements but never content facts; each resulting draft retains its source Brief, and a successful new creation replaces the active draft as a whole while a failed attempt leaves it unchanged.

**Presentation Requirements Review**:
The required user step where every Presentation Requirements field is resolved from generated candidates or manual entry and the whole set is explicitly confirmed by the user; it is never skipped automatically. Default selections remain a draft until this confirmation action occurs.
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
The qualitative visual character requested for a Deck; it may use a recognizable editorial or cultural reference and describe visual intensity, headline character, compositional feel, and intended reading experience without fixing exact colors, typography, templates, or page layouts. It is an input to Workspace Style Guide Creation rather than a Style Profile or Workspace Style Guide.
User-facing Chinese label: 视觉气质
_Avoid_: Theme, Template, Style Guide

**Outline**:
An ordered list of slide-level entries, each with a title and a short outline.

**Outline Draft**:
An outline that is still open to manual edits or LLM revision.

**Confirmed Outline**:
An outline that has been accepted for downstream generation. Each entry owns an opaque, position-independent `page_id` for its Page Generation Unit; user-visible page numbers are derived from the current ordering rather than encoded in identity.

**Outline Review**:
The user step where the outline is inspected, edited, or revised before continuing.

**Outline Creation**:
The process that turns a brief into an outline draft or a confirmed outline.

**Rewrite Request**:
A natural-language instruction used to revise the current outline draft as a whole.

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
The Workspace-owned style guidance artifact that defines the Deck's shared visual direction, including exact values, qualitative rules, and allowed page-level variation. It guides Page Authoring rather than configuring rendering at runtime; its persistence format is decided by the PPT App workflow, and changing it makes affected Page Sources stale until they are re-authored.
_Avoid_: Workspace Theme Token, Runtime Theme, Preset Theme

**Workspace Style Guide Creation**:
The generation-time step that synthesizes the user's style intent, deck context, and optional Selected Style Profile into the Workspace Style Guide before Page Authoring.
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
A case where Research Discovery, Research Curation, or Page Evidence Assignment cannot produce enough Research Evidence for a requested deck or page intent. It does not block Page Generation and does not make completed research work partially failed; unsupported concrete details must be omitted, generalized, or marked as TBD / 待补充. Reaching a Research Discovery iteration limit may produce a Research Evidence Gap. User cancellation or interruption during research is unfinished work, not a Research Evidence Gap.

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
The stable app-facing entry boundary for Deck Generation, Deck Refinement, and Page Generation Retry. It exposes the workflow capabilities without owning their internal workflow decisions.
_Avoid_: Workflow implementation, orchestration module

**Active Deck Generation**:
A deck generation process that is currently running; the confirmed outline is not open to edits during this period.

**Interrupted Deck Generation**:
A Deck Generation that is neither running nor finished, with the Workspace Style Guide, research, evidence assignment, or Page Source preparation not yet ready, one or more Page Generation Units not yet accepted, or final Deck artifacts not yet ready, and no page actively authoring. It can be resumed to finish the unfinished work while keeping accepted pages.
_Avoid_: Cancelled Deck — cancellation is the user action that leads here, not the resulting state.

**Unresumable Deck Generation**:
A Deck Generation that is not running and cannot be safely resumed because required Workspace artifacts are missing, stale, invalid, or inconsistent with the Confirmed Outline or Workspace Authoring Kit.
_Avoid_: Failed Deck when the issue is an artifact or state blocker rather than a Page Generation failure.

**Generation Step**:
A visible part of deck generation, such as creating the Workspace Style Guide, discovering or assigning evidence, preparing Page Sources, authoring a page, content review, rendering, visual review, or final rendering.

**Final Deck Render**:
The deck-level Generation Step that turns accepted Page Generation Units into final previewable Deck artifacts. It is not owned by any single Page Generation Unit, and Deck Generation is not complete until Final Deck Render has succeeded.

**Page Generation Unit**:
One planned page being authored, content-reviewed, rendered, and visual-reviewed as an independent part of Deck Generation. It owns exactly one stable Page Source together with that page's content and page-level assets; shared deck structure and Workspace Authoring Kit assets belong outside the unit.
Its stable identity is the Confirmed Outline entry's `page_id`; the identity is never reused, while page index is ordering rather than identity.

**Page Source**:
The Workspace-owned TSX entry point for exactly one Page Generation Unit and the sole authoritative render source for that page's visible content and composition. The Confirmed Outline provides intent and Research Evidence provides factual grounding without acting as separate render data; Page Authoring modifies only the current Page Source and its page-owned assets.
_Avoid_: Deck Source, Shared Page Entry, Template Layout, Page Data JSON

**Rendered HTML Snapshot**:
The Workspace-owned, engine-generated static DOM representation captured after Page Sources have completed browser rendering at the fixed slide viewport. A Page Generation Unit owns one page snapshot, while Final Deck Render produces a separate ordered Deck snapshot from all accepted Page Sources; both are rebuildable derived artifacts rather than authoritative Page Authoring sources, and the Deck snapshot may retain engine-owned viewing behaviour without executing Page Source code to create visible content.
User-facing Chinese label: 渲染后 HTML 快照
_Avoid_: Page Source, Executable React HTML, Runtime HTML

**Render Readiness**:
The condition in which all tracked dependencies affecting visible content have settled and the rendered DOM and layout are stable enough to capture. A Rendered HTML Snapshot may be published only after this condition is reached; timeout or cancellation leaves rendering unfinished and produces no partial snapshot.
User-facing Chinese label: 渲染就绪
_Avoid_: Fixed Settle Time, Best-effort Ready

**Deck Manifest**:
The engine-owned, rebuildable rendering index that maps the current Confirmed Outline page sequence to Page Sources. It carries no page-planning, evidence-assignment, generation-state, or authoring decisions and is not edited by an Agent.
_Avoid_: Page Plan, Page Source of Truth, Agent-authored Manifest

**Active Page Generation**:
A Page Generation Unit that has started and has not yet reached an accepted, failed, or cancelled terminal state. Its live stream may be shown while it is active.

**Deck Generation Progress**:
The aggregate progress of an Active Deck Generation across all Page Generation Units. It describes counts and overall state rather than naming one current page.

**Live Page Stream**:
The visible stream for an Active Page Generation. It shows the current page run while that page is still active.

**Page Generation Stage Record**:
The user-facing record of what happened within one Page Generation Unit across stages such as authoring, rendering, review, and fixing. It may include live or completed agent output, but it is presented as page work rather than as session history.

**Page Content Review**:
The Page Generation check that judges whether a generated page's visible textual content is grounded in the Workspace context, follows the Confirmed Outline, and uses the expected output language.
It treats the current page's Confirmed Outline entry and assigned Research Evidence as the primary content boundary while allowing light deck-level connective text where the page role calls for it.
It may report language, outline-alignment, or grounding issues.
_Avoid_: Fact Review when referring to the full content check.

**Page Visual Review**:
The Page Generation check that judges whether a rendered page screenshot is visually usable as a PPT page, including layout completeness, readability, overlap, cutoff, blank areas, and fit with the Workspace Style Guide.
_Avoid_: Self Review when referring to the visual-only screenshot check.

**Generation Session History**:
The collapsed-by-default record of completed agent runs from Deck Generation. It is historical context, not the primary place for Live Page Streams.
_Avoid_: User-facing labels such as "Session History" when the record is really page generation work.

**AI Interaction Log**:
A Workspace-owned diagnostic record of each LLM completion or Agent run used to produce, revise, inspect, or repair deck artifacts. It is for troubleshooting and auditability, separate from user-facing Generation Session History.
_Avoid_: Session History, Live Page Stream

**Failed Page Generation**:
A Page Generation Unit that reached a terminal state without becoming accepted after its automatic recovery attempts are exhausted or manual review is required. Deck Generation may still continue other Page Generation Units, but the Deck is not finished until failed pages are retried or otherwise resolved.

**Interrupted Page Generation**:
A Page Generation Unit that was Active but whose run is no longer owned by any process, because the user stopped Deck Generation or the app exited before the unit reached an accepted or failed verdict, including interruption during Research Collection or Research Curation. It is unfinished in intent but terminal in fact: no run is advancing it, so it must be explicitly resumed or retried. It is defined by ownership, not by cause, so a user stop and an app exit produce the same state.
_Avoid_: Stopped Page, Cancelled Page — cancellation is a deck-level user action, not a page state. Distinguish from Failed Page Generation, which exhausted recovery or needs review.

**Agent Session Cache Miss**:
A transient Agent Session infrastructure failure where the platform cannot continue an Agent run because the app session authorization is unavailable. It is treated as infrastructure failure, not as a Page Generation content or render failure.

**Page Generation Retry**:
The action of rerunning one Page Generation Unit against the current Confirmed Outline, assigned Research Evidence, and Workspace Authoring Kit with a fresh attempt budget. It is a lower-level recovery concept; the user-facing recovery action for unfinished deck work is Deck Generation Resume.

**Deck Refinement**:
A user-requested revision of an accepted Deck as a whole after Deck Generation. It may update deck-level context, output language, Confirmed Outline, page-assigned Research Evidence, and selected Page Generation Units while preserving unaffected accepted pages when safe.
When the Confirmed Outline changes without changing output language, only Page Generation Units whose outline intent changed are affected unless the request explicitly asks for a global style, language, or narrative rewrite.
For retained Page Generation Units, Deck Refinement preserves the existing Page Source; requested layout changes are handled by Page Authoring against that source.
New Page Generation Units introduced during Deck Refinement are initialized from the engine's Page Source Bootstrap because they do not yet have a Page Source.
Deleted Page Generation Units are removed from the current Confirmed Outline, progress, manifest, and render artifacts, but their old workspace files may remain as unreferenced artifacts.
Deck Refinement may run a Research Discovery Loop when the refinement needs additional or updated evidence. The loop uses deck context and a target scope, then updates the affected Page Generation Units' assigned Research Evidence; unaffected pages preserve their assigned Research Evidence when safe.
Target Page Generation Units in Deck Refinement receive both the deck-level request and a page-level refinement reason so page authoring can preserve useful existing work while applying the whole-deck change.
Deck Refinement outline reconciliation is operation-based so retained Page Generation Units keep their `page_id` identity across keep, update, add, and delete decisions.
Deck Refinement should add or delete Page Generation Units only when the user explicitly asks for a page-count or page-structure change; vague structure-improvement requests should preserve page count.
_Avoid_: Deck Generation Restart when accepted pages can be preserved.

**Deck Refinement Resume**:
The user action that continues an unfinished Deck Refinement from persisted deck-level decisions and target pages. It does not reinterpret completed context, outline, evidence-assignment, or research-routing decisions as a new request.
Accepted target pages keep their previous page status until their resumed Deck Refinement run actually starts that page again.

**No-op Deck Refinement**:
A Deck Refinement whose review and reconciliation steps determine that no workspace artifacts or Page Generation Units need to change. It completes without rerunning page authoring or final deck render.

**Deck Refinement Context Review**:
The pre-outline judgment step in Deck Refinement that decides whether the request explicitly changes deck-level context rows or output language. Output language should change only when the user explicitly asks to change the generated content language.
A Deck Refinement that changes output language affects every Page Generation Unit.
Audience, goal, and Workspace Style Guide changes are whole-deck context changes; content-source and slide-count changes are resolved through later outline, research, and Page Evidence Assignment decisions.
When output language changes, the active Confirmed Outline and workspace setting should both reflect the new output language.
Deck Refinement Context Review does not rewrite the original Brief; the Deck Refinement Request is a later instruction with its own audit trail.

**Page Refinement**:
A user-requested revision of one or more accepted Page Generation Units after Deck Generation. It first interprets whether the request can stay within the current Confirmed Outline or must revise the target page outline; a required target-page outline revision becomes the active Confirmed Outline for downstream generation.
When additional or updated evidence is needed, Page Refinement runs a Research Discovery Loop with the target page scope, then updates the target page-assigned Research Evidence.
_Avoid_: Page Generation Retry, Page Visual Review, Visual Review Fix

**Page Refinement Request**:
The user's active instruction for a Page Refinement during the current run. It may require target-page outline changes or additional evidence, and it is an evidence source only for facts, numbers, dates, names, and claims explicitly stated in the request.
_Avoid_: Visual Review Issue, Rewrite Request

**Page Refinement Resume**:
The user action that continues an unfinished Page Refinement using the same persisted Page Refinement Request and the same target pages. It preserves non-target accepted pages and does not reinterpret the refinement as a new request.

**Page Refinement Intent Review**:
The pre-authoring judgment step in Page Refinement that decides whether the request requires a target-page outline revision or additional Research Collection. It produces routing decisions for the refinement run rather than slide content.

**Unsupported Page Refinement Request**:
A Page Refinement Request that cannot be handled within current-page refinement boundaries, such as changing deck page count, page order, the Workspace Authoring Kit, or other non-target pages. It should stop the refinement run before workspace artifacts are changed.

**Page Refinement Visual Context**:
The latest available rendered screenshot for a target page during Page Refinement. It guides visual and layout changes, but text, numbers, charts, and claims visible in the screenshot are not grounding evidence unless they are separately present in allowed evidence sources.

**Deck Generation Resume**:
The user action that continues unfinished Deck Generation by completing missing Workspace Style Guide, research, evidence-assignment, or Page Source preparation work, re-running any Page Generation Unit that is not accepted yet, including Interrupted Page Generations, pending pages, infrastructure failures, and Failed Page Generations, or by continuing Final Deck Render when all pages are accepted but final Deck artifacts are not ready. It keeps accepted pages and does not restart the whole Deck; an unfinished page keeps its previous current state until its resumed run actually starts.
_Avoid_: Regenerate, Restart — those discard accepted pages and start the whole Deck over.

**Deck Generation Restart**:
The user action that discards current Deck Generation artifacts and starts Deck Generation again from the current Confirmed Outline and Workspace Authoring Kit. It is different from Deck Generation Resume because it does not preserve accepted Page Generation Units as completed work.
_Avoid_: Resume, Continue Generation

**Deck Generation Cancellation**:
The user action that asks an Active Deck Generation to stop starting new Page Generation Units and to cooperatively stop active page, research, and final-render work. Work already inside an external operation may return after cancellation, but cancelled work must not be promoted into accepted page content, Research Evidence, or final Deck artifacts; after cancellation settles, unfinished deck work is represented as an Interrupted Deck Generation.

**Task State Semantics**:
The authoritative state-meaning module for the Task State Machine. It derives effective deck/page state, allowed operations, blockers, recommendations, and page progress synchronization from Workspace artifacts such as the Confirmed Outline, manifest, and Page Progress.

## Example Dialogue

Dev: "The requirements page already selected the first candidate for every field. Can Outline Creation start now?"

Expert: "No. Those selections are still a Presentation Requirements Draft until the user explicitly confirms the whole set; the requirements gate must block Outline Creation before then."

Dev: "The user edited the Brief after confirming the requirements. Should we mark them stale immediately?"

Expert: "No. Editing the Brief does not change the current requirements. Only an explicit Presentation Requirements Creation action can replace the active draft, and the new draft retains the Brief used to generate it."

Dev: "The workspace has a draft outline, but not a confirmed outline yet."

Expert: "Good. Let the user review the outline first, then confirm it so each entry receives a stable page identity before Deck Generation starts."

Dev: "If they edit the outline after confirmation, what happens?"

Expert: "It becomes a draft again until they confirm it one more time."

Dev: "Does a new page choose a Template or blueprint?"

Expert: "No. The engine assigns an opaque page identity, copies the stable Page Source Bootstrap, and Page Authoring creates that page's composition."

Dev: "Can the page Agent import a card from the Reference Library?"

Expert: "No. It may import a Foundation Module, but a Reference Implementation is only something to inspect, copy, or rewrite into the current Page Source."

Dev: "How do independently authored pages keep a consistent style without a Theme Token?"

Expert: "Every Page Authoring Agent reads the same Workspace Style Guide and applies its exact values, qualitative rules, and allowed variation in the Page Source."

Dev: "Is the generated Deck HTML another source that Page Authoring can edit?"

Expert: "No. It is a Rendered HTML Snapshot derived from Page Sources after browser rendering; Page Sources remain authoritative and the snapshot is rebuilt when needed."
