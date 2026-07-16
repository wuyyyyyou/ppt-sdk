# Foundation Modules（基础模块）

Page Source 可以 import 这里的稳定模块，但不能修改它们。

- `SlideCanvas.tsx`
  - 每个 Page Source 必须用它作为根画布。
  - 提供固定 `1280 × 720` 尺寸、裁切和定位上下文。
- `StableInlineRow.tsx`
  - 图标、数字、单位或短文本必须稳定保持在同一行并保持 PPTX 导出对齐时使用。
  - 多行正文不要使用。
- `IconText.tsx`
  - 需要“图标 + 单行标签”并保持 PPTX 导出对齐时使用。
  - 纯装饰图标或多行文字不要使用。
- `MeasuredChartArea.tsx`
  - Recharts 图表依赖父容器真实宽高时必须使用。
  - 图表已有明确固定宽高时不需要使用。
