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

**Generation Step**:
A visible part of deck generation, such as planning pages, preparing files, authoring a page, rendering, self-review, or final rendering.

**Page Generation Unit**:
One planned page being authored, rendered, and self-reviewed as an independent part of Deck Generation. It owns only that page's content and page-level assets; shared deck structure and template-wide assets belong outside the unit.

**Active Page Generation**:
A Page Generation Unit that has started and has not yet reached an accepted, failed, or cancelled terminal state. Its live stream may be shown while it is active.

**Deck Generation Progress**:
The aggregate progress of an Active Deck Generation across all Page Generation Units. It describes counts and overall state rather than naming one current page.

**Live Page Stream**:
The visible stream for an Active Page Generation. It shows the current page run while that page is still active.

**Generation Session History**:
The collapsed-by-default record of completed agent runs from Deck Generation. It is historical context, not the primary place for Live Page Streams.

**Failed Page Generation**:
A Page Generation Unit that reached a terminal state without becoming accepted after its automatic recovery attempts are exhausted or manual review is required. Deck Generation may still continue other Page Generation Units, but the Deck is not finished until failed pages are retried or otherwise resolved.

**Page Generation Retry**:
The action of rerunning one Failed Page Generation against the current Confirmed Outline, Page Plan, and Template. It applies to the selected page only and does not imply regenerating the whole Deck.

**Deck Generation Cancellation**:
The user action that stops an Active Deck Generation from starting more Page Generation Units. Work already inside a Page Generation Unit may finish its current step before cancellation is reflected.

**Task State Semantics**:
The authoritative state-meaning module for the Task State Machine. It derives effective deck/page state, allowed operations, blockers, recommendations, and page progress synchronization from Workspace artifacts such as the Page Plan and Page Progress.

## Example Dialogue

Dev: "The workspace has a draft outline, but not a confirmed outline yet."

Expert: "Good. Let the user review the outline first, then confirm it before creating the page plan."

Dev: "If they edit the outline after confirmation, what happens?"

Expert: "It becomes a draft again until they confirm it one more time."
