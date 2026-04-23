# PPT Manifest Rules

这个 skill 只负责 `manifest.json` 的 deck 装配规则。

它负责回答的问题是：

- `manifest.json` 在这条链路里到底负责什么
- 哪些改动应优先通过 `manifest.json` 完成
- `builtin` / `local` source 应该如何写
- deck 级 theme、页级 theme、页序、数据、备注应如何组织
- 哪些写法会导致后续 HTML 渲染或导出链路不稳定

它不负责：

- 模板发现与模板选择
- 工具参数真值表
- TSX 组件编写细节
- HTML 到 model / PPTX 的导出细节

如需这些内容，分别加载：

- `ppt-workflow`
- `ppt-template-selection`
- `ppt-tool-reference`
- `ppt-tsx-rules`
- `ppt-tsx-export-safety`
- `ppt-render-export`

## 一、使用时机

在以下场景应加载本 skill：

1. 需要创建新的 `manifest.json`
2. 需要修改 deck 页序
3. 需要修改页面数据、文案、图片、备注
4. 需要切换某页的 `builtin` / `local` 来源
5. 需要调整 deck 级 theme 或页级 theme
6. 需要判断当前任务能否只在 manifest 层完成

## 二、manifest 的职责边界

`manifest.json` 负责整套 deck 的装配。

它负责：

1. 描述整套 deck 的标题
2. 描述 deck 级主题
3. 描述每页的顺序
4. 描述每页来自哪里
5. 描述每页的数据
6. 描述每页的标题、备注、页级主题覆盖

它不负责：

1. 让目录被识别为本地模板组
2. 定义本地模板组元信息
3. 定义 TSX 组件实现
4. 直接输出 HTML 或 PPTX

结论：

1. `manifest.json` 是 deck 装配文件
2. `group.json` 是本地模板组识别文件
3. 二者职责不同，不能互相替代

## 三、与 `group.json` 的关系

必须区分这两个文件：

### `manifest.json`

负责：

1. 页面顺序
2. 页面来源
3. 页面数据
4. theme
5. 标题与备注

### `group.json`

负责：

1. 本地模板组身份
2. 模板组显示名
3. 模板组描述
4. 服务模板发现层的组级 metadata

工作原则：

1. deck 内容修改默认优先改 `manifest.json`
2. 只有在需要修正本地模板组身份或 metadata 时，才改 `group.json`
3. 不要把 deck 内容塞进 `group.json`

## 四、manifest 顶层结构

推荐结构：

```json
{
  "title": "Deck Title",
  "theme": {
    "company_name": "Presenton",
    "colors": {
      "background": "#ffffff",
      "background_text": "#111827",
      "primary": "#0f766e",
      "primary_text": "#ffffff",
      "card": "#ecfeff",
      "stroke": "#99f6e4"
    }
  },
  "slides": []
}
```

顶层字段：

### 1. `title`

- 可选
- 表示整套 deck 的标题

### 2. `theme`

- 可选
- 表示 deck 级默认主题
- 会作为每页的默认 theme

### 3. `slides`

- 必填
- 必须是非空数组
- 数组顺序就是最终页序

## 五、slide 对象的职责

每个 slide 对象推荐包含：

1. `id`
2. `source`
3. `data`
4. `title`
5. `speaker_note`
6. `theme`

### 1. `id`

- 必填
- 必须是字符串
- 必须在整个 manifest 内唯一

### 2. `source`

- 必填
- 描述这一页的来源
- `source.type` 只能是：
  - `builtin`
  - `local`

### 3. `data`

- 可选
- 若存在，必须是对象
- 作为该页的输入数据传给 builtin 模板或 local TSX

### 4. `title`

- 可选
- 当前页标题

### 5. `speaker_note`

- 可选
- 当前页备注内容

### 6. `theme`

- 可选
- 当前页覆盖 deck 级 theme

## 六、`builtin` source 写法

标准写法：

```json
{
  "id": "cover",
  "source": {
    "type": "builtin",
    "template_group": "general",
    "layout_id": "general:general-intro-slide"
  },
  "data": {
    "title": "Quarterly Review",
    "subtitle": "Generated from builtin template"
  }
}
```

规则：

1. `type` 必须为 `"builtin"`
2. `template_group` 必须存在
3. `layout_id` 必须存在
4. `layout_id` 应优先写完整形式：`group:layout`

使用场景：

1. 直接复用内置模板页
2. 当前 layout 已能承载目标内容
3. 不需要改 TSX 实现，只需注入不同数据

## 七、`local` source 写法

标准写法：

```json
{
  "id": "summary",
  "source": {
    "type": "local",
    "path": "./slides/SummarySlide.tsx"
  },
  "data": {
    "title": "Local Slide",
    "bullets": ["A", "B", "C"]
  }
}
```

规则：

1. `type` 必须为 `"local"`
2. `path` 必须是相对于 `cwd` 的本地路径
3. 路径必须位于工作目录内
4. `path` 应指向 slide 入口文件
5. 不要把 `shared/*` 文件写成 `local source`

使用场景：

1. 这页来自当前工作副本中的本地 TSX
2. 需要复用 fork 后的本地 slide
3. 需要通过本地入口承载特殊结构

## 八、`shared/*` 的正确处理方式

如果目录结构类似：

```text
my-deck/
  manifest.json
  slides/
    CoverSlide.tsx
  shared/
    theme.ts
    icons.tsx
```

则：

1. `manifest.json` 只声明 slide 入口文件
2. `shared/*` 应由 `slides/*.tsx` 自己通过相对 `import` 复用

正确做法：

```json
{
  "source": {
    "type": "local",
    "path": "./slides/CoverSlide.tsx"
  }
}
```

错误做法：

```json
{
  "source": {
    "type": "local",
    "path": "./shared/theme.ts"
  }
}
```

结论：

1. manifest 只声明 slide 入口
2. 不声明共享模块

## 九、`cwd` 与本地路径规则

如果 manifest 中包含 `local` source，`cwd` 的语义非常关键。

必须遵守：

1. `cwd` 应指向 manifest 所在工作目录
2. `source.path` 应相对于 `cwd` 编写
3. 本地路径不能跳出 `cwd`

错误示例：

```json
{
  "source": {
    "type": "local",
    "path": "../other-project/Slide.tsx"
  }
}
```

正确原则：

1. manifest 负责引用工作目录内部的 slide 入口
2. 如果文件不在当前工作目录内，这条引用通常就是错误的

## 十、deck 级 theme 与页级 theme

### 1. deck 级 theme

适合承载：

1. 整套 deck 的默认品牌色
2. 默认背景色与文字色
3. 默认卡片色与描边色

原则：

1. 如果整套 deck 主题基本一致，应优先写在顶层 `theme`
2. 不要把每页都重复写完全相同的 theme

### 2. 页级 theme

适合承载：

1. 某页的特殊配色
2. 某页需要局部反相或章节色
3. 某页需要覆盖 deck 级 theme 的局部颜色

原则：

1. 只有当某页确实需要覆盖默认主题时，才写页级 `theme`
2. 页级 theme 是覆盖，不是替代 deck 整体组织

## 十一、页序就是 `slides` 数组顺序

manifest 的 `slides` 数组顺序就是最终页序。

因此：

1. 重排页面顺序，应优先调整数组顺序
2. 删除页面，应删除对应 slide 对象
3. 插入页面，应在正确位置插入新的 slide 对象

不要为了改页序而去改 TSX。

## 十二、默认优先在 manifest 层解决的改动

以下需求默认都应优先通过 `manifest.json` 完成：

1. 改标题、副标题、正文、摘要
2. 改 bullet、KPI、表格数据、图表数据
3. 改图片数据
4. 改 `speaker_note`
5. 改页序
6. 删页
7. 改某页使用哪个已有 layout
8. 改 deck 级或页级 theme
9. 在已有 builtin layout 与已有 local slide 之间切换来源

如果这些需求能在 manifest 层完成，就不要升级到 TSX 层。

## 十三、什么时候不能只靠 manifest

出现以下情况时，才考虑升级到 TSX 层，并同时加载 `ppt-tsx-rules` 与 `ppt-tsx-export-safety`：

1. 现有 layout 根本无法承载目标内容结构
2. 需要新增一个本地 slide 入口文件
3. 现有 TSX 缺少必须的数据结构或视觉骨架
4. 需要修改 layout 本身，而不是只换数据

判断原则：

1. 如果只是“讲什么”变了，优先改 manifest
2. 如果是“怎么排”必须改，才进入 TSX

## 十四、manifest 装配的推荐顺序

在编辑 manifest 时，推荐按这个顺序思考：

1. 先确定整套 deck 的页序
2. 再确定每页的 `source`
3. 再确定每页的 `data`
4. 再补充 `title`
5. 再补充 `speaker_note`
6. 最后再决定是否需要页级 `theme`

不要一开始就沉迷于细节字段。

应先把 deck 主体结构搭起来。

## 十五、混合装配原则：builtin + local

manifest 支持同一套 deck 同时混用：

1. `builtin` slide
2. `local` slide

这是一种标准形态，不是异常。

推荐使用方式：

1. 能复用 builtin 的页尽量复用 builtin
2. 只有 builtin 无法承载时，才切换到 `local`
3. 不要为了“统一来源”而强行把所有页都改成 local

## 十六、常见错误

### 1. 把 `group.json` 当成 deck 装配文件

错误原因：

1. 把 deck 内容、页序、页面数据写进 `group.json`

正确做法：

1. deck 装配写在 `manifest.json`
2. 模板组身份与 metadata 写在 `group.json`

### 2. `slides` 为空

错误原因：

1. 忘记真正声明页面

正确做法：

1. `slides` 必须是非空数组

### 3. 重复的 `id`

错误原因：

1. 复制页面对象后忘记改 `id`

正确做法：

1. 每页 `id` 必须唯一

### 4. `data` 不是对象

错误原因：

1. 把字符串、数组直接塞到 `data`

正确做法：

1. `data` 若存在，应始终是对象

### 5. `source` 缺失或类型错误

错误原因：

1. 忘记写 `source`
2. 写了不支持的 `source.type`

正确做法：

1. 每页都必须有 `source`
2. `source.type` 只能是 `builtin` 或 `local`

### 6. 把 `shared/*` 写进 manifest

错误原因：

1. 把共享模块当作 slide 入口

正确做法：

1. manifest 只引用 `slides/*.tsx`
2. slide 自己 import `shared/*`

### 7. local 路径越界

错误原因：

1. `path` 跳出当前工作目录

正确做法：

1. local source 路径必须留在 `cwd` 内

### 8. 明明只改数据，却直接去改 TSX

错误原因：

1. 没把 manifest 作为首选装配层

正确做法：

1. 先判断能否只通过 `source/data/theme/页序` 解决

## 十七、编辑 manifest 时的检查清单

在认为 manifest 已经可用之前，至少检查：

1. `slides` 是否非空
2. 每页 `id` 是否唯一
3. 每页是否都有 `source`
4. `source.type` 是否只使用 `builtin` / `local`
5. `builtin` 页是否同时具备 `template_group` 与 `layout_id`
6. `local` 页路径是否指向 slide 入口
7. 是否错误引用了 `shared/*`
8. `data` 是否为对象
9. deck 级 `theme` 与页级 `theme` 是否合理
10. 页序是否符合当前大纲

## 十八、与渲染阶段的关系

`manifest.json` 的作用是驱动 deck HTML 装配。

它并不负责：

1. 帮你选模板组
2. 自动补齐缺失 layout
3. 自动修正 TSX 导出问题

正确关系应理解为：

```text
模板选择
  -> 生成或修改 manifest.json
  -> buildDeckHtmlFromManifest
  -> HTML 审阅
  -> 后续导出
```

所以：

1. manifest 是渲染前的装配输入
2. 不是渲染结果

## 十九、最终记忆

你应始终把 `manifest.json` 理解为：

```text
一套 deck 的装配清单
  = 页序
  + 每页来源
  + 每页数据
  + 标题/备注
  + 主题覆盖
```

如果任务只是改内容、改顺序、改数据、改来源、改 theme，默认优先改 `manifest.json`。

只有当现有 layout 无法承载目标内容结构时，才升级到 TSX 层。
