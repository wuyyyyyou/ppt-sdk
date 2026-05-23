# Issue 02: 收敛 DeckGenerationProgress 公开契约与 UI 展示

Status: ready-for-agent
Type: AFK

## Parent

.scratch/deck-generation-flow/PRD.md

## What to build

将 Deck Generation 的进度模型收敛为模块公开的 `DeckGenerationProgress` 契约，让 Workspace 和页面组件只消费稳定的进度数据，而不是直接依赖旧 flow 的内部 phase、retry 常量或 stream identity 规则。

Deck Generation progress 不应再包含 `outline` step，因为 Outline Creation 不属于 Deck Generation。UI 仍应展示生成进度、页面状态、实时 Agent stream、尝试次数和错误信息，但这些信息应来自模块公开契约或模块提供的 presenter/helper。

## Acceptance criteria

- [ ] 新模块公开 `DeckGenerationProgress` / `DeckGenerationStep` 等稳定进度类型。
- [ ] Deck Generation step 不再包含 `outline`，并使用 `page-plan`、`prepare`、`page-authoring`、`page-render`、`page-review`、`final-render`、`complete`、`cancelled`、`failed` 等术语。
- [ ] Brief、Outline、Generating 等现有进度展示仍可显示当前状态、页面列表、stream 活动和错误信息。
- [ ] UI 不再直接 import 生成流程内部 retry 常量。
- [ ] generation history / stream snapshot 的派生规则由模块契约或模块 helper 承担，Workspace hook 不再需要理解 stream identity 细节。
- [ ] mock 单测覆盖关键进度 step 的发射顺序和 history 派生行为。

## Blocked by

- .scratch/deck-generation-flow/issues/01-confirmed-outline-success-path.md

