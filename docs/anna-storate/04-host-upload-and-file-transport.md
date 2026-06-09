# 04. Host Upload 与 Protocol File Transport

本文说明两个容易和 APS 混淆的能力：Host Upload 与 protocol file transport。

## Host Upload

Host Upload 让插件或 Anna App 把一个文件交给 Anna host，host 存到共享 R2 bucket，并返回 presigned download URL。插件/App 不持有 S3/R2 credentials。

它适合：

- 一次 invoke 产出的临时可分享 artifact。
- 生成图片、摘要文件、短报告后立即给用户下载。
- 产物不需要作为长期 workspace state 管理。

它不适合：

- 长期用户文件。
- 工作区 artifact registry 的唯一存储。
- 需要跨 invoke 稳定 list / metadata / etag 管理的对象。

长期文件用 APS files。

## 插件侧 Host Upload: `host/uploadFile`

Executa 插件通过 reverse RPC 调用：

```text
host/uploadFile
```

前置条件：

- v2 negotiation。
- `initialize` response 声明 `client_capabilities: { upload: {} }`。
- manifest `host_capabilities` 包含 Host Upload 能力。官方 `image-poster` 示例写 `"host.upload"`。
- 用户 grant 中 `upload_grant.enabled = true`。

grant 控制：

- `maxFiles`
- `maxFileBytes`
- `allowedMimeTypes`
- `allowedPurposes`

缺条件时会返回：

- `UPLOAD_NOT_GRANTED (-32201)`
- `UPLOAD_NOT_NEGOTIATED (-32210)`

### 三种 mode

```text
inline      -> base64 bytes，适合 <= 8 MiB
negotiate   -> mint presigned PUT URL
confirm     -> PUT 后确认，并返回下载 URL
```

#### inline

适合小文件：

```json
{
  "jsonrpc": "2.0",
  "id": "u-1",
  "method": "host/uploadFile",
  "params": {
    "mode": "inline",
    "filename": "summary.txt",
    "mime_type": "text/plain",
    "purpose": "user_artifact",
    "content_b64": "<base64>"
  }
}
```

限制：

- decoded bytes 硬上限 8 MiB。
- base64 wire size 约为原始 bytes 的 1.33 倍。
- 手写 frame 时必须检查 encoded length，避免本地 writer 截断。

#### negotiate + confirm

适合较大文件：

```json
{
  "mode": "negotiate",
  "filename": "video.mp4",
  "mime_type": "video/mp4",
  "purpose": "user_artifact",
  "expected_bytes": 52428800
}
```

返回：

```json
{
  "r2_key": "exec-uploads/prod/<uuid>/<tool>/<invoke>/user_artifact/...",
  "put_url": "https://<bucket>.r2.cloudflarestorage.com/...",
  "headers": { "Content-Type": "video/mp4" },
  "expires_in": 300
}
```

插件直接 PUT bytes 到 `put_url`，然后：

```json
{
  "mode": "confirm",
  "r2_key": "<verbatim r2_key from negotiate response>"
}
```

`confirm` 会：

- HEAD R2 object。
- 校验 upload landed。
- 结算 per-invoke quota。
- 返回 canonical URL。

不 confirm 的 object 会被 lifecycle policy 回收。

### Result shape

Host Upload 三种 mode 最终返回类似：

```json
{
  "r2_key": "exec-uploads/<env>/<user>/<tool>/<invoke>/<purpose>/<ts>_<rand>_<name>",
  "url": "https://r2.anna.partners/...?X-Amz-Signature=...",
  "mime_type": "image/png",
  "bytes": 204800,
  "expires_in": 1800,
  "_meta": { "mode": "inline" }
}
```

重要：

- `url` 是 transient，通常约 30 分钟。
- `r2_key` 是 opaque handle，不要 parse、不要拼接。
- 要刷新 URL，可用同一个 `r2_key` 再 confirm。
- 要长期保存，保存 `r2_key` 到 APS KV，或把文件纳入 APS files。

### Host Upload limits

| 限制 | 默认/说明 |
| --- | --- |
| inline decoded payload | 8 MiB |
| single-file cap | token 默认 20 MiB，grant 常见 25 MiB，可被配置放宽 |
| per-invoke total bytes | 80 MiB |
| per-invoke file count | 16 |
| presigned PUT URL TTL | 300 秒 |
| returned GET URL TTL | 约 30 分钟 |
| upload token TTL | 600 秒 |
| allowed purposes | `image_input`、`image_reference`、`user_artifact` |

### Host Upload errors

| Code | Constant | 含义 |
| --- | --- | --- |
| `-32201` | `UPLOAD_NOT_GRANTED` | 缺 capability、manifest 未声明、grant 未开启 |
| `-32202` | `QUOTA_EXCEEDED` | 上传 quota 耗尽 |
| `-32203` | `INVALID_REQUEST` | mode / filename / mime_type / content 等错误 |
| `-32204` | `TOO_LARGE` | 超过 maxFileBytes 或 8 MiB inline cap |
| `-32205` | `MIME_REJECTED` | MIME 不在 allow-list 或在 block-list |
| `-32206` | `PURPOSE_REJECTED` | purpose 非法或不被 grant 允许 |
| `-32207` | `STORAGE_ERROR` | R2 / 网络 / subcall timeout |
| `-32208` | `TIMEOUT` | host wall-clock 超时 |
| `-32209` | `USER_DENIED` | 用户拒绝即时确认 |
| `-32210` | `UPLOAD_NOT_NEGOTIATED` | v2 未协商或不在 invoke context |
| `-32211` | `MAX_FILES_EXCEEDED` | per-invoke 文件数超限 |
| `-32212` | `NOT_FOUND` | confirm 的 r2_key 不存在或不属于当前上下文 |
| `-32213` | `PRESIGN_FAILED` | host 无法签 PUT URL |

## Anna App 侧 upload.*

App Host API 也有 upload 面：

```text
anna.upload.inline(...)
anna.upload.negotiate(...)
anna.upload.confirm(...)
```

它和插件侧 `host/uploadFile` 语义相近，但授权链路不同：

```text
bundle -> anna.upload.{inline,negotiate,confirm}
       -> postMessage
       -> POST /api/v1/anna-apps/runtime/rpc with X-Anna-App-Token
       -> upload handler
       -> host_upload_service
       -> R2
```

App 侧 ACL：

- `manifest.permissions` 需要包含 `"host.upload"`。
- Admin grant `upload_grant` 控制 size、MIME、purpose、day quota。

和插件侧一样：

- `inline` 适合 <= 8 MiB。
- `negotiate + confirm` 适合大文件。
- `download_url` 约 30 分钟。
- `r2_key` 持久但 opaque，可保存后重签。

## Protocol file transport

Protocol file transport 是 Executa JSON-RPC 协议的大响应逃生通道。

适用：

- tool result JSON 超过约 512 KiB。
- stdout 单行可能超过 2 MiB readline ceiling。

流程：

1. 插件把完整 JSON-RPC response 写入本机临时文件。
2. stdout 返回轻量 pointer：

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "__file_transport": "/tmp/executa-resp-XXXXXX.json"
}
```

3. Agent 读取文件。
4. Agent 解析里面的完整 response。
5. Agent 删除临时文件。

注意：

- 它只解决协议传输问题。
- 它不是 durable storage。
- 它不产生 URL。
- 它不适合让用户下载文件。
- 它不跨机器、不跨 invoke。

## 怎么选

| 需求 | 选择 |
| --- | --- |
| 临时返回一个小文件给用户 | Host Upload inline |
| 临时返回大文件给用户 | Host Upload negotiate + PUT + confirm |
| 长期保存用户/App 文件 | APS files |
| 长期保存 metadata / index | APS KV |
| tool response JSON 太大但确实要回传 | file transport |
| PPTX / PDF / PNG 产物 | APS files，必要时附短期 download URL |
