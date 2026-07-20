# 05. ppt-sdk 落地指南

本文面向本仓库的 PPT 生成链路，说明如何把 Anna 大文件存储能力落到 `ppt-app` 和 `ppt-engine`。

## 本仓库边界

已有项目约束：

- React 页面组件只调用 `PptBackend`。
- Anna Runtime / standalone 差异放在 adapter 层。
- 工作区文件读写和 gate 判断放在 `ppt-engine` app-facing tools。
- `ppt-engine` 从 Final Deck Render 的整体静态 HTML 生成最终 `.pptx`。
- 前端不能直接读写本地文件系统。
- 大 tool response 应返回 URL / path / artifact id，不返回 bytes。

这些约束和 APS 的设计一致。

## PPT 产物分类

| 数据 | 推荐存储 | 说明 |
| --- | --- | --- |
| brief / requirements | APS KV | 小 JSON |
| outline draft / confirmed outline | APS KV | 带 `etag`，避免并发覆盖 |
| page plan | APS KV | 可 list / 可重算 |
| task progress / page progress | APS KV | 可 TTL 或覆盖写 |
| deck manifest | APS KV 或 APS files | 小 manifest 用 KV；大 manifest 用 files |
| deck HTML | APS files | HTML 可能较大，且可用于 debug |
| rendered screenshots | APS files | PNG/JPEG，不要内联 |
| final `.pptx` | APS files | 用户主要产物 |
| export PDF | APS files | 用户主要产物 |
| template preview images | 静态 public 或 APS files | 取决于来源与生命周期 |
| 临时一次性预览 URL | Host Upload 或 APS download_url | 长期不要只存 URL |

## 推荐 workspace key/path 设计

KV key：

```text
workspaces/{workspace_id}/meta
workspaces/{workspace_id}/requirements
workspaces/{workspace_id}/outline/draft
workspaces/{workspace_id}/outline/confirmed
workspaces/{workspace_id}/page-plan
workspaces/{workspace_id}/task-state
workspaces/{workspace_id}/artifacts/index
```

files path：

```text
workspaces/{workspace_id}/artifacts/deck.html
workspaces/{workspace_id}/artifacts/final.pptx
workspaces/{workspace_id}/artifacts/export.pdf
workspaces/{workspace_id}/screenshots/page-{page}.png
workspaces/{workspace_id}/validation/report.json
```

命名规则：

- 不以 `/` 开头。
- segment 短小稳定。
- 不把用户输入原文直接拼进 path；需要 slug 时先 sanitize。
- path 是内部标识，不要展示为用户可编辑字段。

## Artifact index

建议在 KV 中维护 artifact index，只存 metadata：

```json
{
  "artifacts": [
    {
      "id": "artifact_final_pptx",
      "kind": "pptx",
      "path": "workspaces/ws_123/artifacts/final.pptx",
      "content_type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "size_bytes": 3481274,
      "etag": "W/\"1-abcd\"",
      "created_at": "2026-06-01T12:00:00Z",
      "source_step": "app_start_pptx_export"
    }
  ]
}
```

UI 需要下载时：

1. 用 artifact id 查 index。
2. 调 APS files `download_url`。
3. 将短期 URL 返回给 UI。

不要把 `download_url` 当长期状态保存；它会过期。

## Tool response 规则

### 好的返回

```json
{
  "success": true,
  "data": {
    "workspace_id": "ws_123",
    "artifact": {
      "id": "artifact_final_pptx",
      "kind": "pptx",
      "path": "workspaces/ws_123/artifacts/final.pptx",
      "size_bytes": 3481274,
      "etag": "W/\"1-abcd\""
    },
    "download_url": "https://...",
    "download_url_expires_at": "2026-06-01T12:30:00Z"
  }
}
```

### 不好的返回

```json
{
  "success": true,
  "data": {
    "pptx_base64": "UEsDBBQAAAA..."
  }
}
```

原因：

- 容易超过 stdio 单行限制。
- base64 放大约 1.33 倍。
- LLM/前端不需要 bytes。
- 重试和日志都会复制大 payload。

## 实现层建议

### `ppt-engine`

职责：

- 创建 workspace。
- 写 KV：requirements、outline、page plan、task state、artifact index。
- 写 files：deck HTML、PPTX、screenshots、validation report。
- 对外返回 artifact 引用和 download URL。

建议新增/收敛的 app-facing tool：

```text
app_create_workspace
app_save_workspace_state
app_get_workspace_state
app_put_artifact
app_get_artifact_download_url
app_list_artifacts
```

具体命名应沿用现有工具风格。

### `ppt-app`

职责：

- 通过 `PptBackend` 请求 workspace/artifact 状态。
- 展示 artifact 列表。
- 点击下载时请求短期 URL。

不要：

- 在 React 组件里直接调用 `anna.files.*`。
- 在 UI state 里长期保存 presigned URL。
- 让前端直接拼 APS path 做权限判断。

## 并发策略

可能的并发来源：

- 同一个 workspace 多窗口打开。
- Agent retry。
- 用户编辑 outline 时后台 generation 仍在跑。
- validation / export 并发写 artifact index。

规则：

- KV 覆盖写带 `if_match`。
- 读-改-写失败后重新读最新值并合并。
- artifact index 用 append/replace by id 语义，不要整表盲写。
- 大文件 path 尽量内容地址化或版本化，避免覆盖同一路径：

```text
workspaces/ws_123/artifacts/final-v3.pptx
workspaces/ws_123/screenshots/render-20260601T120000/page-01.png
```

如果必须覆盖固定 path，使用 `if_match`。

## 错误处理策略

| 错误 | UI / agent 行为 |
| --- | --- |
| `STORAGE_NOT_GRANTED` / `permission_denied` | 提示授权或 manifest 配置缺失 |
| `QUOTA_EXCEEDED` | 告诉用户空间不足；不要无限重试 |
| `VALUE_TOO_LARGE` | 改用 files；这是实现错误 |
| `PRECONDITION_FAILED` | 自动重新读并合并，最多重试有限次数 |
| `RATE_LIMITED` | 降低 per-invoke RPC 数；批量写 |
| `UPSTREAM_ERROR` / R2 5xx | 指数退避，最多 2-3 次 |
| presigned URL 过期 | 重新请求 download URL |

## 验证清单

实现 APS / 大文件存储改动后，至少验证：

- 小状态能 `set -> get -> list -> delete`。
- `null` 值能正确 round-trip，缺失判断用 `exists`。
- 并发写 `if_match` 失败能被处理。
- 大文件上传走 presigned PUT，不走 tool result。
- 不调用 finalize/complete 的 pending upload 会被视作失败路径并可恢复。
- 下载 URL 过期后能重新 mint。
- tool response 不包含 base64 大字段。
- Anna App UI 只拿 artifact id / URL，不读本地文件系统。
- standalone/mock adapter 有相同行为语义。

## 最小开发顺序

1. 先封装 `StorageClient` / `ArtifactStore`，不要把 raw RPC 散落到业务函数。
2. 先支持 APS KV artifact index。
3. 再支持 APS files 上传与 download URL。
4. 最后把现有大 tool response 改成 artifact 引用。
5. 补 mock adapter 与 fixture。
6. 跑 `ppt-app` 的 `npm run check` / `npm run build`，涉及 engine 时先 build engine。
