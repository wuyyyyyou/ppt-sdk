# PPT App Theme Tokenization Process

## 目标

模板主题已经从“固定主题集合 + `manifest.theme.colors`”迁移到“模板本地 theme token”。下一阶段要改 `ppt-app` 生成流程：不再让 LLM 选择固定 theme id，而是让 LLM 基于目标模板的 token 契约生成 workspace/local 的 `theme/token.json`。

## 已完成

六个内置蓝图模板已经完成 theme token 迁移：

- `red-finance-v3`
- `red-finance-canvas`
- `red-blue-comparison-v1`
- `red-blue-comparison-canvas`
- `chart-analytics-v1`
- `chart-analytics-canvas`

这些模板都应满足：

- 源模板提交 `theme/token.schema.json`、`theme/token.default.json`、`theme/README.md`，可提交 `token.*.json` 命名预设。
- 源模板不提交 `theme/token.json`；该文件是 workspace/local 的可变主题文件，并由 `.gitignore` 排除。
- `manifest.theme` 已移除，真实颜色来源是 theme token。
- `theme/tokens.ts` 统一消费 `--theme-color-*` / `--theme-shadow-*` CSS vars。
- 组件、slides、blueprints 默认不依赖旧固定主题字段或散落的主题色硬编码。
- demo/default data 默认不再写 `color`、`fillColor`、`textColor`、`accentColor`、`tintColor`、`badgeColor`、`badgeBackground` 这类颜色字段；兼容外部输入时只能作为 optional 覆盖。

相关架构记录见 `docs/adr/0013-template-theme-token-source.md`。

## 当前主题来源约定

- 渲染时优先读取 workspace/local 的 `theme/token.json`。
- 如果 workspace/local 没有 `theme/token.json`，fallback 到源模板提交的 `theme/token.default.json`。
- render layer 已支持读取 token 文件并注入 `--theme-*` 和 `*-rgb` CSS vars。
- fork/build 链路已支持复制 `theme/`，workspace fork 时会从 token default 初始化工作区主题。
- 命名预设如 `token.dark-orange.json`、`token.executive-amber.json` 只是可选参考或测试输入，不替代 workspace/local 的 `theme/token.json` 主源。

## 下一阶段：ppt-app 生成 token.json

目标是把当前“LLM 决定 theme id”的流程改成“LLM 决定 token.json”：

1. 生成任务选定模板后，读取该模板的 `theme/token.schema.json`、`theme/token.default.json`、`theme/README.md`。
2. 将模板 token 契约、用户风格要求、材料语气和必要的命名预设信息传给 LLM。
3. LLM 输出完整 `theme/token.json`，字段必须覆盖 schema required keys，不允许只输出 patch。
4. 写入 workspace/local 的 `theme/token.json`，不写回源模板。
5. 写入前或写入后用 `token.schema.json` 校验；校验失败应重试或 fallback 到 `token.default.json`。
6. 后续 slide 生成、HTML 渲染、PPTX 转换都只消费注入后的 CSS vars，不再读取固定 theme id。

## 实现注意事项

- 不要重新引入 `manifest.theme` 或固定 6 组 theme id 作为模板主题主源。
- 不要让 LLM 修改 `theme/tokens.ts`；它只生成 JSON token。
- 不要让 LLM 省略 token 字段；缺字段会导致部分组件 fallback 失效。
- 不要把 data 当主题载体；data 只表达内容，颜色只允许作为显式业务覆盖。
- 不需要新增硬编码颜色扫描校验；当前阶段靠 schema、渲染回归和 review 控制。
- `reference-slides/` 仍保持参考材料角色，不作为主题生成或迁移目标。
