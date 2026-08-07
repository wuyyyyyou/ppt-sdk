# Authoring Kit（创作套件）

Page Authoring Agent 只能读取这里的内容，不能修改其中的文件。

- 开始创作前先完整读取 `presentation-principles.md`，掌握页面角色、信息层级、图表数值可读性和正式汇报封面原则。
- 开始创作前先读 `foundations/README.md`，确认当前 Page Source 必须使用的稳定模块。
- 需要图表、卡片、比较、时间线、图片或页面组合参考时，再读 `references/README.md`。
- Page Source 可以 import `foundations/`，但不能 import `references/`。
- 根据 Workspace Style Guide 调整视觉，不要把参考实现当作固定模板。

真正参与演示文稿渲染的 Page Source 位于 Workspace 的 `slides/` 目录，不属于 Authoring Kit。

## Persistent Elements Reference（跨页固定元素参考）

Workspace 根目录的 `persistent-elements.tsx` 是本 Deck 的只读视觉参考，不是运行时共享模块，Page Source 不得 import 它。页面 Agent 必须先完整读取它，再自行判断当前页是否需要页眉、页脚、页码、持续装饰、页面标题或副标题；如果使用，复制对应示例的 JSX 结构、位置、字体、字号、字重、是否斜体、颜色和间距。特殊页可以省略或选择适用的标题处理变体。

文件中的标题和副标题只描述视觉处理，不是页面内容、事实来源或固定文案。普通页面创作时，页面标题必须替换为当前页 Outline 标题；人工页面修订时应保留用户最新人工内容，除非本次优化明确要求改变标题。副标题只有在页面确实需要时才添加，并使用当前页允许的内容依据。不要复制参考文件中的示意文字，也不要仅为填充空间而添加副标题。普通页面通常只需要主标题处理，封面、章节页或结尾页只有在视觉角色确实不同的时候才使用额外变体。页面源仍然独立保存这些复制后的 JSX，不得 import 或修改该参考文件。

页码数值由渲染器替换。保留以下标记：`data-presenton-page-number="current"` 表示当前页（1-based），`data-presenton-page-number="total"` 表示 Deck 总页数；可选 `data-presenton-page-number-pad="2"` 表示至少两位补零。标记中的数字只是示意，分隔符和视觉样式由 Page Source 自己控制。
