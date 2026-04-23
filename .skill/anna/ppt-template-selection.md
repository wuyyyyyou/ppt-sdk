# PPT Template Selection

这个 skill 只负责模板发现、候选比较、模板组确认，以及在确认后把选中的模板组 fork 到工作目录。

它负责回答的问题是：

- 当前这份 deck 应该选哪个模板组
- 为什么是这个模板组，而不是别的模板组
- 这个模板组是否覆盖所需页面角色
- 选定后应如何准备工作副本

它不负责：

- 展开工具参数细节
- 直接编写 `manifest.json`
- 直接编写或修改 TSX
- 直接执行 HTML 审阅与导出流程

如需这些内容，分别加载：

- `ppt-workflow`
- `ppt-tool-reference`
- `ppt-manifest-rules`
- `ppt-tsx-rules`
- `ppt-tsx-export-safety`
- `ppt-render-export`

## 一、使用时机

在以下场景应加载本 skill：

1. 需要从多个模板组里选择最合适的一个
2. 需要判断内置模板组是否足够支撑当前 deck
3. 需要根据模板组详情预估页面覆盖能力
4. 需要在模板确认后 fork 到工作目录

如果用户已经明确给出以下任一条件，可以缩短本 skill 的执行范围：

1. 已指定固定 `template_group`
2. 已给出明确要沿用的现成工作副本
3. 已指定必须使用某个本地模板组

但即使如此，你仍应做一次最小检查，确认：

1. 这个模板组确实存在
2. 它大致覆盖当前 deck 所需页面角色
3. 后续工作应在工作副本内进行，而不是直接修改模板源目录

## 二、模板选择前的最小输入

在选模板前，至少要掌握以下信息：

1. deck 主题
2. 目标受众
3. 使用场景
4. 页数范围
5. 风格与语气
6. 是否偏分析型、提案型、汇报型、路演型
7. 是否需要封面、目录、章节页、结论页
8. 是否需要 KPI、图表、时间线、图文页、对比页、列表页
9. 是否有明显的品牌约束或行业约束

如果这些信息还不足，不要急着选模板。

应先把 deck 抽象成一组“页面角色需求”与“表达需求”。

## 三、硬规则

1. 模板选择必须发生在正式修改 deck 源文件之前。
2. 默认优先内置模板组。
3. 模板未确认前，不得 fork。
4. 除非确有必要，不要一开始就调用 `getAllDiscoveredTemplateGroups`。
5. 模板选择不能只看视觉风格，必须同时看页面角色覆盖与内容承载能力。
6. 模板确认后，后续改动必须发生在 fork 出来的工作副本中。
7. 如果用户反馈会影响结构、风格、页面类型或模板方向，必须回退到模板选择阶段重新判断。

## 四、内置模板与本地模板的取舍

### 默认策略

默认优先内置模板组。

原因：

1. 可见性更稳定
2. 布局质量通常更可预期
3. 后续 fork 与导出链路更标准

### 何时考虑本地模板组

只有在以下情况，才应把本地模板组纳入重点候选：

1. 用户明确要求使用某个本地模板组
2. 用户提供了需要复用的现有工作目录
3. 内置模板组明显无法承载所需结构或风格
4. deck 明确依赖已有的本地品牌模板工程

### 关于 `local_roots`

如果要让 discovery 同时看到本地模板组，应在 discovery 阶段提供正确的 `local_roots`。

但要注意：

1. `local_roots` 只是扩大模板可见范围，不代表可以直接修改其中内容
2. 如果后续需要修改模板，仍应进入工作副本流程

## 五、模板选择不应只看什么

以下判断方式都是不够的：

1. 只看封面是否好看
2. 只看某一页 sample data 是否顺眼
3. 只看配色是否符合直觉
4. 只因为某个模板“高级感强”就直接选
5. 只因为某个模板“内容多”就认为覆盖更强

模板选择必须看整套 deck 的任务匹配度。

## 六、应该优先看的判断维度

### 1. 叙事风格是否匹配

重点看：

1. 是偏战略汇报、行业分析、管理层汇报，还是偏提案、营销、展示型 deck
2. 模板整体语气是否适合受众
3. 模板是否适合当前 deck 的正式程度

### 2. 页面角色是否覆盖

至少要判断目标模板组能否较稳定覆盖这些角色：

1. `cover`
2. `agenda`
3. `section`
4. `content`
5. `data`
6. `comparison`
7. `timeline`
8. `conclusion`
9. `closing` 或 `thank-you`

不要求每组都显式命名完全一致，但需要判断语义等价的 layout 是否存在。

### 3. 内容承载能力是否匹配

要看这个模板组是否适合承载：

1. 标题 + 副标题
2. 短段正文
3. bullet 列表
4. KPI 卡片
5. 图表
6. 时间线
7. 图文组合
8. 对比结构
9. 结论 / 下一步

### 4. 受众与场景是否匹配

重点看：

1. 是给管理层、客户、内部团队还是投资人
2. 是正式汇报、方案提案、研究报告还是路演场景
3. 这个模板是否会让内容表达显得过于花哨、过于轻、或过于沉重

### 5. 可编辑性与稳定性是否匹配

要优先选择：

1. 关键文本容易保留为真实文本的 layout
2. 内容结构相对清晰的 layout
3. 不需要强依赖复杂视觉特效才能成立的 layout

## 七、组级 metadata 如何用于模板筛选

如果 discovery 返回的模板组带有组级 metadata，应优先用它做第一轮筛选。

尤其关注：

- `group_brief`
  - 一句话判断这个模板组适合什么 deck

- `style_tags`
  - 风格标签，例如 `finance`、`editorial`、`clean`

- `industry_tags`
  - 行业标签，例如 `finance`、`banking`、`general`

- `use_cases`
  - 典型用途，例如 `strategy-report`、`proposal`、`business-deck`

- `audience_tags`
  - 适用受众，例如 `management`、`board`、`client`

- `tone_tags`
  - 语气标签，例如 `professional`、`formal`、`analytical`

- `cover_layout_id`
  - 推荐封面 layout

- `agenda_layout_id`
  - 推荐目录 layout

- `closing_layout_id`
  - 推荐结尾 layout

使用方式：

1. 先根据 `group_brief` 和标签语义做粗筛
2. 再看它是否自带推荐封面、目录、结尾入口
3. 如果这些角色入口都不完整，通常不应作为第一候选

## 八、layout metadata 如何用于候选比较

进入候选模板组详情阶段后，应重点读取 layout 级 metadata。

尤其关注：

- `layoutRole`
  - 页面角色，例如 `cover`、`agenda`、`content`、`timeline`、`conclusion`

- `contentElements`
  - 页面结构元素，例如 `headline`、`chart`、`timeline`、`kpi`、`image`

- `useCases`
  - layout 适用任务，例如 `overview`、`roadmap`、`executive-summary`

- `suitableFor`
  - 适合承载什么类型的内容

- `avoidFor`
  - 明确不适合承载什么

- `density`
  - 信息密度，通常是 `low`、`medium`、`high`

- `visualWeight`
  - 视觉重心，例如 `text-heavy`、`balanced`、`visual-heavy`

- `editableTextPriority`
  - 文本可编辑优先级，例如 `high`、`medium`、`low`

使用方式：

1. 先判断是否有足够的 `layoutRole` 覆盖 deck 角色
2. 再看 `contentElements` 是否适合当前页需要承载的信息结构
3. 再看 `density` 与 `visualWeight` 是否符合该页信息量
4. 最后再用 `suitableFor` / `avoidFor` 做语义排雷

## 九、标准模板选择流程

### 阶段 1：把 brief 变成模板需求

先把用户需求转换成可筛选的结构：

1. deck 类型
2. 风格关键词
3. 受众标签
4. 行业标签
5. 页面角色清单
6. 关键内容结构清单

建议至少得出这些结论：

- 这套 deck 更像什么
- 它需要哪些“必有页面角色”
- 它最不能缺什么类型的 layout

### 阶段 2：读取模板组摘要

调用顺序：

1. `listDiscoveredTemplateGroupSummaries`

目标：

1. 拿到候选模板组摘要
2. 根据组级 metadata 做第一轮筛选

输出：

1. 2 到 4 个重点候选模板组
2. 每个候选的简短入选理由

### 阶段 3：读取候选模板组详情

调用顺序：

1. 对重点候选逐个调用 `getDiscoveredTemplateGroup`

只有在以下情况，才调用：

1. `getAllDiscoveredTemplateGroups`

适用情况：

1. 需要全量并排比较多个模板组
2. 候选边界不清，单组读取不足以决策

目标：

1. 判断各组 layout 角色覆盖
2. 判断哪些组更适合当前大纲
3. 判断是否存在明显缺口

### 阶段 4：先做页角色映射，再做最终选择

不要只说“这个模板整体不错”。

应先做一个简短映射：

1. 封面可用哪个 layout
2. 目录可用哪个 layout
3. 核心内容页大致可用哪些 layout
4. 数据页 / 时间线 / 对比页是否有合适承载
5. 结尾页是否有合适入口

如果一个模板组只有封面好看，但中段内容页明显不够，不应选它。

### 阶段 5：向用户确认模板选择

在 fork 之前，应向用户展示：

1. 推荐模板组
2. 选择理由
3. 页面角色覆盖情况
4. 明显缺口或风险
5. 如有必要，备选模板组

模板未确认前，不得 fork。

### 阶段 6：确认后 fork 到工作目录

调用顺序：

1. `forkTemplateGroup`

标准做法：

1. 在新的 `RUN_DIR` 下准备 `GROUP_DIR`
2. 将选中的模板组 fork 到 `GROUP_DIR`
3. 如后续会立即生成 HTML，通常应优先考虑 `install_dependencies=true`

fork 完成后：

1. 后续文件改动都只能在 `GROUP_DIR` 内进行
2. 不再直接修改模板源目录

## 十、页角色映射方法

在最终确认模板前，应至少完成一版简化的页角色映射。

推荐把每页先抽象成角色，而不是直接写具体页面标题。

例如：

1. `cover`
2. `agenda`
3. `section intro`
4. `summary content`
5. `kpi snapshot`
6. `chart analysis`
7. `timeline`
8. `comparison`
9. `conclusion`
10. `closing`

然后判断目标模板组里是否至少有：

1. 一套稳定的开场路径
2. 一组可复用的中段内容布局
3. 一条合理的收尾路径

## 十一、什么时候应该换候选模板组

出现以下情况时，不应继续强行使用当前候选：

1. 缺少封面、目录或结尾等关键入口
2. 中段内容页结构明显不足
3. 大量页面都需要改 TSX 才能勉强承载
4. 模板风格明显和受众/场景冲突
5. 数据型页面、图表页、时间线页完全无对应 layout

如果 deck 的大部分页面都要靠新写 TSX 才成立，说明模板选择大概率不合适。

## 十二、确认时应该向用户输出什么

模板选择阶段的阶段性结果不应只是一句“我选了某某模板”。

至少应输出：

1. 选中的模板组 id
2. 为什么选它
3. 它最适合承载哪些页面角色
4. 它可能不够理想的地方
5. 是否有备选模板组
6. 确认后将会 fork 到哪个工作目录

## 十三、失败处理

### 1. discovery 阶段失败

优先排查：

1. `include_builtin` 是否正确
2. `local_roots` 是否正确
3. `cwd` 是否正确
4. 本地模板目录是否真的可见

### 2. 找不到目标模板组

优先排查：

1. `group_id` 是否写错
2. 候选是否来自不同可见范围
3. 当前 discovery 输入是否和之前一致

### 3. fork 失败

优先排查：

1. 模板组是否已经确认
2. `out_dir` 是否可写
3. 是否错误地尝试 fork 非内置模板组
4. 是否需要 `overwrite`

### 4. 选择困难

如果两个模板组都部分适合，不要只说“都可以”。

应明确指出：

1. 哪个更适合封面与开场
2. 哪个更适合中段信息承载
3. 哪个更适合当前受众和语气
4. 为何最终推荐其中一个

## 十四、禁止事项

1. 不要一开始就调用 `getAllDiscoveredTemplateGroups`
2. 不要在模板未确认前 fork
3. 不要直接修改模板源目录
4. 不要因为单页好看就忽略整套 deck 的覆盖能力
5. 不要在没有足够需求信息时仓促选模板
6. 不要把大量必须新增 TSX 的情况当作“模板适配良好”

## 十五、总记忆

模板选择的正确顺序应始终是：

```text
brief / outline
  -> listDiscoveredTemplateGroupSummaries
  -> getDiscoveredTemplateGroup
  -> 用户确认模板选择
  -> forkTemplateGroup
  -> 进入 manifest / TSX 处理
```

模板选择的核心目标不是“找最漂亮的模板”，而是“找最适合当前 deck 结构、内容承载和后续稳定导出的模板组”。
