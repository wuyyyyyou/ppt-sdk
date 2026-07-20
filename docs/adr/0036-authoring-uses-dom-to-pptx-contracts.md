---
status: accepted
---

# Authoring uses dom-to-pptx contracts

Page Sources continue to use ordinary TSX, HTML, and CSS rather than adopting a new converter-specific authoring guide. Private annotations owned by the replaced HTML-to-PPTX Model converter, including its screenshot and inline-composition markers, are removed rather than interpreted by a compatibility adapter; `data-presenton-*` rendering and Deck-structure markers remain where they serve engine rendering rather than the old converter.

The migration must distinguish obsolete private attributes from native `dom-to-pptx` attributes such as `data-pptx-notes` and supported animation metadata. The upstream skill and capability documents remain in the vendored source for converter maintenance but are neither copied nor distilled into the Workspace Authoring Kit. Unsupported ordinary page constructs are fixed in the vendored converter by default; only intrinsic, demonstrated limitations justify a minimal Authoring Kit restriction.

Because the product remains in local development, this migration does not convert legacy Workspace Deck HTML, Page Source annotations, or PPTX export job state. Such Workspaces must be regenerated under the new contracts; already recorded export files may remain as files but do not create a compatibility obligation.

The default generator does not switch until the vendored converter preserves the visual intent of the radial-gradient backgrounds already used by real Page Sources. The implementation belongs in `dom-to-pptx`, produces a radial-gradient image representation when supported, and falls back deterministically for unparseable cases rather than silently omitting the background; `ppt-engine` does not special-case gradient CSS.

The required radial-gradient subset covers non-repeating circle or ellipse gradients, optional common positions, ordinary CSS colors, and percentage color stops, including the real `radial-gradient(circle, rgb(...) 0%, rgb(...) 100%)` Deck input. Repeating gradients, layered backgrounds, and complex calculated color syntax are not promised initially; parsing failure uses the first parseable opaque stop as a solid fallback and emits a warning.

PPTX export defines no additional CSS allowlist or unknown-property rejection pass. The vendored converter handles ordinary browser CSS best-effort, records unsupported or degraded behavior as diagnostics where possible, and is extended when real Page Sources reveal material gaps; only explicitly defined artifact-integrity gates block export.
