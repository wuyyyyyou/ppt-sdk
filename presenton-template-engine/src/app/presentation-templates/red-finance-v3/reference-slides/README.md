# Reference Slides

This folder keeps selected finished pages from the previous generation as
visual and composition references.

They are not V3 generation entrypoints:

- Do not add files in this folder to `group.json.layouts`.
- Do not point `manifest.json` at `reference-slides/*.tsx`.
- Do not copy a reference slide directly as the final answer to a new deck.
- Use them only to study visual density, component combinations, spacing, and
  export-friendly patterns.

When generating a V3 deck, read in this order:

1. `../catalog.json`
2. `../blueprints/README.md`
3. the selected `../blueprints/*.json`
4. `../components/README.md`
5. relevant files in this directory, if visual reference is needed

## Reference Index

| Reference | Source | Extractable pattern | Related V3 blueprints |
| --- | --- | --- | --- |
| `IndustryOverview.tsx` | `red-finance-v2/slides/IndustryOverview.tsx` | left narrative list + right chart + bottom callout | `two-column-insight`, `chart-with-narrative` |
| `MarketTrends.tsx` | `red-finance-v2/slides/MarketTrends.tsx` | top cards + bottom chart panels | `three-column-cards`, `chart-with-narrative` |
| `ChinaUsMarketComparison.tsx` | `red-finance-v2/slides/ChinaUsMarketComparison.tsx` | comparison panels + metrics | `comparison-matrix`, `kpi-summary` |
| `StrategicRoadmap.tsx` | `red-finance-v2/slides/StrategicRoadmap.tsx` | pillars + roadmap + KPIs | `timeline-plan`, `kpi-summary`, `three-column-cards` |
| `ConclusionOutlook.tsx` | `red-finance-v2/slides/ConclusionOutlook.tsx` | summary priorities + actions | `closing-actions`, `three-column-cards` |
