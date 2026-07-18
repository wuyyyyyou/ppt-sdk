---
status: accepted
---

# Confirmed Outline owns page identity without Page Plan

Deck Generation will remove the Page Plan artifact and its LLM generation step. Each Confirmed Outline entry owns an opaque, position-independent `page_id` for that Confirmed Outline and its Deck Generation; that identity is never reused, user-visible page numbers come from current ordering, and the deterministic Page Source path is derived from the identity rather than from a title or position. Outline Drafts, Outline Creation, and Rewrite Requests do not carry page identities, and every Outline Confirmation assigns a fresh identity to every entry.

Page Source is the sole authoritative render source for a page's visible content and composition, so paired page data JSON files are also removed. The first Page Source migration temporarily skips web/image Research entirely; when Page Evidence Assignment is introduced later, it will write page-assigned Research Evidence directly without choosing layouts or creating another planning table. The Deck Manifest, Page Progress, Confirmed Outline, future Research Evidence, and Page Source each retain only their own responsibilities.

Without Page Plan, Page Authoring receives the current Page Source, the Workspace requirements artifact containing the original Brief and Confirmed Presentation Requirements, the complete Confirmed Outline, the Workspace Style Guide, and the Workspace Authoring Kit guidance. The current Outline Entry is the page-content boundary; confirmed requirements override conflicting Brief wording, while the complete Outline supplies deck narrative context rather than permission to move other pages' content into the current page.

This decision replaces the Page Plan and blueprint-specific parts of ADR-0008 and ADR-0011 while preserving their decisions to keep page identity stable during Deck Refinement and to assign curated evidence before Page Authoring.

**Considered Options**

- Keep a smaller Page Plan without blueprints. Rejected because its remaining identity, ordering, source, progress, and evidence fields would duplicate existing Workspace artifacts.
- Replace Page Plan with a differently named page registry. Rejected because it would recreate the same competing source of truth.
- Encode page position in `page_id`. Rejected because insertion and reordering would require identity and filename changes or leave misleading identifiers.

**Consequences**

- Confirming an Outline assigns fresh stable page identities before research or Page Authoring begins; Outline Drafts and Rewrite Requests remain independent of page identity.
- The Page Source path, Deck Manifest slide id/source, and Page Progress identity are deterministic projections of the same Outline Entry `page_id`.
- All page-level app-facing operations identify their target by `page_id`, including Page Source fingerprinting, single-page rendering, progress updates, retry, and refinement. Page index and page number are current-order projections returned for display, never API input identities.
- Page Progress persists only runtime state keyed by `page_id`; current index, title, and deterministic `slides/<page_id>.tsx` paths are projected from the Confirmed Outline and Page Source contract rather than copied into progress.
- Reconfirming an Outline after a Deck exists assigns new identities to every entry and starts a new full Deck Generation. Every Page Source referenced by the new Confirmed Outline is initialized from the Page Source Bootstrap; files from the previous identities may remain as unreferenced artifacts.
- Future Deck Refinement preserves identities within the active Confirmed Outline for retained pages, allocates new identities for added pages, and never renames pages merely because their order changes.
- Legacy app-facing Page Plan tools may remain temporarily for hidden Refinement implementations, but the user-reachable initial generation and Resume paths do not call them; they are deleted after the later Refinement migration removes the final dependency.
