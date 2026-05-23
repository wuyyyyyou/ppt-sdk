# Issue 06: 保留 Brief 一键生成入口并移除 Brief-based Deck Generation API

Status: ready-for-agent
Type: AFK

## Parent

.scratch/deck-generation-flow/PRD.md

## What to build

保留用户从 Brief 一键生成 Deck 的体验，但让 Workspace 层先完成 Outline Creation，再把 Confirmed Outline 交给 Deck Generation Flow Module。Deck Generation Module 不应暴露接受 Brief 的 API。

当 `reviewOutlineFirst=true` 时，Brief 入口仍生成 Outline Draft 并停在 Outline Review。当 `reviewOutlineFirst=false` 时，Brief 入口先完成 Outline Creation，将 Outline 保存为 Confirmed Outline，再调用 Deck Generation Module。最终 Progress、取消、失败提示和 Deck Review 行为应与 Confirmed Outline 入口保持一致。

## Acceptance criteria

- [ ] Brief 一键生成 Deck 路径仍然可用。
- [ ] `reviewOutlineFirst=true` 时仍生成 Outline Draft，并停在 Outline Review。
- [ ] `reviewOutlineFirst=false` 时先完成 Outline Creation，保存为 Confirmed Outline，再调用 Deck Generation Module。
- [ ] Deck Generation Module 不再暴露接受 Brief 的 public API。
- [ ] Brief 入口中的 Deck Generation progress 不包含 `outline` step；Outline Creation 进度由 Workspace 前置处理。
- [ ] Brief 入口与 Confirmed Outline 入口在取消、失败提示和最终 Deck Review 行为上保持一致。
- [ ] mock 或类型层测试覆盖 Brief thin adapter 不绕过 Confirmed Outline 边界。

## Blocked by

- .scratch/deck-generation-flow/issues/01-confirmed-outline-success-path.md
- .scratch/deck-generation-flow/issues/02-progress-contract-and-ui.md
- .scratch/deck-generation-flow/issues/03-structured-completion.md

