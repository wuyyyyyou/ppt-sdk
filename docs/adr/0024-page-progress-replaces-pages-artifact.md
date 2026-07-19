---
status: accepted
---

# Page Progress replaces the pages artifact

The unified Page Source workflow removes `pages.json` and uses `page-progress.json` as the persisted Deck Generation state and current rendered-artifact index. The Confirmed Outline owns page title and order, the root Deck Manifest owns the ordered Page Source mapping, and each Page Progress entry owns only execution state plus its latest successful HTML and screenshot references; top-level `final_deck_render` owns the completed Deck HTML path, output directory, and render time.

The existing top-level `recovery` record also owns the minimal run semantics that cannot be derived from page statuses alone, such as run kind, active step, refinement target identities, the user's refinement request, and page-level refinement reasons. It does not store a duplicate complete Deck Refinement plan; committed Outline, Style Guide, Manifest, and page entries already embody that decision, while complete LLM attempts remain diagnostic logs.

This supersedes the part of ADR-0007 that kept `pages.json` as a separate successful Deck artifact. Deck restoration, cached rendered-Deck lookup, PDF export, and refinement visual context join the Confirmed Outline with Page Progress by `page_id`; `final_deck_render.status` and actual file existence determine whether the completed render can be reused. The old Workspace file declaration, `WorkspacePages` types, page update tools, `pages_path`, and render-key dependencies are removed rather than migrated.

**Considered Options**

- Keep a simplified `pages.json`. Rejected because it would duplicate Outline-owned page metadata and Page Progress render references.
- Store a second full rendered-page array under `final_deck_render`. Rejected because per-page HTML and screenshot references already belong naturally to the corresponding Page Progress entry.
- Derive every output filename without persisting references. Rejected because render filenames are implementation details and consumers need a durable receipt of the actual successful artifacts.
