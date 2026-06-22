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

**Page Plan**:
The slide-by-slide mapping from outline entries to planned pages.

**Research Collection**:
The process of collecting external material for a Page Generation Unit after the page intent is known. It produces candidate material for review, not presentation content by itself.

**Research Requirement**:
The decision that a Page Generation Unit needs external material before authoring because its intended content depends on real-world facts, current information, source-backed data, or non-template visual assets. Pages without a Research Requirement should not collect external material by default.

**Research Evidence Gap**:
A case where a Page Generation Unit has a Research Requirement but Research Collection or Research Curation does not produce enough Research Evidence. It does not block Page Generation; unsupported concrete details must be omitted, generalized, or marked as TBD / 待补充.

**Research Planning**:
The step that decides which Page Generation Units have a Research Requirement and what external material they need. It is separate from Page Plan because it plans evidence needs rather than slide structure.

**Raw Research Material**:
External material collected by search, fetch, or image lookup before cleanup or selection. It is not grounding evidence until promoted into Research Evidence.
_Avoid_: Evidence, source of truth

**Research Curation**:
The step that turns Raw Research Material into Research Evidence by selecting relevant facts, sources, and visual assets for a Page Generation Unit.

**Research Curation Draft**:
An intermediate curation result for a Page Generation Unit that has been selected from Raw Research Material but has not yet been promoted into Research Evidence.

**Web Research Curation Draft**:
A Research Curation Draft that contains candidate factual evidence, source judgments, derived insights, rejected material, and gaps from web material.

**Visual Research Curation Draft**:
A Research Curation Draft that contains candidate visual assets, visual judgments, rejected material, and gaps from image material.

**Research Log**:
A Workspace-owned diagnostic record of Research Planning, Research Collection, and Research Curation activity. It is separate from Page Generation Stage Records and is used for troubleshooting evidence decisions.

**Research Evidence**:
Curated facts, sources, and visual assets selected from Raw Research Material for use in Page Generation. It is an allowed grounding source for generated page content.
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

**Active Deck Generation**:
A deck generation process that is currently running; the confirmed outline is not open to edits during this period.

**Interrupted Deck Generation**:
A Deck Generation that is neither running nor finished, with one or more Page Generation Units not yet accepted or with final Deck artifacts not yet ready, and no page actively authoring. It can be resumed to finish the unfinished work while keeping accepted pages.
_Avoid_: Cancelled Deck — cancellation is the user action that leads here, not the resulting state.

**Unresumable Deck Generation**:
A Deck Generation that is not running and cannot be safely resumed because required Workspace artifacts are missing, stale, invalid, or inconsistent with the Confirmed Outline or Template.
_Avoid_: Failed Deck when the issue is an artifact or state blocker rather than a Page Generation failure.

**Generation Step**:
A visible part of deck generation, such as planning pages, preparing files, authoring a page, content review, rendering, visual review, or final rendering.

**Page Generation Unit**:
One planned page being authored, content-reviewed, rendered, and visual-reviewed as an independent part of Deck Generation. It owns only that page's content and page-level assets; shared deck structure and template-wide assets belong outside the unit.

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
A Page Generation Unit that was Active but whose run is no longer owned by any process, because the user stopped Deck Generation or the app exited before the unit reached an accepted or failed verdict. It is unfinished in intent but terminal in fact: no run is advancing it, so it must be explicitly resumed or retried. It is defined by ownership, not by cause, so a user stop and an app exit produce the same state.
_Avoid_: Stopped Page, Cancelled Page — cancellation is a deck-level user action, not a page state. Distinguish from Failed Page Generation, which exhausted recovery or needs review.

**Agent Session Cache Miss**:
A transient Agent Session infrastructure failure where the platform cannot continue an Agent run because the app session authorization is unavailable. It is treated as infrastructure failure, not as a Page Generation content or render failure.

**Page Generation Retry**:
The action of rerunning one Page Generation Unit against the current Confirmed Outline, Page Plan, and Template with a fresh attempt budget. It is a lower-level recovery concept; the user-facing recovery action for unfinished deck work is Deck Generation Resume.

**Page Refinement**:
A user-requested revision of one accepted Page Generation Unit after Deck Generation, using the user's refinement request as the active instruction for that page while preserving the current Confirmed Outline, Page Plan, and Template.
_Avoid_: Page Generation Retry, Page Visual Review, Visual Review Fix

**Page Refinement Request**:
The user's active instruction for a Page Refinement during the current run. It is an evidence source only for facts, numbers, dates, names, and claims explicitly stated in the request, and does not authorize inferred adjacent facts or generated page content as grounded.
_Avoid_: Visual Review Issue, Rewrite Request

**Deck Generation Resume**:
The user action that continues unfinished Deck Generation by re-running any Page Generation Unit that is not accepted yet, including Interrupted Page Generations, pending pages, infrastructure failures, and Failed Page Generations. It keeps accepted pages and does not restart the whole Deck.
_Avoid_: Regenerate, Restart — those discard accepted pages and start the whole Deck over.

**Deck Generation Cancellation**:
The user action that stops an Active Deck Generation from starting more Page Generation Units. Work already inside a Page Generation Unit may finish its current step before cancellation is reflected; after cancellation settles, unfinished deck work is represented as an Interrupted Deck Generation.

**Task State Semantics**:
The authoritative state-meaning module for the Task State Machine. It derives effective deck/page state, allowed operations, blockers, recommendations, and page progress synchronization from Workspace artifacts such as the Page Plan and Page Progress.

## Example Dialogue

Dev: "The workspace has a draft outline, but not a confirmed outline yet."

Expert: "Good. Let the user review the outline first, then confirm it before creating the page plan."

Dev: "If they edit the outline after confirmation, what happens?"

Expert: "It becomes a draft again until they confirm it one more time."
