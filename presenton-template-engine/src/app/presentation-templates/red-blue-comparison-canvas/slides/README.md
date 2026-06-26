# Red Blue Comparison Canvas slides

`slides/*.tsx` 是模板注册入口。这里的文件只 re-export `../blueprints/*.tsx`，用于 `group.json.layouts` 和 `manifest.json`。

生成真实 deck 时，AI Agent 应从相应 canvas 派生新的 `slides/*.tsx` 页面，并把 slot guide 替换为组件组合。不要让最终页面停留在原始 canvas 占位状态。
