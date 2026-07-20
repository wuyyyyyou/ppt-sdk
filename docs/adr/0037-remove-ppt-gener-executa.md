---
status: accepted
---

# Remove the ppt-gener Executa

The `ppt-gener` Executa is removed completely when `ppt-engine` assumes the full PPTX export job; it is not retained as a fallback, feature-flag branch, dormant bundled tool, or separately released Binary. The removal includes its source tree, App bundled handle and tool-ID plumbing, generated and source manifests, synchronization and validation logic, frontend adapters and types, tests and fixtures, packaging scripts, release workflows, and documentation.

The project is still in local development and has no production Workspace or rollback compatibility requirement that justifies two generators. Git history remains the only reference for the old Python generator.

The old HTML-to-PPTX Model path is removed in the same migration, including `PptxPresentationModel`, `convertDeckHtmlToPptxModel`, model files and public exports, tests, CLI and tool contracts, task-state-machine instructions, development pipelines, Binary smoke expectations, and documentation. The supported generation chain becomes `manifest.json -> deck.html -> .pptx`, with no dormant model conversion path.

PDF export remains an independent `ppt-engine` path from its existing page HTML inputs and does not route through `dom-to-pptx` or a generated PPTX.

The `ppt-engine` Binary smoke test replaces its PPTX Model assertion with generation and validation of a real PPTX through the packaged browser distribution and managed Chrome.

The final Binary smoke fixture is a two-page, fixed-size, offline Deck covering ordered page selection, text and basic shapes, a local image, SVG, a radial-gradient background, and a speaker note. Smoke validation checks the produced ZIP/OOXML basics including page count, dimensions, and notes without depending on remote resources, platform-specific fonts, animation, or pixel-identical rendering.

The `ppt:generate-tsx` development pipeline remains, but its model stage is replaced by direct generation through the internal `dom-to-pptx` Module from a single-page Deck HTML document. It does not invoke the public Workspace job or reintroduce a general Executa conversion tool, and it may continue its optional PPTX rasterization comparison.

PPTX export support follows the existing `ppt-engine` Binary platform matrix. Removing the separate generator does not retain Linux ARM64 through another browser or conversion implementation.

Existing historical `ppt-gener` GitHub Releases and assets are retained as remote history, but the repository removes every workflow and reference capable of building or publishing new ones.
