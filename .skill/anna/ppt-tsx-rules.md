# PPT TSX Rules

这个 skill 只负责本地 slide TSX 的编写规则。

它负责回答的问题是：

- 什么时候才应该从 manifest 层升级到 TSX 层
- 本地 TSX 文件必须导出什么
- `Schema`、组件签名、metadata 应该怎么写
- 本地 slide 的结构、依赖、shared 复用应该怎么组织
- 如果不得不自定义本地 slide，应该优先使用哪些页面模式

它不负责：

- 模板选择
- `manifest.json` 的装配规则
- 工具参数真值表
- HTML / model / PPTX 产物流程
- HTML / CSS / SVG 的导出兼容性黑名单细则

如需这些内容，分别加载：

- `ppt-workflow`
- `ppt-template-selection`
- `ppt-manifest-rules`
- `ppt-tool-reference`
- `ppt-render-export`
- `ppt-tsx-export-safety`

## 一、强制协同规则

只要任务进入“修改或新增 TSX 文件”这一步，你必须同时阅读：

1. `ppt-tsx-rules`
2. `ppt-tsx-export-safety`

并且必须按 `ppt-tsx-export-safety` 的要求修改。

结论：

1. `ppt-tsx-rules` 负责 authoring 规则
2. `ppt-tsx-export-safety` 负责导出兼容性规则
3. 只读其中一个是不够的

## 二、使用时机

只有在以下情况，才应加载并进入 TSX 层：

1. 现有 layout 无法承载目标内容结构
2. 需要新增本地 slide 入口文件
3. 需要修改已有本地 TSX 的布局骨架
4. 需要修复某页结构，且 manifest 层无法解决

如果需求只是以下类型，通常不应先改 TSX：

1. 改标题、副标题、正文
2. 改 bullet、KPI、表格数据、图表数据
3. 改图片 URL 或图片描述
4. 改页序
5. 改 `speaker_note`
6. 改 deck 级或页级 theme
7. 在已有 builtin / local layout 之间切换来源

结论：

1. 默认优先改 manifest
2. 只有“怎么排”必须改时，才升级到 TSX

## 三、TSX 的目标

TSX 的目标是生成稳定 slide，不是生成交互式网页。

它必须服务于这条链路：

```text
local TSX
  -> buildDeckHtmlFromManifest
  -> deck HTML
  -> HTML -> PPT 导出链路
```

因此：

1. TSX 应被当成结构化单页画布
2. TSX 的首要目标是可维护、可装配、可稳定导出
3. 如果页面视觉较复杂，必须继续遵守 `ppt-tsx-export-safety`

## 四、文件职责与目录关系

### 1. 一个文件只负责一页

一个本地 TSX 文件只负责一页 slide。

它的职责是：

1. 接收 `data`
2. 输出稳定的单页画布内容

禁止：

1. 在一个文件里生成整套 deck
2. 把 TSX 写成多页连续文档
3. 生成超长滚动页面

### 2. 与工作目录的关系

本地 slide 通常位于工作副本目录内，例如：

```text
my-deck/
  group.json
  manifest.json
  slides/
    CoverSlide.tsx
    SummarySlide.tsx
  shared/
    theme.ts
    icons.tsx
```

原则：

1. `manifest.json` 只声明 slide 入口文件
2. `shared/*` 由 slide 文件自己通过相对路径复用
3. TSX 文件必须位于当前工作目录内

### 3. 扩展名建议

允许的入口扩展名通常包括：

1. `.tsx`
2. `.ts`
3. `.jsx`
4. `.js`
5. `.mts`
6. `.cts`

推荐统一使用：

1. `.tsx`

## 五、必须导出的内容

每个本地 TSX 文件必须导出：

1. `Schema`
2. 默认导出 React 组件
3. `layoutId`
4. `layoutName`
5. `layoutDescription`

这是强约束，不要省略。

## 六、推荐补充的 layout metadata

如果希望模板发现层和 layout 选择更稳定，建议额外导出：

1. `layoutTags`
2. `layoutRole`
3. `contentElements`
4. `useCases`
5. `suitableFor`
6. `avoidFor`
7. `density`
8. `visualWeight`
9. `editableTextPriority`

这些 metadata 的作用是帮助选择 layout，不是承载业务内容。

不要写反：

1. 不要用 `layoutDescription` 代替 `Schema`
2. 不要把 `contentElements` 写成真实业务文案
3. 不要把 `useCases` 写成某一页的具体标题

## 七、`Schema` 规则

### 1. 必须使用 zod

每个本地 TSX 文件必须：

1. `import * as z from "zod"`
2. `export const Schema = z.object({...})`

禁止省略 `Schema`。

### 2. `Schema` 必须覆盖真实使用字段

组件里凡是会读取的字段，都必须出现在 `Schema` 中。

禁止出现：

1. JSX 里读取 `data.xxx`
2. 但 `Schema` 里没有 `xxx`

### 3. 推荐提供默认值

以下字段应优先提供 `.default(...)`：

1. 标题
2. 副标题
3. 列表
4. 卡片内容
5. 图片对象

### 4. 字段命名应清晰

推荐：

1. `title`
2. `subtitle`
3. `description`
4. `bullets`
5. `metrics`
6. `items`
7. `image`

避免：

1. `x1`
2. `data2`
3. `contentBlock`
4. `foo`

### 5. 图片字段推荐结构

图片字段推荐使用：

```tsx
z.object({
  __image_url__: z.string().default(""),
  __image_prompt__: z.string().default(""),
})
```

如果图片是可选字段，也应提供合理默认值。

## 八、组件签名与解析方式

### 1. 必须先解析数据

每个组件都必须先执行：

```tsx
const parsed = Schema.parse(data ?? {});
```

标准写法：

```tsx
import React from "react";
import * as z from "zod";

export const Schema = z.object({
  title: z.string().default("标题"),
});

export const layoutId = "my-slide";
export const layoutName = "My Slide";
export const layoutDescription = "A simple slide.";

const MySlide = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return <div>{parsed.title}</div>;
};

export default MySlide;
```

禁止写成：

```tsx
const MySlide = ({ data }: { data: any }) => {
  return <div>{data.title}</div>;
};
```

### 2. 渲染时优先使用 `parsed`

渲染时应优先使用：

1. `parsed.title`
2. `parsed.items`
3. `parsed.metrics`

而不是继续直接读取原始 `data`。

### 3. 建议显式导入 React

为了兼容当前本地 TSX 动态加载链路，建议显式写：

```tsx
import React from "react";
```

即使文件里没有直接引用 `React` 变量，也建议保留。

## 九、画布与布局基础约束

### 1. 必须是单页画布

推荐直接使用：

1. 宽度：`1280px`
2. 高度：`720px`

例如：

```tsx
<div className="h-[720px] w-[1280px]">...</div>
```

禁止：

1. 超长滚动页
2. 多页连续页面
3. 高度不受控的文档页面

### 2. 布局要稳定、可预期

推荐优先使用：

1. 明确的页头 / 内容 / 页脚分区
2. 简单两栏布局
3. 简单三栏布局
4. 卡片网格
5. 固定宽高图片区
6. 固定宽高指标区

避免：

1. 深层嵌套 flex 互相挤压
2. 依赖内容长度动态撑开的复杂页面
3. 位置极不稳定的绝对定位
4. 通过复杂 transform 形成主体布局

### 3. 不要把 TSX 当普通 React 页面

严禁：

1. 可滚动长页面
2. 依赖 hover 才完整显示的信息
3. 依赖点击切换的内容块
4. 依赖动画过程才能理解的表达

## 十、数据驱动原则

业务内容必须尽量来自 `data`，而不是散落在 JSX 里。

推荐放进 `data`：

1. 标题
2. 副标题
3. bullet 列表
4. 指标数据
5. 表格数据
6. 图片 URL
7. 卡片内容

允许硬编码：

1. 视觉骨架
2. 占位文案
3. 默认配色
4. 默认布局结构

应尽量避免硬编码：

1. 最终业务文案
2. 长段说明文字
3. 真实表格内容
4. 真实图表数据

## 十一、依赖与 shared 模块规则

### 1. TSX 依赖应尽量轻量

当前建议：

1. 可以使用 `react`
2. 不要引入额外第三方 npm 包
3. 不要依赖运行时网络请求

### 2. 可以复用 `shared/*`

允许：

```tsx
import { pageTheme } from "../shared/theme";
import { LogoIcon } from "../shared/icons";
import { BulletSchema } from "../shared/schema";
```

### 3. `shared/*` 应保持纯模块

推荐只承载：

1. 常量
2. schema
3. 小组件
4. SVG 组件
5. 纯函数

应避免：

1. 一加载就依赖 `window`
2. 一加载就依赖 `document`
3. 依赖浏览器页面状态的逻辑
4. 运行时网络请求
5. 复杂副作用

## 十二、推荐页面模式

以下模式强烈建议优先复用，而不是自由发明复杂页面结构：

### 1. 封面页

推荐结构：

1. 顶部小标签
2. 中央大标题
3. 副标题
4. 底部元信息

### 2. 目录页

推荐结构：

1. 页标题
2. 多个顺序项
3. 每项由编号块和文本块组成

### 3. 双栏图文页

推荐结构：

1. 顶部标题
2. 左侧文本区
3. 右侧图片区

### 4. 指标卡片页

推荐结构：

1. 页标题
2. 多个指标卡片
3. 每个卡片由大数字、标签、补充说明组成

### 5. 时间线页

推荐结构：

1. 页标题
2. 横向或纵向时间节点
3. 每个节点使用独立卡片

选择原则：

1. 先按页面目标选模式
2. 再按内容密度微调
3. 不要为追求视觉新鲜感自由发明难以维护的复杂结构

## 十三、禁止生成的内容

1. 需要点击后才完整显示的内容
2. 依赖浏览器动画才能看懂的结构
3. 运行时请求 API 的逻辑
4. 复杂状态管理
5. 多页连续文档页面
6. 未导出 `Schema` 的 TSX 文件
7. 未执行 `Schema.parse(data ?? {})` 的组件
8. 未导出 `layoutId` / `layoutName` / `layoutDescription` 的 TSX 文件

## 十四、写完 TSX 后的基础检查清单

在认为一个 TSX 页面可用于后续构建前，至少检查：

1. 是否一页只对应一个文件
2. 是否导出了 `Schema`
3. 是否导出了默认组件
4. 是否导出了 `layoutId` / `layoutName` / `layoutDescription`
5. 组件内部是否先执行 `Schema.parse(data ?? {})`
6. JSX 中读取的字段是否全部存在于 `Schema`
7. 画布是否限制在 `1280 x 720`
8. 是否没有引入不必要第三方包或运行时网络请求
9. 是否正确使用了 `shared/*`
10. 是否已经同时阅读并遵守 `ppt-tsx-export-safety`

## 十五、最终记忆

如果必须改 TSX，始终按这条原则工作：

```text
一页一个文件
  -> Schema 驱动
  -> 结构清晰
  -> 数据驱动
  -> 同时遵守 ppt-tsx-export-safety
```

TSX 的目标不是“网页做得更炫”，而是“让这页 source 更清晰、更稳定，并且能进入后续导出链路”。
