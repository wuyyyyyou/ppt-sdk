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

**Deck**:
The finished presentation content before export.

**Stale Deck**:
A deck that was generated from an earlier outline, template, or setting and should not be presented as current until regenerated.

**Deck Generation**:
The process that turns a confirmed outline into presentation pages; it does not include outline creation from a brief.

**Active Deck Generation**:
A deck generation process that is currently running; the confirmed outline is not open to edits during this period.

**Interrupted Deck Generation**:
A Deck Generation that is neither running nor finished, holding one or more Interrupted Page Generations (and possibly pending pages) with no page actively authoring. It can be resumed to finish the unfinished pages while keeping accepted pages.
_Avoid_: Cancelled Deck — cancellation is the user action that leads here, not the resulting state.

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
The action of rerunning one Failed or Interrupted Page Generation against the current Confirmed Outline, Page Plan, and Template, with a fresh attempt budget. It applies to the selected page only and does not imply regenerating the whole Deck.

**Deck Generation Resume**:
The user action that continues an Interrupted Deck Generation by re-running its Interrupted Page Generations, pending pages, and pages whose only failure was infrastructure (e.g. an Agent Session Cache Miss), while keeping accepted pages and leaving genuinely Failed Page Generations (content, render, or needs-review) untouched. Those are re-attempted only through Page Generation Retry.
_Avoid_: Regenerate, Restart — those discard accepted pages and start the whole Deck over.

**Deck Generation Cancellation**:
The user action that stops an Active Deck Generation from starting more Page Generation Units. Work already inside a Page Generation Unit may finish its current step before cancellation is reflected.

**Task State Semantics**:
The authoritative state-meaning module for the Task State Machine. It derives effective deck/page state, allowed operations, blockers, recommendations, and page progress synchronization from Workspace artifacts such as the Page Plan and Page Progress.

## Example Dialogue

Dev: "The workspace has a draft outline, but not a confirmed outline yet."

Expert: "Good. Let the user review the outline first, then confirm it before creating the page plan."

Dev: "If they edit the outline after confirmation, what happens?"

Expert: "It becomes a draft again until they confirm it one more time."
