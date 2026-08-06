# Authoring Kit（创作套件）

Page Authoring Agent 只能读取这里的内容，不能修改其中的文件。

- 开始创作前先读 `foundations/README.md`，确认当前 Page Source 必须使用的稳定模块。
- 需要图表、卡片、比较、时间线、图片或页面组合参考时，再读 `references/README.md`。
- Page Source 可以 import `foundations/`，但不能 import `references/`。
- 根据 Workspace Style Guide 调整视觉，不要把参考实现当作固定模板。

真正参与演示文稿渲染的 Page Source 位于 Workspace 的 `slides/` 目录，不属于 Authoring Kit。

## Persistent Elements Reference（跨页固定元素参考）

Workspace 根目录的 `persistent-elements.tsx` 是本 Deck 的只读视觉参考，不是运行时共享模块，Page Source 不得 import 它。页面 Agent 必须先完整读取它，再自行判断当前页是否需要页眉、页脚、页码或持续装饰；如果使用，复制其 JSX 结构、位置、字体、字号、颜色和间距。特殊页可以省略或调整。

页码数值由渲染器替换。保留以下标记：`data-presenton-page-number="current"` 表示当前页（1-based），`data-presenton-page-number="total"` 表示 Deck 总页数；可选 `data-presenton-page-number-pad="2"` 表示至少两位补零。标记中的数字只是示意，分隔符和视觉样式由 Page Source 自己控制。
