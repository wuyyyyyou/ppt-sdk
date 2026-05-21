# Issue tracker：本地 Markdown

这个仓库的 issue 和 PRD 都以 markdown 文件的形式放在 `.scratch/` 里。

## 约定

- 每个功能一个目录：`.scratch/<feature-slug>/`
- PRD 文件是 `.scratch/<feature-slug>/PRD.md`
- 实现类 issue 放在 `.scratch/<feature-slug>/issues/<NN>-<slug>.md`，编号从 `01` 开始
- triage 状态写在 issue 文件顶部附近的一行 `Status:` 里（角色字符串见 `triage-labels.md`）
- 评论和对话历史追加到文件底部的 `## Comments` 标题下

## 当技能说“发布到 issue tracker”时

就在 `.scratch/<feature-slug>/` 下创建新文件，必要时先创建目录。

## 当技能说“获取相关 ticket”时

直接读取引用的路径。用户通常会直接给路径，或者给 issue 编号。
