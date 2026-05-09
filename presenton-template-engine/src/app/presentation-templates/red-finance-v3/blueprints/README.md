# 红色金融 V3 蓝图基础页

`red-finance-v3` 现在采用 TSX-first 工作流。Agent 在理解完整演示文稿大纲之后，先选择最接近内容结构的 `blueprints/*.tsx`，再复制或派生到 `slides/*.tsx`，最后直接修改页面实现。

这里的蓝图是可复制的 TSX 基础页，不是新的运行时引擎，也不是 JSON DSL。

## 阅读顺序

1. 先读 `../catalog.json`，快速了解可用蓝图基础页。
2. 再读选中的 `blueprints/*.tsx`，确认结构、默认数据、组件组合和可编辑边界。
3. 如果需要组件细节，继续读 `../components/README.md` 和相关组件源码。
4. 如果需要视觉密度参考，只读 `../reference-slides/`。
5. 最终页面必须落在 `../slides/*.tsx`，并由 `manifest.json` 引用。

## 核心约定

- `blueprints/*.tsx`：可复制的基础页，提供起始架构。
- `slides/*.tsx`：具体 deck 的最终页面，Agent 可以直接修改。
- `data/*.json`：只承载内容数据，不承载页面结构决策。
- `reference-slides/*.tsx`：只读参考，不进入生成链路。
- `archives/blueprint-contracts/`：历史 JSON 契约归档，不作为当前工作流入口。

## 蓝图 TSX 应包含

- `Schema`：页面数据校验结构。
- `layoutId`：稳定的蓝图 id。
- `layoutName`、`layoutDescription`：页面职责说明。
- `layoutTags`、`layoutRole`、`contentElements`：目录和发现用 metadata。
- `useCases`、`suitableFor`、`avoidFor`：给 Agent 的选型提示。
- `density`、`visualWeight`、`editableTextPriority`：默认密度和导出优先级。
- 默认导出的 React 组件：实际可复制和修改的页面实现。

## 使用方式

1. 从 `catalog.json` 找到最接近的蓝图基础页。
2. 复制对应 `blueprints/*.tsx` 到 `slides/*.tsx`。
3. 在新的 slide 文件里直接调整布局、组件组合、字段映射和默认文案。
4. 更新 `manifest.json`，让 `source.path` 指向新的 `slides/*.tsx`。
5. 只在内容变化时修改 `data/*.json`。

如果页面出现越界、重叠、图表空白或组件不适合，不要试图通过 JSON 绕过去；应直接修改 `slides/*.tsx`。
