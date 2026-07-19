# 使用 APS Files 提供 Workspace Diagnostic Bundle

Workspace Diagnostic Bundle（工作区诊断包）不是 Export Artifact（导出产物）：每次用户请求时，PPT App 都重新收集当前 Workspace 的完整内容并生成一个临时归档，通过 `scope: "tool"` 的 APS Files 提供短期下载 URL，不使用 Host Upload，不持久化 mirror、URL 或诊断包历史。`tool` scope 将包含日志、上传资料和页面源码的敏感归档限制在当前用户与 `ppt-engine` Executa 的私有命名空间内，不把它暴露为用户级文件。每个 Workspace 只覆盖一个当前 APS 对象，以避免历史归档持续堆积；代价是尚未过期的旧 URL 可能读取到后来覆盖的当前诊断包。

诊断包生成对 Workspace 只读，并允许在 Workspace 活动时执行，因此它反映收集过程中观察到的文件内容，而不是文件系统级原子快照。Anna App iframe 当前不能直接下载文件，前端只展示可复制的短期 URL，并提醒用户将其粘贴到普通浏览器地址栏中下载且不要分享给无关人员。
