# Red Blue Comparison Canvas 蓝图说明

`red-blue-comparison-canvas` 是 component-first / canvas-first 的 Red Blue Comparison 模板组。它保留 v1 的组件能力和对比版式语言，但主题契约使用 `sideA` / `sideB` / `comparison` / `neutral` 语义 token，不把颜色名作为可变主题接口。

## Agent 阅读顺序

1. 先读 `../catalog.json`，判断当前页面应选哪类 canvas。
2. 必须读 `../components/README.md`，确认组件 slot、文本容量和导出注意事项。
3. 再读对应的 `./*.tsx`，复制或派生到 `../slides/*.tsx`，把 slot guide 替换为真实组件组合。
4. 如果页面需要行业页参考，可以参考 Red Blue Comparison v1，但不要直接复制它的成品页面结构。

## 核心约定

- Canvas blueprint 是品牌框架，不是最终页面答案。
- 最终注册入口必须在 `../slides/*.tsx`。
- `group.json.layouts` 和 `manifest.json source.path` 只引用 `slides/*.tsx`。
- `data/demo` 只放内容数据，不放布局、组件选择或页面结构决策。
- source HTML、外部成品页或具体业务页面不要硬塞进 canvas。

如果最终页面只是把 canvas 占位文字换了文案，说明还没有完成本模板组的目标。
