# Issue 01: 建立 Deck Generation Module 的 Confirmed Outline 成功路径

Status: ready-for-agent
Type: AFK

## Parent

.scratch/deck-generation-flow/PRD.md

## What to build

建立独立的 Deck Generation Flow Module，并让它完成从 Confirmed Outline 到最终 Deck 的最窄成功路径。Workspace 的 Outline Review 入口应改为调用这个模块，而不是直接理解完整生成闭环。

这个 slice 的目标是先打通一条可测试、可演示的 tracer bullet：Confirmed Outline 进入模块后，模块完成 Page Plan、页面文件准备、逐页生成通过、最终 Deck 渲染，并返回 completed completion。用户在 Outline Review 中确认后仍进入原有 Review 体验。

同时为 `ppt-app` 增加轻量 mock 单测入口，并覆盖这条成功路径，确保后续 issue 可以在这个模块边界上继续扩展。

## Acceptance criteria

- [ ] 存在独立 Deck Generation Flow Module，调用方不再从 Workspace orchestration 直接依赖旧的 Confirmed Outline 生成实现。
- [ ] 模块主入口只接受 Confirmed Outline 作为 Deck Generation 的输入，不接受 Brief。
- [ ] 从 Outline Review 确认生成 Deck 的路径仍然可用，最终 Deck 预览行为保持一致。
- [ ] 成功路径会依次完成 Page Plan、页面文件准备、页面 authoring / render / self-review、最终 Deck render。
- [ ] 成功路径返回结构化 completed completion，并包含渲染后的 Deck 结果与 Page Progress。
- [ ] `ppt-app` 增加可运行的轻量单测入口。
- [ ] 增加 mock 单测覆盖 Confirmed Outline 到 completed completion 的成功路径。
- [ ] 命名使用项目术语：Workspace、Confirmed Outline、Page Plan、Deck、Deck Generation、Generation Step。

## Blocked by

None - can start immediately

