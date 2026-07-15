# Authoring Kit（创作套件）

这是当前 Workspace（工作区）使用的共享创作基础。Page Authoring Agent（页面创作智能体）只能读取这里的内容，不能修改其中的文件。

- `foundations/` 包含稳定、通用的底层模块，Page Source（页面源码）可以直接导入。
- `references/` 包含分层组织的参考实现。Agent 可以阅读、复制、拆解或改写这些示例，但不应把它们直接导入 Page Source。

真正参与演示文稿渲染的 Page Source 位于 Workspace 的 `slides/` 目录，不属于 Authoring Kit。
