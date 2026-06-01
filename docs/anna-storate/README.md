# Anna 大文件存储说明

> 目录名 `anna-storate` 按本次任务要求保留。本文档讨论的是 Anna storage / APS / upload 能力。

这些文档用于让后续 AI Agent 在不重新打开 staging 文档站的情况下，理解 Anna 的“大文件存储”相关能力，并知道在 `ppt-sdk` 中应该怎么选型和实现。

## 文档结构

- [01-concepts-and-decision.md](01-concepts-and-decision.md)：先读。说明 Anna 里几种“存文件/存大内容”的能力边界，以及如何决策。
- [02-executa-aps-reverse-rpc.md](02-executa-aps-reverse-rpc.md)：Executa 插件侧 APS reverse RPC。重点是 `storage/*`、`files/*`、scope、token、配额和错误处理。
- [03-anna-app-host-api-storage-files.md](03-anna-app-host-api-storage-files.md)：Anna App iframe / bundle 侧的 `anna.storage.*` 与 `anna.files.*`。
- [04-host-upload-and-file-transport.md](04-host-upload-and-file-transport.md)：Host Upload 与 protocol file transport。重点说明它们和 APS 的区别。
- [05-ppt-sdk-implementation-guide.md](05-ppt-sdk-implementation-guide.md)：面向本仓库 PPT 工作流的落地规则和建议数据模型。
- [sources.md](sources.md)：信息来源链接和更新时间。

## 一句话结论

Anna 的“大文件存储”不要走 stdout、不要塞 KV、不要把字节内联进 tool result。持久文件应走 APS files/object storage：先拿 presigned PUT URL，把 bytes 直接写到 R2，再 finalize/complete，后续只返回 artifact id、APS path、etag、短期 download URL 等轻量引用。

## 能力速查

| 场景 | 推荐能力 | 原因 |
| --- | --- | --- |
| 保存 cursor、任务进度、索引、metadata | APS KV (`storage/*`) | JSON 小对象，支持 etag、TTL、list |
| 保存 PPTX、PDF、PNG、CSV、deck 截图等持久文件 | APS files (`files/*`) | bytes 直接进 R2，APS 记录 metadata 与 quota |
| 一次 invoke 生成临时可分享 artifact | Host Upload (`host/uploadFile` 或 app `upload.*`) | 快速得到短期 URL，偏 transient |
| JSON-RPC 响应大于约 512 KiB | Protocol file transport | 只解决 stdout 响应过大，不是持久存储 |
| LLM / 前端只需知道产物在哪里 | 返回引用 | 避免大响应和重复传输 |

## 后续 Agent 的阅读建议

1. 先读 [01-concepts-and-decision.md](01-concepts-and-decision.md)。
2. 如果要改 Executa 插件，读 [02-executa-aps-reverse-rpc.md](02-executa-aps-reverse-rpc.md)。
3. 如果要改 Anna App 前端或 `PptBackend` 适配层，读 [03-anna-app-host-api-storage-files.md](03-anna-app-host-api-storage-files.md)。
4. 如果看到 `host/uploadFile`、`upload.inline`、`__file_transport`，读 [04-host-upload-and-file-transport.md](04-host-upload-and-file-transport.md) 后再动手。
5. 具体到 PPT 产物链路，按 [05-ppt-sdk-implementation-guide.md](05-ppt-sdk-implementation-guide.md) 的规则实现。
