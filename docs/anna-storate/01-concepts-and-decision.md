# 01. 概念与决策

## 背景

Anna 提供多种“存内容”的能力。它们名字相近，但语义差异很大：

- APS KV：Anna Persistent Storage 的 JSON key/value 存储。
- APS files / object storage：Anna Persistent Storage 的对象存储，metadata 在 Postgres，bytes 在 Cloudflare R2。
- Host Upload：插件或 Anna App 把一个 artifact 交给 host，host 写入 R2 并返回短期 URL。
- Protocol file transport：Executa stdio 协议的大响应逃生通道。

后续开发中，最重要的是不要把这四者混用。

## 能力边界

### APS KV

用途：

- 保存小型 JSON 状态。
- 保存 cursor、进度、配置、metadata、索引。
- 保存可重算缓存的结果，例如 OCR 文本、embedding 摘要索引。

特点：

- 值是 JSON，不是 blob。
- 单值建议保持在 KB 级，staging 文档给出的单 KV value 默认/建议上限是 64 KB。
- 支持 `etag` / `if_match` 乐观并发。
- 支持 `ttl_seconds`。
- 支持按 prefix list。

不要用来：

- 保存 PPTX、PDF、PNG、长 HTML、长 JSON model、大数组。
- 传递 tool response 的大 payload。

### APS files / object storage

用途：

- 保存持久大文件。
- 保存用户或 App 后续还要访问的 artifact。
- 保存 PPTX、PDF、PNG、CSV、deck screenshots、模板预览图、导出的中间产物。

特点：

- metadata 写入 APS `aps_entries`。
- bytes 通过 presigned URL 直接 PUT 到 R2。
- 下载通过 presigned GET URL。
- 支持 quota、object size cap、etag、soft delete、pending upload cleanup。
- 适合长期存储和跨 invoke 复用。

关键原则：

- 不让 bytes 走 JSON-RPC stdout。
- 不让 bytes 走 Nexus worker。
- tool result 只返回引用。

### Host Upload

用途：

- 一次 invoke 内快速生成一个可分享 artifact。
- 插件或 App 想把临时文件交给 host，并拿到短期下载 URL。
- 例如 image generation 生成 PNG 后立即给用户看。

特点：

- 有 `inline` 和 `negotiate + confirm` 两条路径。
- 返回 URL 通常约 30 分钟有效。
- `r2_key` 是 opaque handle，可用于重签。
- 更偏 transient，不等同于 APS files 的长期用户文件。

如果产物需要长期保留，应将 bytes 或对象登记到 APS files，或至少保存 `r2_key` 并按需重签。

### Protocol file transport

用途：

- 解决 JSON-RPC 响应太大，stdout 单行承载不了的问题。

特点：

- 插件把完整 JSON-RPC response 写到本机临时文件。
- stdout 只返回 `{"__file_transport": "/tmp/..."}` 指针。
- Agent 读取文件、解析、删除。
- 它不是 storage，不提供持久性、URL、quota、跨 invoke 访问。

## 决策树

```text
要保存/返回的数据是什么？

1. 小 JSON 状态？
   -> APS KV

2. 二进制文件或大文本/大 JSON，并且之后还要访问？
   -> APS files/object storage

3. 一次调用内临时给用户下载/预览？
   -> Host Upload
   -> 若要长期保留，再写入 APS files 或持久化 r2_key

4. 只是 tool result JSON 太大？
   -> protocol file transport
   -> 但优先改成返回 APS/Host Upload 引用
```

## 推荐返回值形状

大产物的 tool response 应返回轻量引用，而不是 bytes：

```json
{
  "success": true,
  "data": {
    "artifact_id": "pptx_20260601_001",
    "kind": "pptx",
    "storage": {
      "provider": "aps.files",
      "scope": "app",
      "path": "workspaces/ws_123/artifacts/deck.pptx",
      "etag": "W/\"7-abcd\"",
      "size_bytes": 3481274
    },
    "download_url": "https://...",
    "download_url_expires_at": "2026-06-01T12:30:00Z"
  }
}
```

注意：

- `download_url` 是短期凭证，只能当临时访问 URL。
- 长期状态应保存 `artifact_id`、`path`、`etag`、`size_bytes`、`content_type` 等 metadata。
- 后续需要下载时重新 mint `download_url`。

## Scope 选择

| Scope | 适用 | 慎用点 |
| --- | --- | --- |
| `tool` | 插件私有缓存、临时状态、内部进度 | 其他工具/App 读不到 |
| `app` | 同一 Anna App 多视图共享的工作区状态和 artifact | 不适合用户跨 App 文件 |
| `user` | 用户自己的文件，需要跨工具复用 | 权限更宽，只在用户明显受益时使用 |

实践建议：

- 插件内部缓存默认用 `tool`。
- PPT 工作区数据默认用 `app`。
- 只有“保存到用户 My Files / 用户 drive”这类场景用 `user`。

## 错误处理总原则

- `quota_exceeded` / `QUOTA_EXCEEDED`：同一次 invoke 内不可重试，应该返回明确错误。
- `rate_limited` / `RATE_LIMITED`：同一次 invoke 内不可重试，应该减少请求数或批处理。
- `precondition_failed`：重新读取最新值，合并后带新 `etag` 重试。
- `not_granted` / `STORAGE_NOT_GRANTED`：缺权限、scope 不被 grant、capability 未声明；提示需要授权或修正 manifest。
- `upstream` / `UPSTREAM_ERROR`：可以指数退避后有限重试。
