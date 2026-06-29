# Issue tracker: Local Markdown

本仓库的 issues 和 PRDs 使用 `.scratch/` 下的 markdown 文件管理。

## Conventions

- 每个 feature 一个目录：`.scratch/<feature-slug>/`
- PRD 文件为 `.scratch/<feature-slug>/PRD.md`
- 实现 issue 文件为 `.scratch/<feature-slug>/issues/<NN>-<slug>.md`，从 `01` 开始编号
- triage 状态记录在每个 issue 文件顶部附近的 `Status:` 行
- 评论和沟通历史追加到文件底部的 `## Comments` 标题下

## When a skill says "publish to the issue tracker"

在 `.scratch/<feature-slug>/` 下创建新文件；如果目录不存在，先创建目录。

## When a skill says "fetch the relevant ticket"

读取用户引用的路径。用户通常会直接提供文件路径或 issue 编号。
