# Agent Freestyle 组件说明

这个模板只提供 `SlideCanvas`，用于固定 `1280x720` 画布、裁切溢出内容并设置中性字体与颜色。

页面设计应直接写在 `slides/*.tsx` 中。不要为了复用率把单页特有结构抽成卡片、面板或整页框架；只有多个页面确实共享同一视觉语义时，才在本目录新增组件。

`theme.ts` 只是当前 Workspace 的精确实现参数。创建具体演示时，Agent 应先读取 Workspace 根目录的 `art-direction.md`，再按已确认的艺术方向调整 `theme.ts` 和各页构图。
