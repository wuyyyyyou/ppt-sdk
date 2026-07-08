# 风格画像需求总目标

为 `ppt-app` 增加一条独立的风格画像链路：用户可以上传参考 PPT 截图或图片，通过 Agent 分析其视觉风格，生成一份可复用的本地 `style-profiles`（风格画像库）记录。

总体方向：

- 新增全局可复用的 `style-profiles` 存储，不绑定单个 workspace，方便用户创建新 PPT 时选择。
- 新增独立入口用于“分析参考资料并保存风格画像”，该入口不负责生成 PPT。
- 新建 PPT 时允许选择已有风格画像，并把选择结果记录到当前 workspace，保证可追踪、可复现。
- 生成链路中，主题生成 prompt 需要加入选中的 style profile；页面 authoring prompt 也需要加入同一份简短风格指导。

实施阶段：

1. 后端先补 PPT 转图片能力。Agent 可以直接分析图片，但不能直接稳定分析 PPTX；因此 `ppt-engine` 需要提供把 `.pptx` 转为逐页 PNG 并返回图片路径/页码/尺寸等元数据的通用工具。该工具只接受调用方传入的绝对 PPTX 输入路径和绝对输出目录，不绑定 `style-profiles` 或任何具体 app 工作流。第一版优先评估并使用 `pptx-svg`，避免依赖本机 LibreOffice；对外以 PNG 作为 Reference Slide Image，SVG 只作为中间/诊断产物保留。PNG 按原 PPTX 页面比例输出，目标高度固定为 720，不裁剪、不拉伸。该方案允许 `ppt-engine` 运行和打包基线提升到 Node.js 22+。
2. 新增风格画像后端链路。支持用户上传 PPT/图片，触发 Agent 基于图片集合分析视觉风格，输出并保存 style profile；同时建立全局风格画像存储和 API，并在主题生成、页面 authoring 中注入选中的风格画像。
3. 前端适配。新增独立的风格画像创建/分析入口；新建 PPT 时支持选择已有风格画像，并把选择结果写入当前 workspace。

边界约束：

- 风格画像不是事实证据，不应混入 Research Evidence 或 Uploaded Source Analysis 的 grounding 链路。
- MVP 优先支持图片/截图风格参考；PPTX 导入可作为后续扩展。
