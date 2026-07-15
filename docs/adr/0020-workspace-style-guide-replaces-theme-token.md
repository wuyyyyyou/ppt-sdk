---
status: accepted
---

# Workspace Style Guide replaces runtime theme tokens

Workspace Style Guide Creation will synthesize the user's style intent, deck context, and optional Selected Style Profile into a Workspace-owned style guidance artifact before Page Authoring. The artifact may contain exact palette and typography values together with qualitative visual rules and allowed variation; every Page Authoring Agent reads it and implements the chosen values in its Page Source rather than relying on renderer-injected theme variables. Its persistence format, generation mechanism, and dedicated read/write interface are deferred to the PPT App workflow design.

This supersedes ADR-0013 and ADR-0014: Template Theme Contracts, Workspace Theme Tokens, JSON Schema theme validation, token fallback, and runtime theme injection are removed. A changed Workspace Style Guide makes affected Page Sources stale and requires re-authoring and review instead of theme-only rerendering.

**Considered Options**

- Keep Theme Token as the sole style source. Rejected because a fixed JSON shape cannot express visual hierarchy, proportional use, semantic restrictions, typography character, composition guidance, and page-level creative freedom with enough fidelity.
- Keep both a Style Guide artifact and generated Theme Token. Rejected because they would create two style sources that can drift and would preserve runtime coupling in Foundation Modules and Reference Implementations.

**Consequences**

- Foundation Modules expose explicit visual inputs or inherit Page Source styles instead of importing a shared theme object.
- Reference Implementations use neutral fallbacks and are adapted according to the Workspace Style Guide.
- The PPT App owns Style Guide generation and persistence; the rendering engine provides no default, fallback, format-specific storage contract, readiness gate, or runtime dependency on it.
- Whole-deck style changes may require re-authoring every affected page, which is accepted because meaningful style changes often include composition, hierarchy, spacing, image treatment, and typography rather than color substitution alone.
