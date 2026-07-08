# Red Finance Canvas slides

这个目录存放 `red-finance-canvas` 具体 deck 的最终页面入口。

本模板组只提供品牌画布和页面框架，不提供成品页结构。生成最终 deck 时，必须把 canvas 里的 slot guide 替换为真实组件组合。

## 使用规则

- `CoverCanvas.tsx` 是 `../blueprints/CoverCanvas.tsx` 的 demo 入口。
- `ContentCanvas.tsx` 是 `../blueprints/ContentCanvas.tsx` 的 demo 入口。
- `SectionFocusCanvas.tsx` 是 `../blueprints/SectionFocusCanvas.tsx` 的 demo 入口。
- 生成具体 deck 时，page plan 应选择 `../blueprints/*.tsx`，prepare 阶段再复制到最终 `slides/page-*.tsx`。
- 先读 `../components/README.md`，再选择组件家族。
- 不要让最终页面保留 `Compose ... here` 一类占位文案。
- 如果结构不合适，直接改 `slides/*.tsx`，不要用 JSON 绕过。
