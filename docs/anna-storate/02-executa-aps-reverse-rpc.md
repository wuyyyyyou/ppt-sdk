# 02. Executa 插件侧 APS Reverse RPC

本文描述 stdio Executa 插件如何使用 APS。这里的调用发生在插件进程内，是插件通过同一条 stdin/stdout JSON-RPC 通道反向请求 host。

## 前置条件

Executa 插件要使用 APS，必须同时满足三层门控。

### 1. 协议 v2 negotiation

Agent 启动插件后会尝试调用 `initialize`：

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "method": "initialize",
  "params": {
    "protocolVersion": "2.0",
    "clientInfo": { "name": "matrix-agent", "version": "1.0" },
    "capabilities": {
      "sampling": {
        "modalities": ["text"],
        "maxTokensPerCall": 8192,
        "maxCallsPerInvoke": 8
      },
      "fileTransport": true
    }
  }
}
```

插件需要返回同样的 `protocolVersion`，并声明自己会使用的能力子集：

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "result": {
    "protocolVersion": "2.0",
    "serverInfo": { "name": "my-tool", "version": "0.1.0" },
    "capabilities": {
      "storage": { "files": true }
    }
  }
}
```

如果插件对 `initialize` 返回 `-32601 method not found` 或超时，Agent 会降级到 v1。v1 插件仍能 `describe` / `invoke`，但不能使用 reverse RPC，也就不能用 APS。

### 2. `describe` manifest 声明

仅 negotiate 成功还不够。插件的 `describe` manifest 还必须声明 `host_capabilities`：

```json
{
  "name": "tool-yourhandle-ppt-engine-abcd1234",
  "version": "1.0.0",
  "host_capabilities": ["aps.files"],
  "tools": []
}
```

`aps.files` 解锁 `files/*` reverse RPC。对象实际写入 `user`、`app` 还是 `tool` scope，由每次 `files/*` 调用的 `scope` 参数决定，而不是通过不同的 manifest capability 区分。当前协议以 `anna-executa-examples/examples/anna-app-aps-files-demo` 为准；旧 staging 文档中的 `storage.user`、`storage.app`、`storage.tool` 声明不再作为实现依据。

没有 `aps.files` manifest 声明时，Nexus 会在 gate 层拒绝对应 reverse RPC；调用仍应只请求业务实际需要的 scope。

### 3. 用户 grant

用户必须在 Anna Admin 为该 Executa 开启 storage grant。grant 控制：

- `allowed_scopes`
- `quotaBytes`
- `objectMaxBytes`
- 每 invoke 调用预算等

缺任一条件时，APS 请求会失败。staging 文档中 storage 统一错误码包括 `-32021 STORAGE_NOT_GRANTED`。

## Per-invoke context

v2 生效后，每个 `invoke` 请求会在 `params.context` 注入短期 token：

```json
{
  "method": "invoke",
  "params": {
    "tool": "summarize",
    "arguments": { "text": "..." },
    "context": {
      "credentials": {},
      "invoke_id": "8f1c...",
      "sampling_token": "eyJ...",
      "storage_token": "eyJ..."
    }
  }
}
```

`storage_token` 特性：

- JWT audience: `aps-storage`
- TTL: 约 600 秒
- 绑定 `(user_id, executa_tool_id, tool_invoke_id)`
- 包含 allowed scopes / quota / max calls 等授权信息
- 只在当前 invoke 期间使用，不要持久化

## Reverse RPC 调用形状

插件向 host 发 reverse RPC，使用同一条 stdio JSON-RPC 通道。staging APS 页当前使用的方法名如下。

### KV 方法

```text
storage/get
storage/set
storage/delete
storage/list
```

示例：

```json
{
  "jsonrpc": "2.0",
  "id": "aps-1",
  "method": "storage/set",
  "params": {
    "scope": "tool",
    "key": "lastRun/cursor",
    "value": { "page": 7, "ts": "2026-05-01T11:22:33Z" },
    "ttl_seconds": 86400
  }
}
```

Agent 会把 storage RPC 转发到 Nexus `/api/v1/storage/*`，并附加 `Authorization: Bearer <storage_token>`。SDK 通常会自动携带 token；手写协议时需要确保当前 invoke context 可用。

### Object / file 方法

```text
files/upload_begin
files/upload_complete
files/download_url
files/list
files/delete
```

典型两阶段上传：

```text
1. files/upload_begin
   -> { presigned_url, fields?, expires_at, path/handle }

2. 插件直接 HTTP PUT bytes 到 presigned_url

3. files/upload_complete
   -> { path, etag, size_bytes }
```

下载：

```text
files/download_url
-> { url, expires_at }
```

重点：

- bytes 不走 stdio。
- bytes 不走 Nexus worker。
- presigned PUT URL 短期有效。
- 必须 complete/finalize，否则 pending 对象会被回收。
- `scope: "user"` 可把文件写入用户 drive，但前提是 token 的 allowed scopes 包含 `user`。

## Result shapes

### KV get

命中：

```json
{ "value": { "page": 7 }, "exists": true, "etag": "W/\"3-abcd\"" }
```

未命中：

```json
{ "value": null, "exists": false, "etag": null }
```

永远用 `exists` 判断是否存在，不要用 `if value`。`null`、`false`、`0`、`[]` 都可能是合法存储值。

### KV set

```json
{ "etag": "W/\"4-bcde\"", "size_bytes": 1234 }
```

### Object upload complete

```json
{
  "path": "workspaces/ws_123/artifacts/deck.pptx",
  "etag": "W/\"1-abcd\"",
  "size_bytes": 3481274
}
```

### Download URL

```json
{
  "url": "https://r2.anna.partners/...?X-Amz-Signature=...",
  "expires_at": "2026-06-01T12:30:00Z"
}
```

## 乐观并发

覆盖写时带上上一次读到的 `etag`：

```json
{
  "method": "storage/set",
  "params": {
    "scope": "tool",
    "key": "notes/123",
    "value": [{ "ts": "2026-06-01T12:00:00Z", "text": "..." }],
    "if_match": "W/\"3-abcd\""
  }
}
```

遇到 `PRECONDITION_FAILED`：

1. 重新 `storage/get`。
2. 合并最新值。
3. 用新 `etag` 再写。

不要盲目覆盖，否则多窗口、多 agent run 或重试场景会丢更新。

## Limits

staging 文档中看到的关键限制：

| 限制 | 默认/说明 |
| --- | --- |
| Per-user total bytes | 默认 5 GB，可被 plan 覆盖 |
| 单 KV value | 64 KB 级别，超出会 `VALUE_TOO_LARGE` |
| 单对象大小 | 来自 grant 的 `objectMaxBytes` |
| Per-invoke storage RPC | 默认 200 次 |
| `storage_token` TTL | 600 秒 |

## Error codes

| Code | Name | 处理 |
| --- | --- | --- |
| `-32021` | `STORAGE_NOT_GRANTED` | 缺 token、缺 capability、scope 不允许；不可自动修复 |
| `-32022` | `NOT_FOUND` | key/path 不存在；多数 `storage/get` 会被 normalize 成 `{exists:false}` |
| `-32023` | `PRECONDITION_FAILED` | `if_match` etag 不匹配；重新读取再合并 |
| `-32024` | `QUOTA_EXCEEDED` | quota 不足；同 invoke 内不可重试 |
| `-32025` | `VALUE_TOO_LARGE` | KV 太大；改用 files |
| `-32026` | `RATE_LIMITED` | per-invoke RPC 预算耗尽；减少调用 |
| `-32027` | `INVALID_PATH` | key/path 非法；修正路径 |
| `-32028` | `INVALID_REQUEST` | 缺字段或类型错误 |
| `-32029` | `UPSTREAM_ERROR` | Nexus/R2 网络或 5xx；可有限重试 |

## 实现注意

- 插件必须是长运行进程，持续读 stdin，不能处理一条请求后退出。
- stdout 只能写 JSON-RPC frame；日志写 stderr。
- reverse RPC 与普通 invoke response 共用 stdin/stdout，手写实现时需要单 reader + response dispatch。
- Files client 不应在本地等待 `initialize` 后再自行 enable；它应直接发送 `files/*` reverse RPC，由 host 根据 manifest capability、storage token 和 scope 做权威校验。`initialize` response 仍声明 `capabilities.storage.files`，但不作为客户端本地开关。
- 优先使用 SDK 的 APS/storage client；不要在业务函数里自己乱写协议帧。
- 大文件只返回引用，不返回 bytes。
