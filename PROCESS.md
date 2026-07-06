# PPT App Theme Tokenization Process

## 当前进度

`red-finance-v3` 主题 token 试点已完成首轮实现，并已通过 `presenton-template-engine` 的 `npm run check` 和 `npm run build`。

## 已确认方向

长期方向是将主题逻辑从“LLM 在固定预设主题中选择”改为“LLM 根据用户输入和模板主题契约生成主题 token”。本阶段先不接 LLM 主题生成，只打通 `red-finance-v3` 的 token 主题基础设施。

核心原则：

- `red-finance-v3` 作为 tokenized template 试点。
- 主题主源为 workspace 内的 `theme/token.json`，不存在时 fallback 到 `theme/token.default.json`。
- 源模板只提交：
  - `token.schema.json`：机器校验字段、类型、必填项和颜色格式。
  - `token.default.json`：模板默认主题。
  - `README.md`：说明每个 token 的语义和使用场景。
- 源模板不提交 `token.json`；workspace fork 时由 `token.default.json` 初始化。
- 直接移除 `red-finance-v3/manifest.theme`，该模板不再从 `manifest.theme.colors` 取色。
- token schema 先做模板私有 schema，不抽全局通用 schema。
- `tokens.ts` 使用新的 `--theme-color-*` / `--theme-shadow-*` CSS vars，不保留颜色字面量 fallback。
- render layer 从 token hex 自动注入对应 `*-rgb` CSS vars；`tokens.ts` 可提供受控 `alpha()` 派生能力。
- 组件不散落颜色公式；语义派生色进 token，机械透明度/阴影层级可集中受控派生。
- data 默认不写 `color`，图表颜色由 `chart1..chart6` token 控制；data color 只作为极少数显式业务覆盖。
- 模板自带 fallback/placeholder 视觉也要 token-aware，不能继续用硬编码主题色的 data URI SVG。
- tokenized template 现阶段忽略旧 preset theme，不再把旧 6 组主题写回 `manifest.theme`，也不映射到 `token.json`。
- 本阶段不做硬编码颜色扫描校验；先靠人工迁移和 review。
- 实现前补一篇 ADR，记录 token 主题源替代 `manifest.theme.colors` 的架构决策。

## 本轮已实现

1. 新增 ADR，记录 token 主题源替代 `manifest.theme.colors` 的方向。
2. 为 `red-finance-v3` 增加 `theme/token.schema.json`、`theme/token.default.json`、`theme/README.md`。
3. 移除 `red-finance-v3/manifest.theme`，真实颜色来源改为 theme token。
4. 调整 render 注入链路，读取 `theme/token.json`，fallback 到 `theme/token.default.json`，并注入 `--theme-*` 与 `*-rgb` CSS vars。
5. 调整 fork/build 链路，复制 theme 文件，并在 workspace fork 时用 `token.default.json` 初始化 `theme/token.json`。
6. 迁移 `red-finance-v3` 真实生成路径的 components、blueprints、slides、demo data，使颜色/阴影尽量统一从 `tokens.ts` 消费。
7. 图表 demo data 默认不再写颜色，组件按 `chart1..chart6` token 自动分配色板。
8. 图片 placeholder 改为 token-aware，移除 demo data 中携带主题色的 data URI SVG。
9. `reference-slides/` 仍保持只读参考，不参与本阶段迁移；为避免旧 token 名阻断编译，已从 engine TS 编译范围排除。

## 后续

若继续推进，需要接入 LLM 生成 `token.json` 的流程，并按模板逐个细调 token 覆盖度。
