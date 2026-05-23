# Issue 01: 深化 Deck Generation Flow Module

Status: ready-for-agent
Type: AFK

## What to build

将 Deck Generation 的前端编排深化成一个更清晰的 Module，让 Workspace 页面只负责发起生成、展示 Progress、处理取消和导航。生成过程中的 Outline 到 Page Plan、逐页 authoring、render-fix、self-review、重试策略、日志记录和最终 Deck 渲染，都应收敛到同一个可测试的流程 Implementation 后面。

完成后，用户从 Brief 或 Confirmed Outline 启动 Deck Generation 的体验不变，但维护者不需要在 Workspace 页面状态里理解完整生成闭环；调用方只通过一个较小的 Interface 观察生成进度和结果。

## Acceptance criteria

- [ ] 从 Brief 启动 Deck Generation 和从 Confirmed Outline 启动 Deck Generation 两条路径都仍然可用，并且 Progress 展示、取消、失败提示和最终 Deck 预览行为保持一致。
- [ ] 生成流程的 prompt 组装、重试上限、render-fix、自评失败处理、Agent 基础设施错误处理和日志写入集中在流程 Module 的 Implementation 中，Workspace 页面不再直接拼装这些规则。
- [ ] 为流程 Module 增加覆盖关键状态推进的测试，至少覆盖成功路径、render 失败后修复、self-review 失败后修复、取消和不可恢复错误。
- [ ] 相关命名使用项目术语：Workspace、Brief、Outline、Confirmed Outline、Page Plan、Deck、Deck Generation、Generation Step。

## Blocked by

None - can start immediately

## Comments

来源：架构分析候选 1。当前摩擦点是 Deck Generation 的 Interface 偏大，UI 状态和生成策略的 Seam 不够清晰。
