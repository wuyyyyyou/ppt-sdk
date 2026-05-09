# 红色金融 V3 蓝图说明

`red-finance-v3` 采用蓝图优先（blueprint-first）的方式。Agent 在理解完整演示文稿大纲之后，应该先选择蓝图，再把内容映射到各个 slot 和允许的组件家族，最后再编写或修改 slide 数据。

蓝图是给 Agent 用的设计期契约，不是新的运行时引擎，也不会被当前渲染器自动解析。

## 阅读顺序

1. 先读 `../catalog.json`，快速了解蓝图索引。
2. 再读选中的 `blueprints/*.json`，确认 slot 和 variant 规则。
3. 只有当内容符合蓝图意图后，再使用 `slide_renderer`。
4. 在 slot 内选择组件时，参考 `../components/README.md`。
5. 只把 `../reference-slides/` 当作视觉密度和版式组合的参考。

## 核心字段

- `id`：稳定的蓝图 id，使用小写 kebab-case。
- `name`：可读名称。
- `description`：结构职责，不是业务主题。
- `implementation_status`：当渲染器已存在且属于当前 V3 基线时填 `implemented`；当蓝图契约已定义但渲染器还未实现时填 `planned`。
- `slide_renderer`：目标 slide 渲染器的相对路径。
- `layout_family`：大结构族，例如 `cover`、`two-column` 或 `matrix`。
- `content_intents`：该蓝图可以表达的内容目标。
- `suitable_for`：适合的中文任务标签或使用场景。
- `avoid_for`：明确不适合的场景。
- `slots`：slot 契约。slot 需要描述语义职责、允许的组件家族、条目数量限制和文本长度限制。
- `variants`：Agent 可以在不改变蓝图的前提下选择的版式变体。
- `density_range`：支持的密度范围。
- `component_families`：该蓝图使用到的组件家族。
- `agent_selection_rules`：给 Agent 用的实际选择规则。
- `export_notes`：PPTX 导出建议。重要文本尽量保持为 DOM 文本；装饰性内容或复杂图表在合适时可以走截图兜底。

## Slot 规则

每个 slot 都要说明它负责什么内容，以及它有多大的灵活度：

- `required` 表示没有这个 slot 就不应该渲染。
- `allowed_component_families` 用于限制大类选择。
- `allowed_components` 用于给出优先的具体组件。
- `content_type` 描述预期的数据形状。
- `min_items` 和 `max_items` 用来防止内容过密。
- `text_limits` 用来保证生成内容落在设计区域内。
- `can_reorder` 表示 Agent 可以调整条目顺序。
- `can_replace` 表示允许用同家族的等价组件替换。

## Slot 到组件家族

先看 slot 类型，再决定组件家族：

| Slot 类型 | 组件家族 | 说明 |
| --- | --- | --- |
| `page-title` | `page-shell`, `heading` | 仅用于页面框架和标题。 |
| `section-heading` | `page-shell`, `heading` | 用于章节陈述和分节导语。 |
| `narrative-text` | `heading`, `card` | 保持文本短小，并且可编辑。 |
| `bullet-list` | `card` | 使用卡片组件，并控制条目数量。 |
| `metric` | `primitive`, `kpi`, `card` | 数值和单位必须保持可编辑。 |
| `kpi-strip` | `primitive`, `kpi` | 紧凑的横向指标汇总。 |
| `chart` | `chart` | 图表主体可以走截图；标题和结论保持可编辑。 |
| `matrix` | `matrix` | 尽量让行和单元格文本保持可编辑。 |
| `comparison` | `matrix`, `card`, `kpi` | 多维对比优先用 matrix，简短说明可用 card。 |
| `timeline` | `timeline` | 只在内容有顺序或阶段时使用。 |
| `callout` | `card` | 放一个简洁结论或提醒。 |
| `decoration` | `decoration` | 这里绝不能放关键事实。 |
| `footer-meta` | `page-shell`, `primitive` | 页脚、页码、品牌和元信息。 |

如果某个 slot 需要的家族不在选中的蓝图里，就应该切换蓝图，或者先调整 slot 映射，再去改 TSX。

## 实现状态

任务 02 定义了首批 9 个蓝图，任务 04 已经实现了对应的 renderer 集合，所以这批首发蓝图在当前基线里都标记为 `implemented`。
