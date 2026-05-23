# Issue 02: 深化 Task State Machine Transition Module

Status: ready-for-agent
Type: AFK

## What to build

将 Task State Machine 中关于 Deck state、Page state、allowed transitions、blocked reasons、recommended action、required inputs 和 expected artifacts 的规则收敛到一个更 Deep 的 Module。现有工具入口应更像 Adapter：读取 Workspace 记录、调用状态规则、写回状态和事件。

完成后，Agent 查询当前 Workspace 状态、推进 Page authoring、锁定页面、生成 promote 指引时，得到的推荐动作和允许操作应来自同一套规则，避免状态语义在多个 Implementation 中漂移。

## Acceptance criteria

- [ ] Page state 的 allowed transitions 只有一处权威实现，查询结果和状态写入使用同一套规则。
- [ ] Page Plan 到 Page Progress 的派生逻辑只有一处权威实现，记录 Outline、更新 Page Plan、开始 Page iteration 时不会各自维护相似代码。
- [ ] recommended action、required inputs、expected artifacts 的派生可以独立测试，并且仍会为 Agent 生成正确的 promote 引用。
- [ ] 为主要状态增加回归测试，至少覆盖 requirements collected、template selected、project forked、outline ready、page iteration active、deck html ready、model ready、pptx ready 和 failed。
- [ ] 相关命名使用项目术语：Workspace、Requirements、Template、Outline、Page Plan、Deck、Generation Step、Promote。

## Blocked by

None - can start immediately

## Comments

来源：架构分析候选 2。当前摩擦点是 transition 规则、Page Progress 派生和推荐动作分散在多个 Module，Locality 不足。
