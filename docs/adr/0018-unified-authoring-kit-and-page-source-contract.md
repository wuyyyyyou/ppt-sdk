---
status: accepted
---

# Use one immutable Authoring Kit and Page Source contract

Deck Generation will replace selectable Template groups with one released Authoring Kit. Its Foundation Modules, Reference Library, and README guidance are copied into each Workspace as a conventionally read-only snapshot, while a stable engine-owned Page Source Bootstrap remains outside that snapshot and initializes each new `./slides/<page_id>.tsx` Page Source. Page Sources may import stable Foundation Modules; the README-routed Reference Library is source material to inspect, copy, or rewrite rather than an importable design system.

The engine-owned Deck Manifest is a rebuildable rendering index containing only a deck `title` and ordered slide `id`/`source` pairs, where `source` is a contained relative path string. The new contract has no Template selection, group or catalog metadata, blueprint registry, layout discovery, page data file, per-slide theme, or source type, and it deliberately provides no compatibility or migration path for old manifests, Template groups, or Workspaces.

**Considered Options**

- Keep multiple selectable Template groups. Rejected because their repeated TSX implementations, blueprints, catalogs, and data contracts increase maintenance cost and push Page Authoring toward homogeneous composition.
- Let Page Sources import Reference Implementations directly. Rejected because references would become a large compatibility surface and a de facto fixed design system.
- Keep the old manifest reader as a compatibility adapter. Rejected because the product is still in local development and dual contracts would preserve the complexity this change is intended to remove.

**Consequences**

- The engine format switch must ship with a minimal runnable Authoring Kit, but the full Reference Library can migrate incrementally afterward.
- The Page Source Bootstrap is maintained with the Authoring Kit release resources but is not copied into the Workspace Authoring Kit or versioned as part of its snapshot.
- Old Template directories remain only as temporary migration material and are deleted with discovery, previews, fork logic, and compatibility tests after the new flow is adopted.
- Ordinary Page Authoring may modify only the current Page Source and page-owned assets, never the Workspace Authoring Kit. The current implementation communicates this boundary through layered README guidance and PPT App prompts rather than filesystem permissions, content locks, or compiler restrictions.
