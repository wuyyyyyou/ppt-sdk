---
status: accepted
---

# Persist browser-rendered static HTML snapshots

All manifest-based render entry points will use executable production React HTML only as an internal temporary document, then persist browser-rendered static DOM HTML for both individual pages and the ordered Deck. This keeps Page Source as the sole authoritative render source while making the generated HTML directly inspectable and consumable by screenshots and HTML-to-PPTX conversion without rerunning Page Source code.

The shared staticization path will preserve the rendered DOM structure, ordinary image/font/resource links, and captured stylesheet rules; it will remove Page Source scripts and React runtime behaviour, convert non-persistent Canvas or blob content into embedded data, and may retain only the engine-owned Deck viewer script. Tailwind will use the exact locally packaged official browser release selected at implementation time (`@tailwindcss/browser` 4.3.2), its generated CSS will be embedded in the static HTML, and the Tailwind browser runtime will ship in `dist` and the existing SEA binary assets rather than load from a CDN.

Static HTML generation requires the same managed local Chrome discovery used by existing screenshot and PPTX conversion paths. Rendering must reach bounded Render Readiness before capture, the persisted static HTML is reopened before screenshot or model extraction, failures never fall back to executable HTML, and normal content resource links are not copied into a new asset store.

**Considered Options**

- Keep production/minified executable React HTML as the final artifact. Rejected because every reopen reruns Page Source code and retains a large implementation runtime in a derived render artifact.
- Server-render React markup without a browser. Rejected because it cannot reliably capture browser layout, Recharts SVG, effects, fonts, images, Canvas, or final computed styles.
- Make snapshots fully self-contained by copying every local and remote resource. Rejected as unnecessary scope: this decision changes DOM materialization, while ordinary resource links retain their existing semantics.

**Consequences**

- Every manifest render API that writes HTML requires managed Chrome, including HTML-only page builds.
- Page-level React interactions are not preserved; Deck navigation may remain through a small engine-owned viewer script.
- The runtime HTML is never published as a normal output, and all manifest render entry points share one internal staticization implementation.
