---
status: accepted
---

# Use Visual Style Presets for optional template selection

PPT App 的“模板”采用新的领域概念 `Visual Style Preset（视觉风格预设）`，不复用已废弃的可执行 Template Group（模板组）、布局、蓝图或 Authoring Kit。用户在 Brief 页面可以选择一个内置预设，也可以选择不使用模板；选择预设后，演示需求中的 Visual Tone 由预设的 `name` 和 `description` 取代，完整的预设 Style Guide 作为 Workspace 独立的 `style-guide.md` 快照保存。

预设源文件和预览图片属于前端静态资源，按 `src/features/templates/presets/<preset-id>/` 目录组织。每个目录包含规定名称的 `preset.json` 和 `images/` 子目录；Vite 构建时自动发现 JSON，并将 JSON 中的相对图片路径解析为构建后的静态 URL。完整 `style_guide` 字符串保存在该 JSON 中，不上传预览图片，也不将预览图片提供给 AI。模板选择在 Brief 页面只形成草稿，用户确认演示需求时才通过现有 Host Upload 提交 Style Guide，并由后端原子地确认需求、提交或清理 Style Guide、重置下游大纲。需求草稿可携带可替换的预设 ID 和版本，但只有确认后才形成 Workspace 权威快照。

未选择模板时保持现有 Visual Tone 和 LLM Style Guide 生成流程。选择或取消模板会要求重新生成演示需求；用户在 Brief 页面修改模板后不能继续确认旧需求，确认新的需求后才清理旧的下游产物。模板模式下 Deck Refinement 使用独立的 Prompt/Schema，不返回 `style_guide_change`，模板 Style Guide 不可被替换；用户本轮 Refinement Request 仍传给目标页面，并在页面创作时优先于模板指导。Page Visual Review 只检查溢出、截断、可读性、对比度、缺失视觉元素、异常空白和画布边界，不检查模板风格一致性。

## Considered Options

- 复用旧 Template Group：拒绝。旧契约包含可执行页面模板和布局语义，与 Authoring Kit 主路径及本预设的文字指导职责不同。
- 将预设 Style Guide 只保留在前端 URL：拒绝。生成和恢复必须依赖 Workspace 快照，不能依赖当前 bundle 或 catalog。
- 模板模式继续让 LLM 生成或替换 Style Guide：拒绝。预设的完整 Style Guide 是用户选择的固定视觉权威，页面 Agent 可以被本轮用户 Refinement Request 覆盖，但不能改写共享文件。
