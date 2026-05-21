# Context

## Glossary

- structured JSON response: a single top-level JSON value that is meant to be consumed by `JSON.parse` without surrounding prose.
- strict JSON protocol: a model response path where the caller requires exactly one structured JSON value and treats format drift as a recoverable failure.
- repair retry: a second attempt after a structured JSON parse failure, using the invalid output as context and asking for a corrected JSON-only response.
- visual self-review: an agent review pass whose goal is to assess rendered slide quality from the screenshot, with rendered HTML available as supporting context.
- HTML fallback: a fallback review path that uses rendered HTML when direct image analysis is unavailable or inconclusive, without changing the review's visual purpose.

## Workspace and Export

- workspace: one PPT task unit rooted at a `ppt-YYYYMMDD-HHmmss` directory under the shared PPT task root.
- review HTML: the rendered deck HTML that the user inspects before export.
- PPTX export: the editable PowerPoint artifact for a workspace.
- PDF export: the share-ready document artifact for a workspace.
- export model: the intermediate presentation model used only to produce a PPTX export.
- freshness: whether a rendered artifact still matches the latest upstream workspace state.
- stale: a rendered artifact that no longer matches the latest upstream workspace state.

## Flagged ambiguities

- export: in this repository, always qualify the target format as `PPTX export` or `PDF export`.

## Example dialogue

Dev: "Is the workspace ready to export?"
Expert: "Yes. The review HTML is approved, so you can create a PPTX export or a PDF export."
