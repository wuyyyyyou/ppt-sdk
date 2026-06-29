# Domain Docs

工程技能在探索本仓库代码前，按本文件规则读取领域文档。

## Before exploring, read these

- 根目录的 `CONTEXT.md`
- 如果根目录存在 `CONTEXT-MAP.md`，则按其中指引读取和当前任务相关的 context 文档
- `docs/adr/` 中和当前工作区域相关的 ADR

如果这些文件不存在，静默继续。不要因为缺失这些文件而阻塞任务，也不要预先建议创建它们。生产者技能 `/grill-with-docs` 会在术语或决策真正被梳理清楚时按需创建。

## File structure

本仓库使用 single-context 布局：

```text
/
|-- CONTEXT.md
|-- docs/adr/
|   |-- 0001-example-decision.md
|   `-- 0002-example-decision.md
`-- src/
```

## Use the glossary's vocabulary

当输出中命名领域概念时，例如 issue 标题、重构建议、诊断假设或测试名称，使用 `CONTEXT.md` 中定义的术语。不要随意换成 glossary 明确避免的同义词。

如果需要的概念还没有出现在 glossary 中，这是一个信号：要么当前表达不是项目已有语言，需要重新考虑；要么确实存在领域语言缺口，可以记录给 `/grill-with-docs` 后续处理。

## Flag ADR conflicts

如果输出和已有 ADR 冲突，明确指出冲突，而不是静默覆盖。
