---
status: accepted
---

# Page Refinement overrides its creation baselines without mutating them

Page Refinement re-authors only its target Page Source and never modifies the Confirmed Outline or Workspace Style Guide. Those artifacts remain the original Deck Generation baseline, while the active Page Refinement Request takes precedence for the target page wherever its instruction conflicts with either baseline; this avoids turning a local revision into deck-level artifact reconciliation or unintended re-authoring of other pages.

**Consequences**

- The target page keeps its existing `page_id`, and non-target Page Sources remain untouched.
- Page Authoring must read the current Outline Entry and Workspace Style Guide as context but explicitly follow the Page Refinement Request when they conflict.
- The user's choice of the Page Refinement entry point fixes the operation scope to the target page. No separate LLM intent-review, rejection, or automatic promotion to Deck Refinement is performed; instructions that mention wider changes are applied only where they can affect the target page.
- Refinement uses the request and existing Workspace material as its available grounding; it does not add a research-routing gate, but Page Authoring must not invent unsupported facts, numbers, names, claims, or source-dependent visuals.
- The visible title authored inside the target Page Source may diverge from the original Outline Entry title. Navigation and restored Workspace labels continue to use the Confirmed Outline title; no second persisted page-title authority is introduced for Page Refinement.
- A submitted Page Refinement must produce a real target Page Source fingerprint change. A no-change Agent response receives bounded repair attempts and ultimately fails rather than reporting an optimization that did not modify the page.
- Page Refinement uses a dedicated app-facing preparation operation that may reset only the target page's execution state, preserve its baseline render references, record minimal recovery intent, and invalidate the final Deck render. It cannot modify the Confirmed Outline, Workspace Style Guide, or Manifest.
- The Page Refinement Request remains present through initial authoring, no-change repair, render repair, and visual-review repair. Technical and usability repairs must preserve the requested change, while the baseline screenshot remains visual context rather than factual grounding.
- Later Deck Refinement or full Deck Generation continues to treat the persisted Confirmed Outline and Workspace Style Guide as the deck-level authorities; a prior Page Refinement does not silently rewrite them.
