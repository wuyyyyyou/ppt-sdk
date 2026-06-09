# 03. Anna App Host API: storage.* 与 files.*

本文描述 Anna App iframe / bundle 侧如何使用 APS。这里不是 Executa 插件 reverse RPC，而是前端通过 `AnnaAppRuntime` 暴露的 Host API 调用。

## 与插件侧的区别

| 维度 | Executa 插件侧 | Anna App bundle 侧 |
| --- | --- | --- |
| 调用方式 | reverse JSON-RPC over stdio | `postMessage` 到 Anna runtime |
| 方法命名 | `storage/get`、`files/upload_begin` | `anna.storage.get(...)`、`anna.files.upload_init(...)` |
| 授权 token | `storage_token` 注入到 `invoke.context` | iframe session token / `X-Anna-App-Token` |
| ACL | Executa manifest `host_capabilities` + 用户 grant | App manifest `permissions` + `ui.host_api` + capability |
| bytes 路径 | 插件拿 presigned URL 后直接 PUT | 浏览器拿 presigned URL 后直接 PUT |

## storage.*: per-App KV

App 侧 `storage.*` 是 APS-backed per-App key/value state。

调用链：

```text
bundle -> anna.storage.{get,set,delete,list}
       -> postMessage
       -> POST /api/v1/anna-apps/runtime/rpc
       -> storage handler
       -> StorageService.kv_*
       -> Postgres aps_entries + Redis quota
```

能力：

- `storage.get`
- `storage.set`
- `storage.delete`
- `storage.list`

用途：

- 保存 App UI 状态。
- 保存 workspace metadata。
- 保存 artifact 索引。
- 保存短期 URL 对应的长期 handle。

不要保存大 bytes。大文件走 `files.*`。

### 重要语义

- APS production backend 支持 `etag`、`if_match`、`ttl_seconds`、metadata / tags。
- legacy `runtime_state` fallback 是单 JSON column，硬 cap 约 256 KiB，不支持完整 APS 语义。
- 不要依赖 legacy cross-tab sync；APS 路径下应在窗口 focus 时重新 `storage.get` 或显式刷新。
- key 有路径规则：不允许 leading `/`、空 segment、`.` / `..`、控制字符、bidi/zero-width 等。
- `null` 是合法值；判断是否存在看 `exists`。

## files.*: per-App blob storage

App 侧 `files.*` 是 APS object storage + R2。

能力：

- `files.upload_init`
- `files.upload_finalize`
- `files.download_url`
- `files.list`
- `files.delete`

调用链：

```text
bundle -> anna.files.{upload_init,upload_finalize,download_url,list,delete}
       -> postMessage
       -> POST /api/v1/anna-apps/runtime/rpc
       -> files handler
       -> StorageService.object_*
       -> Postgres aps_entries + R2 presign + Redis quota
```

### 两阶段上传

```text
1. files.upload_init
   - 创建 pending aps_entries row
   - 预留 quota
   - 返回短期 R2 presigned PUT URL

2. 浏览器直接 PUT bytes 到 R2

3. files.upload_finalize
   - host 对 R2 object 做 HEAD
   - 校验 byte length / etag
   - pending -> active
   - 提交 quota reservation
   - 返回 canonical etag / generation
```

没有同步的 `files.put(bytes)`。这是刻意设计：大文件不 pin Nexus request worker，浏览器直接与 R2 传 bytes。

### 下载

`files.download_url` 为 active entry mint 短期 R2 presigned GET URL。前端可以把它用于：

- `<img src>`
- `<video src>`
- `fetch()`
- 下载按钮

URL 是短期凭证，不能长期保存为唯一引用。长期保存 APS path / artifact id / etag，需要展示或下载时重新调用 `files.download_url`。

### 删除

`files.delete` 是 soft delete：

- row 标记为 deleted。
- quota bytes 立即回收。
- R2 object 由 reaper 异步 hard delete。
- 支持 `if_match`，用于并发安全删除。

## App manifest 需要声明什么

具体字段会随 schema 演进，但 staging reference 当前说明了三层 ACL：

### storage.*

- `manifest.permissions` 需要包含 `"host.storage"`。
- `host_capabilities` 决定可访问哪些 scope/owner。
- `ui.host_api.storage` 需要列出方法，例如 `["get", "set", "delete", "list"]`。

### files.*

- `manifest.permissions` 需要包含 `"host.files"`。
- `host_capabilities` 需要声明 `aps.files`、`aps.kv` / `aps`、细粒度 `aps.scope.app.{read,write}` 或 admin 能力。
- `manifest.ui.host_api.files` 必须列出每个方法，或用 `"*"`。

本仓库已有 Anna App manifest 时，应优先沿用项目当前 schema 与 adapter 层写法，避免前端直接读写文件系统。

## 推荐前端调用模式

### 保存小状态

```ts
const cur = await anna.storage.get({ key: "workspaces/ws_123/meta" });
await anna.storage.set({
  key: "workspaces/ws_123/meta",
  value: nextMeta,
  if_match: cur.exists ? cur.etag : undefined,
});
```

### 上传文件

伪代码：

```ts
const init = await anna.files.upload_init({
  path: "workspaces/ws_123/artifacts/deck.pptx",
  content_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  size_bytes: file.size,
});

await fetch(init.presigned_url, {
  method: "PUT",
  headers: init.headers ?? { "Content-Type": file.type },
  body: file,
});

const done = await anna.files.upload_finalize({
  path: "workspaces/ws_123/artifacts/deck.pptx",
  etag: init.etag_or_upload_etag,
});
```

实际参数名以当前 runtime SDK 为准。写代码前要查看本仓库 `ppt-app/src/api` 的 adapter 封装，不要把 Host API 调用散落在 React 组件中。

## 和 `ppt-app` 的边界

本仓库约束：

- React 页面组件只调用 `PptBackend`。
- Anna Runtime / standalone 差异放 adapter 层。
- 前端不能直接读写本地文件系统。

因此如果要在 App 侧接入 APS：

1. 在 `PptBackend` 增加明确方法，例如 `uploadArtifactFile`、`getArtifactDownloadUrl`、`saveWorkspaceMetadata`。
2. Anna adapter 用 `anna.storage.*` / `anna.files.*`。
3. standalone/mock adapter 提供内存或 fixture 实现。
4. 页面只处理 `artifact_id`、status、download URL，不接触 APS 细节。
