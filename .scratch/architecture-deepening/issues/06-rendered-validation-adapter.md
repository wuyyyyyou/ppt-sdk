# Issue 06: rendered validation 适配器重构

Status: ready-for-agent
Type: AFK

## What to build

将 rendered validation 改造成消费共享 Render Plan 和共享浏览器运行时 Helper 的 Adapter。

这个 slice 只处理 validation 路径：继续保留现有 validation 输出和诊断语义，但不再维护一份独立的 Chrome 查找、浏览器启动和 render-ready 等待逻辑。validation 应该直接复用前面已经抽出的计划与运行时基础能力。

## Acceptance criteria

- [ ] rendered validation 复用共享浏览器运行时 Helper，不再维护自己的 Chrome 查找逻辑。
- [ ] rendered validation 复用同一份 Render Plan，而不是单独再做一次 manifest 解析。
- [ ] rendered validation 的成功、失败和 timeout 行为保持兼容。
- [ ] validation 输出的 summary、diagnostics 和 artifact 路径保持兼容。
- [ ] 为 validation 增加测试，至少覆盖一个成功路径、一个非法 manifest 路径和一个 render-ready 失败路径。

## Blocked by

- Issue 04
- Issue 05

