# Foundation Modules（基础模块）

Foundation Modules 只解决跨页面共享的底层技术问题，不规定页面的视觉风格和构图方式。

- `SlideCanvas.tsx`：提供固定的 `1280 × 720` 画布、裁切边界、相对定位上下文和统一盒模型。

Page Source 可以导入这些模块。Page Authoring Agent 只能修改当前页面的 TSX，不能修改这里的文件。
