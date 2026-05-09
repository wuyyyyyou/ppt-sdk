# Red Finance V3 Blueprints

`red-finance-v3` is blueprint-first. Agents should choose a blueprint after
they understand the deck outline, then map content into slots and allowed
component families before writing or editing slide data.

Blueprints are design-time contracts for agents. They are not a new runtime
engine and are not parsed automatically by the current renderer.

## Read Order

1. Read `../catalog.json` for the quick blueprint index.
2. Read the selected `blueprints/*.json` file for slot and variant rules.
3. Use `slide_renderer` only after the content fits the blueprint intent.
4. Use `../components/README.md` when selecting components inside a slot.
5. Use `../reference-slides/` only for visual density and composition patterns.

## Core Fields

- `id`: Stable blueprint id. Use lowercase kebab-case.
- `name`: Human-readable name.
- `description`: Structural purpose, not a business topic.
- `implementation_status`: `implemented` when the renderer exists and is in the
  current V3 baseline, `planned` when the blueprint contract is defined before
  the renderer is implemented.
- `slide_renderer`: Relative path to the intended slide renderer.
- `layout_family`: Broad structure family such as `cover`, `two-column`, or
  `matrix`.
- `content_intents`: Content goals this blueprint can express.
- `suitable_for`: Chinese task labels or situations where this structure works.
- `avoid_for`: Explicit exclusion rules.
- `slots`: Slot contracts. Slots describe semantic responsibilities, allowed
  component families, item limits, and text limits.
- `variants`: Layout variants the agent can select without changing the
  blueprint.
- `density_range`: Supported density levels.
- `component_families`: Families used by the blueprint.
- `agent_selection_rules`: Practical selection rules for agents.
- `export_notes`: PPTX export guidance. Keep important text as DOM text; allow
  decorative or complex charts to be screenshot fallback where appropriate.

## Slot Rules

Each slot must say what content it owns and how flexible it is:

- `required` means the slide should not render without that slot.
- `allowed_component_families` limits broad choices.
- `allowed_components` gives preferred concrete components.
- `content_type` describes the expected data shape.
- `min_items` and `max_items` prevent overcrowding.
- `text_limits` keeps generated content inside the designed area.
- `can_reorder` allows the agent to change item order.
- `can_replace` allows equivalent components from the same family.

## Slot To Component Families

Use the slot type as the first decision point:

| Slot type | Component families | Notes |
| --- | --- | --- |
| `page-title` | `page-shell`, `heading` | Page frame and title only. |
| `section-heading` | `page-shell`, `heading` | Use for chapter statements and section intros. |
| `narrative-text` | `heading`, `card` | Keep text short and editable. |
| `bullet-list` | `card` | Use card components with item limits. |
| `metric` | `primitive`, `kpi`, `card` | Values and units must remain editable. |
| `kpi-strip` | `primitive`, `kpi` | Compact horizontal metric summaries. |
| `chart` | `chart` | Chart body can screenshot; titles and conclusions stay editable. |
| `matrix` | `matrix` | Keep row and cell text editable where possible. |
| `comparison` | `matrix`, `card`, `kpi` | Use matrix for multidimensional comparison, cards for short explanations. |
| `timeline` | `timeline` | Only use when content has order or phases. |
| `callout` | `card` | One concise conclusion or warning. |
| `decoration` | `decoration` | Never put critical facts here. |
| `footer-meta` | `page-shell`, `primitive` | Footer, page number, brand/meta text. |

If a slot needs a family that is not listed in the selected blueprint, switch
blueprints or revise the slot mapping before editing TSX.

## Implementation Status

Task 02 defines all nine first-wave blueprints. Task 04 implements the matching
renderer set, so all first-wave blueprints are marked `implemented` in this
baseline.
