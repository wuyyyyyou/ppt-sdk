# PPT App Glossary

This context defines the project language for the PPT authoring workflow and keeps the terms stable across UI, prompts, and artifacts.

## Language

**Workspace**:
The container for one PPT request and its artifacts.

**Brief**:
The user's initial input that describes what the deck should cover.

**Outline**:
An ordered list of slide-level entries, each with a title and a short outline.

**Outline Draft**:
An outline that is still open to manual edits or LLM revision.

**Confirmed Outline**:
An outline that has been accepted for downstream generation.

**Outline Review**:
The user step where the outline is inspected, edited, or revised before continuing.

**Outline Creation**:
The process that turns a brief into an outline draft or a confirmed outline.

**Rewrite Request**:
A natural-language instruction used to revise the current outline draft as a whole.

**Template**:
The selected visual style family used to shape the deck.

**Template Data Contract**:
The recommended data shape for a Template layout. It guides authoring and tooling, but it is not necessarily a render-time gate.

**Template Theme Contract**:
The selected Template's requirements and guidance for a valid Workspace Theme Token. It defines the theme shape and default theme baseline used by Workspace Theme Creation.
_Avoid_: Template Data Contract, Preset Theme Catalog

**Workspace Theme Creation**:
The generation-time step that creates a Workspace-owned theme for the selected Template from the Template's theme contract, the user's style intent, and deck context before downstream generation proceeds. It happens before Uploaded Source Analysis and does not depend on Uploaded Source Analysis results.
_Avoid_: Theme ID Selection, Preset Theme Selection

**Workspace Theme Token**:
A Workspace-owned theme object created for the selected Template. It must satisfy that Template's theme contract and is the current theme source for downstream rendering.
_Avoid_: Theme ID, Preset Theme

**PPTX Rasterization**:
The process that turns a user-provided PPTX into page-level images for visual inspection. It is a reusable preparation step and is not itself Style Profile Creation or Uploaded Source Analysis.
_Avoid_: PPT parsing, PPT import, PPT analysis

**Reference Slide Image**:
A PNG page image produced from reference material so an Agent can inspect visual style. Reference Slide Images may guide Style Profile Creation, but they are not factual grounding evidence for Page Authoring.
_Avoid_: Research Evidence, Visual Research Evidence

**Style Profile**:
A reusable textual visual style guide created from reference slide images or uploaded style-reference images. It can guide Workspace Theme Creation and Page Authoring style direction, but it does not preserve factual content from its references and is not Research Evidence, Uploaded Source Material, a Template, or an Agent Skill.
_Avoid_: Research Evidence, Uploaded Source Material, Template, Skill

**Style Profile Library**:
The app-level collection of reusable Style Profiles available across Workspaces. It is separate from Workspace-owned artifacts, Research Evidence, and the Template catalog.
_Avoid_: Workspace, Template Catalog

**Style Profile Creation Workspace**:
A temporary app-level work area used while creating one Style Profile from reference material. It is not a deck Workspace and does not participate in Outline Creation, Uploaded Source Analysis, Research Discovery, or Deck Generation.
_Avoid_: Workspace, Uploaded Source Material

**Selected Style Profile**:
A Workspace-owned copy of the Style Profile guidance chosen for that Workspace. It preserves the style guidance used by that Workspace even if the original Style Profile later changes; when present, it is a required Workspace input and guides style after Template Theme Contract requirements and the Workspace's explicit style intent. Changing or clearing it after Deck Generation makes the current Deck stale until the affected generation work is rerun.
_Avoid_: Live Style Profile Reference

**Style Profile Creation**:
The process that turns reference slide images or uploaded style-reference images into a reusable Style Profile. It is separate from Deck Generation and does not produce a Deck.
_Avoid_: Deck Generation, Uploaded Source Analysis

**Page Plan**:
The slide-by-slide mapping from Confirmed Outline entries to planned pages, with one Page Plan entry per outline item. It owns page identity, template blueprint selection, and, after Evidence-Aware Page Planning, page-level content direction and assigned Research Evidence references. Page-level content direction should reference Research Evidence by identity rather than copying full evidence content. During Page Refinement, only the target page entries should be revised when target page outlines change.

**Research Discovery**:
The deck-level iterative process that decides what external material is still needed, collects candidate web and image material, curates it into Research Evidence, and stops when enough useful evidence has been collected or the iteration limit is reached. It happens before Page Generation Units are authored. When Uploaded Source Analysis exists, Research Discovery treats it as prior source context and should search only for unresolved gaps, required current external facts, public benchmarks, or additional visual assets. Web material is discovered before visual material so image needs can be informed by curated facts and insights; visual material does not become factual evidence by itself. Interrupted Research Discovery work is not complete discovery work and must not be promoted into the Research Discovery Evidence Pool.
User-facing Chinese label: 事实收集
_Avoid_: Research Planning

**Research Discovery Evidence Pool**:
The deck-level curated evidence pool produced during Research Discovery before evidence is assigned to Page Generation Units. It supports further Research Discovery decisions and Evidence-Aware Page Planning, but it is not by itself an allowed grounding source for Page Authoring.
_Avoid_: Shared Research Evidence, Page Research Evidence

**Research Collection Ledger**:
A Workspace-owned record of which web and image query intents have already been collected during Research Discovery or later refinement research. It is used to avoid repeating completed query intents while preserving existing Research Evidence; interrupted research work must not make a query intent count as completed collection.

**Research Search Control**:
A Workspace-level or run-level user preference that disables new web or visual external search and fetch during Research Discovery. It does not disable reuse of existing Research Evidence, Evidence-Aware Page Planning, Uploaded Source Material, or Uploaded Source Analysis.
_Avoid_: Disable evidence, disable uploaded sources

**Research Requirement**:
The decision that more external material is needed because the deck or a refinement target depends on real-world facts, current information, source-backed data, or non-template visual assets that are not already available in Research Evidence.

**Research Evidence Gap**:
A case where Research Discovery, Research Curation, or Evidence-Aware Page Planning cannot produce enough Research Evidence for a requested deck or page intent. It does not block Page Generation and does not make completed research work partially failed; unsupported concrete details must be omitted, generalized, or marked as TBD / 待补充. Reaching a Research Discovery iteration limit may produce a Research Evidence Gap. User cancellation or interruption during research is unfinished work, not a Research Evidence Gap.

**Evidence-Aware Page Planning**:
The deck-level step after Research Discovery that updates the Page Plan with each Page Generation Unit's main content direction, supporting Research Evidence references, and Visual Research Evidence references. When Uploaded Source Analysis exists, Evidence-Aware Page Planning should prioritize assigning relevant facts and visual assets from Uploaded Source Analysis and should try to use the uploaded-source factual content as fully as the deck intent, requested page count or structure, and page readability allow. It does not modify the Confirmed Outline, does not copy full evidence content into the Page Plan, and does not make Raw Research Material or full Uploaded Source Analysis a Page Authoring grounding source.

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
A Workspace-owned diagnostic record of Research Planning, Research Collection, and Research Curation activity. It is separate from Page Generation Stage Records and is used for troubleshooting evidence decisions.

**Research Evidence**:
Curated facts, sources, and visual assets selected from Raw Research Material for use in Page Generation. Page-assigned Research Evidence is materialized deterministically from the Research Discovery Evidence Pool and Page Plan evidence references. It is an allowed grounding source for generated page content.
_Avoid_: Raw search results, raw crawl output

**Visual Research Evidence**:
A curated visual asset selected for a Page Generation Unit because it fits the page intent and is visually usable. Text, charts, or claims visible inside the asset are not grounded facts unless separately captured as Research Evidence.

**Shared Research Evidence**:
Curated deck-level material that can support multiple Page Generation Units without belonging exclusively to one page.

**Deck**:
The finished presentation content before export.

**Stale Deck**:
A deck that was generated from an earlier outline, template, or setting and should not be presented as current until regenerated.

**Deck Generation**:
The process that turns a confirmed outline into presentation pages; it does not include outline creation from a brief.

**Deck Generation Public Facade**:
The stable app-facing entry boundary for Deck Generation, Deck Refinement, and Page Generation Retry. It exposes the workflow capabilities without owning their internal workflow decisions.
_Avoid_: Workflow implementation, orchestration module

**Active Deck Generation**:
A deck generation process that is currently running; the confirmed outline is not open to edits during this period.

**Interrupted Deck Generation**:
A Deck Generation that is neither running nor finished, with deck-level planning or preparation artifacts not yet ready, one or more Page Generation Units not yet accepted, or final Deck artifacts not yet ready, and no page actively authoring. It can be resumed to finish the unfinished work while keeping accepted pages.
_Avoid_: Cancelled Deck — cancellation is the user action that leads here, not the resulting state.

**Unresumable Deck Generation**:
A Deck Generation that is not running and cannot be safely resumed because required Workspace artifacts are missing, stale, invalid, or inconsistent with the Confirmed Outline or Template.
_Avoid_: Failed Deck when the issue is an artifact or state blocker rather than a Page Generation failure.

**Generation Step**:
A visible part of deck generation, such as planning pages, preparing files, authoring a page, content review, rendering, visual review, or final rendering.

**Final Deck Render**:
The deck-level Generation Step that turns accepted Page Generation Units into final previewable Deck artifacts. It is not owned by any single Page Generation Unit, and Deck Generation is not complete until Final Deck Render has succeeded.

**Page Generation Unit**:
One planned page being authored, content-reviewed, rendered, and visual-reviewed as an independent part of Deck Generation. It owns only that page's content and page-level assets; shared deck structure and template-wide assets belong outside the unit.
Its stable identity is the Page Plan `page_id`; page index is ordering, not identity.

**Active Page Generation**:
A Page Generation Unit that has started and has not yet reached an accepted, failed, or cancelled terminal state. Its live stream may be shown while it is active.

**Deck Generation Progress**:
The aggregate progress of an Active Deck Generation across all Page Generation Units. It describes counts and overall state rather than naming one current page.

**Live Page Stream**:
The visible stream for an Active Page Generation. It shows the current page run while that page is still active.

**Page Generation Stage Record**:
The user-facing record of what happened within one Page Generation Unit across stages such as authoring, rendering, review, and fixing. It may include live or completed agent output, but it is presented as page work rather than as session history.

**Page Content Review**:
The Page Generation check that judges whether a generated page's visible textual content is grounded in the Workspace context, follows the Page Plan and Confirmed Outline, and uses the expected output language.
It treats the current page's Page Plan entry as the primary content boundary while allowing light deck-level connective text where the page role calls for it.
It may report language, outline-alignment, or grounding issues.
_Avoid_: Fact Review when referring to the full content check.

**Page Visual Review**:
The Page Generation check that judges whether a rendered page screenshot is visually usable as a PPT page, including layout completeness, readability, overlap, cutoff, blank areas, and fit with the selected Template.
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
The action of rerunning one Page Generation Unit against the current Confirmed Outline, Page Plan, and Template with a fresh attempt budget. It is a lower-level recovery concept; the user-facing recovery action for unfinished deck work is Deck Generation Resume.

**Deck Refinement**:
A user-requested revision of an accepted Deck as a whole after Deck Generation. It may update deck-level context, output language, Confirmed Outline, Page Plan content direction, page-assigned Research Evidence, and selected Page Generation Units while preserving unaffected accepted pages when safe.
When the Confirmed Outline changes without changing output language, only Page Generation Units whose outline intent changed are affected unless the request explicitly asks for a global style, language, or narrative rewrite.
For retained Page Generation Units, Deck Refinement preserves existing Page Plan blueprint identity and copies only the updated outline title and outline into the Page Plan; requested layout changes are handled by page authoring against the existing TSX.
New Page Generation Units introduced during Deck Refinement may be initialized from a selected Template blueprint because they do not yet have existing TSX content to preserve.
Deleted Page Generation Units are removed from current outline, planning, progress, and render artifacts, but their old workspace files may remain as unreferenced artifacts.
Deck Refinement may run a Research Discovery Loop when the refinement needs additional or updated evidence. The loop uses deck context and a target scope, then updates the affected Page Plan entries' evidence-aware content direction and corresponding page-assigned Research Evidence; unaffected pages preserve their Page Plan content direction and assigned Research Evidence when safe.
Target Page Generation Units in Deck Refinement receive both the deck-level request and a page-level refinement reason so page authoring can preserve useful existing work while applying the whole-deck change.
Deck Refinement outline reconciliation is operation-based so retained Page Generation Units keep their `page_id` identity across keep, update, add, and delete decisions.
Deck Refinement should add or delete Page Generation Units only when the user explicitly asks for a page-count or page-structure change; vague structure-improvement requests should preserve page count.
Changing the selected Template is outside Deck Refinement; it requires a separate regeneration or migration flow.
_Avoid_: Deck Generation Restart when accepted pages can be preserved.

**Deck Refinement Resume**:
The user action that continues an unfinished Deck Refinement from persisted deck-level decisions and target pages. It does not reinterpret completed context, outline, planning, or research-routing decisions as a new request.
Accepted target pages keep their previous page status until their resumed Deck Refinement run actually starts that page again.

**No-op Deck Refinement**:
A Deck Refinement whose review and reconciliation steps determine that no workspace artifacts or Page Generation Units need to change. It completes without rerunning page authoring or final deck render.

**Deck Refinement Context Review**:
The pre-outline judgment step in Deck Refinement that decides whether the request explicitly changes deck-level context rows or output language. Output language should change only when the user explicitly asks to change the generated content language.
A Deck Refinement that changes output language affects every Page Generation Unit.
Audience, goal, style, and theme changes are whole-deck context changes; content-source and slide-count changes are resolved through later outline, research, and planning decisions.
When output language changes, the active Confirmed Outline and workspace setting should both reflect the new output language.
Deck Refinement Context Review does not rewrite the original Brief; the Deck Refinement Request is a later instruction with its own audit trail.

**Page Refinement**:
A user-requested revision of one or more accepted Page Generation Units after Deck Generation. It first interprets whether the request can stay within the current Confirmed Outline or must revise the target page outline; a required target-page outline revision becomes the active Confirmed Outline for downstream generation.
When additional or updated evidence is needed, Page Refinement runs a Research Discovery Loop with the target page scope, then updates the target Page Plan content direction and target page-assigned Research Evidence.
_Avoid_: Page Generation Retry, Page Visual Review, Visual Review Fix

**Page Refinement Request**:
The user's active instruction for a Page Refinement during the current run. It may require target-page outline changes or additional evidence, and it is an evidence source only for facts, numbers, dates, names, and claims explicitly stated in the request.
_Avoid_: Visual Review Issue, Rewrite Request

**Page Refinement Resume**:
The user action that continues an unfinished Page Refinement using the same persisted Page Refinement Request and the same target pages. It preserves non-target accepted pages and does not reinterpret the refinement as a new request.

**Page Refinement Intent Review**:
The pre-authoring judgment step in Page Refinement that decides whether the request requires a target-page outline revision, a target-page Page Plan revision, or additional Research Collection. It produces routing decisions for the refinement run rather than slide content.

**Unsupported Page Refinement Request**:
A Page Refinement Request that cannot be handled within current-page refinement boundaries, such as changing deck page count, page order, template selection, or other non-target pages. It should stop the refinement run before workspace artifacts are changed.

**Page Refinement Visual Context**:
The latest available rendered screenshot for a target page during Page Refinement. It guides visual and layout changes, but text, numbers, charts, and claims visible in the screenshot are not grounding evidence unless they are separately present in allowed evidence sources.

**Deck Generation Resume**:
The user action that continues unfinished Deck Generation by completing missing deck-level planning or preparation work, re-running any Page Generation Unit that is not accepted yet, including Interrupted Page Generations, pending pages, infrastructure failures, and Failed Page Generations, or by continuing Final Deck Render when all pages are accepted but final Deck artifacts are not ready. It keeps accepted pages and does not restart the whole Deck; an unfinished page keeps its previous current state until its resumed run actually starts.
_Avoid_: Regenerate, Restart — those discard accepted pages and start the whole Deck over.

**Deck Generation Restart**:
The user action that discards current Deck Generation artifacts and starts Deck Generation again from the current Confirmed Outline and Template. It is different from Deck Generation Resume because it does not preserve accepted Page Generation Units as completed work.
_Avoid_: Resume, Continue Generation

**Deck Generation Cancellation**:
The user action that asks an Active Deck Generation to stop starting new Page Generation Units and to cooperatively stop active page, research, and final-render work. Work already inside an external operation may return after cancellation, but cancelled work must not be promoted into accepted page content, Research Evidence, or final Deck artifacts; after cancellation settles, unfinished deck work is represented as an Interrupted Deck Generation.

**Task State Semantics**:
The authoritative state-meaning module for the Task State Machine. It derives effective deck/page state, allowed operations, blockers, recommendations, and page progress synchronization from Workspace artifacts such as the Page Plan and Page Progress.

## Example Dialogue

Dev: "The workspace has a draft outline, but not a confirmed outline yet."

Expert: "Good. Let the user review the outline first, then confirm it before creating the page plan."

Dev: "If they edit the outline after confirmation, what happens?"

Expert: "It becomes a draft again until they confirm it one more time."
