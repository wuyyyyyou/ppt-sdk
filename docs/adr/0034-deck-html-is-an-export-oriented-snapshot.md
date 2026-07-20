---
status: accepted
---

# Deck HTML is an export-oriented snapshot

Final Deck Render will produce one static `deck.html` containing every accepted page in order and in a directly measurable fixed-size layout. It will not contain the legacy sidebar, toolbar, active-page visibility state, viewer scaling, navigation script, or a separate Preview Mode; PPT App review continues to use the page screenshots produced alongside the page HTML snapshots.

Final Deck Render generates page HTML and screenshots together with this Deck document, returns its path as an explicit top-level `deck_html_path`, and records that exact path in `final_deck_render.deck_html_path`. A first-page HTML path is not a Deck path, and PPTX export reads the recorded Deck path without scanning the output directory or deriving a filename.

Each Page Source executes once per Final Deck Render. Page HTML snapshots, the ordered Deck snapshot, and page screenshots are derived from the same prepared render plan rather than rerunning Page Sources for different artifacts.

The Deck document has one `#presentation-slides-wrapper`; its direct children carrying `data-presenton-slide-shell="true"` are the only slide collection contract, and their DOM order is the presentation order. Every slide shell remains visible at the fixed `1280 × 720` viewport size without viewer transforms or overlapping absolute positioning. No additional PPTX-specific slide marker is introduced.

The wrapper is a plain `1280px`-wide vertical document flow, and its slide shells are contiguous without gap, margin, padding, shadow, viewer background, or other framing decoration. Each shell clips its own fixed canvas, while no Deck-level decoration can be mistaken for slide content.

The first PPTX export contract is fixed at a `1280 × 720` browser viewport mapped to a `13.333333 × 7.5` inch widescreen presentation. Export does not infer dimensions from the DOM or accept mixed, 4:3, or custom page sizes; a Deck containing a differently sized slide is structurally invalid for PPTX export.

The first integration does not enable `dom-to-pptx` automatic font embedding. It preserves the upstream capability for a future explicit, licensed Workspace font-asset contract, while current exports continue to rely on presentation-viewer font availability and fallback rather than scanning and embedding arbitrary local or remote fonts.

SVG export initially prioritizes browser visual fidelity with `svgAsVector` disabled. This does not rasterize the whole slide or prevent ordinary DOM text and shapes from remaining editable; it retains the upstream vector option for later use with SVG classes that have passed compatibility validation.

Final Deck Render represents a non-empty page speaker note only as an inert `<template data-pptx-notes>` inside that page's slide shell, matching the native `dom-to-pptx` contract. The legacy `data-speaker-note` shell attribute is not retained as a second representation.

PPTX validation requires every visible slide image source that participates in conversion to be successfully loaded, readable by the converter, and measurable before conversion. This includes image elements, picture sources, CSS backgrounds, SVG image references, and data or Blob URLs while ignoring hidden and non-slide resources. A failed or CORS-unreadable image fails the whole job with page-local diagnostics rather than producing a successful artifact with missing visuals; export does not download, copy, replace, or otherwise repair resources, and sensitive URL query data is not emitted in errors.

Remote image references retain the Deck Snapshot's original loading semantics: managed Chrome may request them during export, but the export job does not proactively mirror or rewrite them. Network or CORS failure is handled by the same image-integrity gate, while release smoke fixtures remain fully offline.

Font readiness is best-effort: export waits for the browser font set to settle, but a failed font may use browser fallback and records a backend warning rather than failing the PPTX job. Automatic font embedding remains disabled.

Formal export always retains `dom-to-pptx` PPTX normalization and does not expose `skipNormalize`; raw PptxGenJS output is limited to converter-local debugging.

After a basic filesystem check, structural, fixed-size, visibility, image, and font validation runs against the same managed Chrome page later used for conversion. No separate Node HTML parser or second page load defines a competing view of Deck validity.

PPTX export consumes this `deck.html` directly rather than creating a second export-only HTML document or rewriting hidden pages at export time. This decision supersedes ADR-0021 only where that ADR allowed the Deck snapshot to retain an engine-owned viewer script; its staticization and Page Source authority decisions remain active.

Page generation and modification workflows own rebuilding `deck.html` after accepted page changes. PPTX export only requires an existing structurally valid Deck document; it does not compare Page Source fingerprints, compute a freshness key, or regenerate the Deck document implicitly.

A missing, unreadable, or structurally invalid `deck.html` fails the PPTX export job with an actionable error. Export never invokes Final Deck Render as a fallback.

`deck.html` does not embed the `dom-to-pptx` browser distribution. After opening the unchanged file in its managed Chrome page, `ppt-engine` loads that distribution into the page's runtime memory and invokes it against the slide collection; closing the page discards the loaded library without modifying the Workspace HTML artifact.

PPTX conversion and file creation are entirely backend-owned. The managed headless Chrome creates the PPTX Blob, transfers it to the `ppt-engine` Node process in bounded chunks, and Node writes a temporary Workspace file before atomically publishing `output/deck.pptx`; the App frontend receives neither the HTML nor PPTX bytes and only starts the job, observes status, and prepares the completed Export Artifact for download. This replaces the upstream Node exporter's single base64 data-URL transfer without changing its DOM conversion implementation.
