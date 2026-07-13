# Agent Freestyle v2 基础组件

这里的组件可以直接用于最终页面，但都只解决技术问题，不规定页面构图：

- `SlideCanvas`：固定 1280x720 画布和基础主题入口。
- `StableInlineRow`：减少行内图标、数字和文字在 HTML/PPTX 间的排版漂移。
- `MeasuredChartArea`：为图表提供稳定的实际宽高。
- `SlideIcons`：中性命名的常用图标集合。
- `LocalImage`：把本地绝对路径转换为渲染器可访问的 `file://` URL。

按页面需要使用，不要求复用，也不要为了使用组件而改变页面构图。
