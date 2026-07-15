---
status: accepted
---

# Confirmed Outline owns page identity without Page Plan

Deck Generation will remove the Page Plan artifact and its LLM generation step. Each Confirmed Outline entry owns an opaque, position-independent `page_id`; that identity is never reused, user-visible page numbers come from current ordering, and the deterministic Page Source path is derived from the identity rather than from a title or position.

Page Source is the sole authoritative render source for a page's visible content and composition, so paired page data JSON files are also removed. Page Evidence Assignment remains as a deck-level research step but writes page-assigned Research Evidence directly and does not choose layouts or create another planning table; the Deck Manifest, Page Progress, Confirmed Outline, Research Evidence, and Page Source each retain only their own responsibilities.

This decision replaces the Page Plan and blueprint-specific parts of ADR-0008 and ADR-0011 while preserving their decisions to keep page identity stable during Deck Refinement and to assign curated evidence before Page Authoring.

**Considered Options**

- Keep a smaller Page Plan without blueprints. Rejected because its remaining identity, ordering, source, progress, and evidence fields would duplicate existing Workspace artifacts.
- Replace Page Plan with a differently named page registry. Rejected because it would recreate the same competing source of truth.
- Encode page position in `page_id`. Rejected because insertion and reordering would require identity and filename changes or leave misleading identifiers.

**Consequences**

- Confirming an Outline assigns stable page identities before research or Page Authoring begins.
- Deck Refinement preserves identities for retained pages, allocates new identities for added pages, and never renames pages merely because their order changes.
- The engine may add the new path while legacy app-facing Page Plan tools remain temporarily available, but those tools are deleted after PPT App switches to the new flow.
