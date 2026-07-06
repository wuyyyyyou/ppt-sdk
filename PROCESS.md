# PPT App Theme Tokenization Process

## 目标

将模板主题从“固定主题集合 + `manifest.theme.colors`”迁移到“模板本地 theme token”。长期目标是让 LLM 根据用户输入和模板 token 契约生成 `theme/token.json`，模板组件只消费 token，不再依赖固定 6 组颜色。

当前阶段先做模板级基础设施和模板迁移，不接入 LLM 生成流程。

## 当前约定

- tokenized template 的主题主源是 workspace/local 的 `theme/token.json`，不存在时 fallback 到源模板提交的 `theme/token.default.json`。
- 模板 theme 目录提交 `token.schema.json`、`token.default.json`、`README.md`，也可以提交命名预设，例如 `token.dark-orange.json`；源模板不提交 `token.json`。
- `theme/token.json` 是本地可变测试/工作区主题文件，用于快速修改后观察渲染效果，应通过 `.gitignore` 排除。
- `manifest.theme.colors` 不再作为 tokenized template 的颜色来源；tokenized template 应移除 `manifest.theme`，避免两套主题源打架。
- `tokens.ts` 负责把组件消费层统一到 `--theme-color-*` / `--theme-shadow-*` CSS vars；组件、slides、blueprints 不应继续散落主题色硬编码。
- render layer 已支持读取 token 文件并注入 `--theme-*` 和 `*-rgb` CSS vars。
- fork/build 链路已支持复制 `theme/`，workspace fork 时会从 token default 初始化工作区主题。
- 本阶段不做硬编码颜色扫描校验，靠模板迁移和 review 控制。

## 已完成

`red-finance-v3` 已完成首轮 token 试点：

- 增加 `theme/token.schema.json`、`theme/token.default.json`、`theme/README.md`，并保留 `theme/token.dark-orange.json` 作为命名预设。
- 默认 fallback 主题为红色金融风格；本地 `theme/token.json` 可用于临时测试黑橙暗色等效果，但不提交。
- 移除 `manifest.theme`，真实颜色来源改为 theme token。
- `theme/tokens.ts` 已改为读取 `--theme-color-*` / `--theme-shadow-*`。
- 真实生成路径中的 components、blueprints、slides、demo data 已尽量迁移为从 token 消费颜色。
- 图表默认不再从 data 写颜色，改由 `chart1..chart6` token 控制。
- placeholder / fallback 视觉已改为 token-aware。
- `reference-slides/` 保持只读参考，不作为本阶段迁移目标。

相关架构记录见 `docs/adr/0013-template-theme-token-source.md`。

`red-finance-canvas` 已按同一机制完成迁移：

- 增加 `theme/token.schema.json`、`theme/token.default.json`、`theme/README.md`，并保留 `theme/token.dark-orange.json` 作为命名预设。
- 不提交 `theme/token.json`；该文件继续作为本地测试/工作区主题文件。
- 移除 `manifest.theme`，真实颜色来源改为 theme token。
- `theme/tokens.ts` 已改为读取 `--theme-color-*` / `--theme-shadow-*`。
- components 已对齐 `red-finance-v3` 的 token 消费方式，图表默认由 `chart1..chart6` token 控制。
- canvas 独有的 `blueprints/ContentCanvas.tsx`、`blueprints/CoverCanvas.tsx`、`blueprints/SectionFocusCanvas.tsx` 已迁移 slot guide 和占位视觉用色。
- starter `manifest.json` 的每页需要保留 `data_path` 指向 `data/demo/*.json`，否则 VSCode pipeline 会向 slide 传 `{}`，导致 starter deck 看起来像空页。
- canvas / slide 中的图标+文字行应使用 `IconText` 或 `StableInlineRow` 的 `data-pptx-inline-*` 语义结构，不要手写 `svg + 直接文本节点`，否则 HTML 预览可能正常但 PPTX model 丢文字。
- 已通过 `presenton-template-engine` 的 `npm run check` 和 `npm run build`。

`red-blue-comparison-v1` 已完成 token 迁移：

- 增加 `theme/token.schema.json`、`theme/token.default.json`、中文 `theme/README.md`，并保留 `theme/token.dark-orange.json` 作为黑金命名预设。
- 不提交 `theme/token.json`；该文件继续作为本地测试/工作区主题文件。
- 移除 `manifest.theme`，真实颜色来源改为 theme token。
- `theme/tokens.ts` 已改为读取 `--theme-color-*` / `--theme-shadow-*`，并提供 alpha helper 复用 `*-rgb` CSS vars。
- 该模板的核心主题语义是双方对比，不应把可变契约命名为 red / blue。使用 `sideA`、`sideB`、`comparison`、`neutral` 表达两个被比较对象、对比框架和中性语义。
- components、blueprints、demo data 已从 `red` / `blue` / `purple` tone 迁移到 `sideA` / `sideB` / `comparison` / `neutral`。
- demo data 默认不再写 `color`、`fillColor`、`textColor`；图表、产业结构、年龄结构等默认颜色由 token fallback 控制。
- 暗色主题回归时修复过 `bg-white` card 和 `border-white` 时间线节点描边这类硬编码白色。后续迁移同族模板时要重点扫描 `bg-white`、`border-white`、`#FFFFFF`、`rgba(...)`、旧 CSS var 和旧 tone 字符串。
- 已通过 `presenton-template-engine` 的 `npm run check` 和 `npm run build`。

## Canvas 模板关系

`red-finance-canvas` 和 `red-finance-v3` 的关系：

- `red-finance-canvas` 是开放性 canvas 蓝图模板。
- 它的组件基本来自 `red-finance-v3` / 同一套红色金融组件体系。
- 主要差异在蓝图形态：`red-finance-v3` 是较完整的页面蓝图；`red-finance-canvas` 提供 cover/content/section 级 canvas，让 AI Agent 自行组合组件。

`red-blue-comparison-canvas` 和 `red-blue-comparison-v1` 的关系：

- `red-blue-comparison-canvas` 是开放性 canvas 蓝图模板。
- 它的 components 基本来自 `red-blue-comparison-v1` / 同一套双方对比组件体系。
- 主要差异在蓝图形态：`red-blue-comparison-v1` 是较完整的页面蓝图；`red-blue-comparison-canvas` 提供 `CoverCanvas`、`ContentCanvas`、`ComparisonCanvas`、`ChartEvidenceCanvas`、`ClosingCanvas`，让 AI Agent 在画布槽位上组合组件生成页面。
- 迁移 `red-blue-comparison-canvas` 时，应优先对齐 `red-blue-comparison-v1` 的 token 契约和组件实现，而不是重新设计一套红/蓝命名或照搬 red-finance 的 accent 契约。

## 注意事项

- 先读 `red-finance-v3` 的最终实现，再迁移 canvas；不要凭记忆手改。
- 迁移 `red-blue-comparison-canvas` 时，先读 `red-blue-comparison-v1` 的最终实现，再对照 canvas 独有 blueprints；不要只复制 red-finance-canvas 的 token 文件。
- 不要迁移 `reference-slides/` 这类参考材料，除非后续明确要求。
- data 默认不要再写颜色；只有明确业务覆盖才允许 data color。
- 允许 `tokens.ts` 做机械派生，例如 alpha helper；语义颜色应进入 token json。
- 页面级一次性改色可以改具体 TSX，但模板级主题能力必须走 token。
- 暂时不要接 LLM 生成 `token.json`，那是下一阶段工作；当前 `token.json` 只作为本地可变测试文件。
- 迁移下一个模板时，不要机械复制 `red-finance-v3` 的 token schema。应先分析目标模板的视觉语义、组件结构、图表/对比关系和主题切换需求，再设计适配该模板的 `token.default.json` 与 `token.schema.json`；命名可以复用已稳定的通用字段，但模板特有语义应进入自己的 token 契约。
