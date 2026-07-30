# anna-app-file-upload-demo

A `schema: 2` Anna App (display name **Host Upload Demo**) that demonstrates
the **`host/uploadFile`** reverse-RPC — **`inline`**, **`negotiate`** and
**`confirm`** — persisting a binary blob to **short-lived** host storage
(~30 min TTL, not enumerable).

> Reference:
> [Executa · Host Upload](https://anna.partners/developers/reference/executa-host-upload).

```
iframe ── tools.invoke(make_sample) ─────▶ Executa ── writes scratch file ─▶ local disk
iframe ── tools.invoke(host_upload_path) ▶ Executa ── host/uploadFile ──────▶ host ──▶ R2
                                              │ inline (≤8 MiB, base64 round-trip)
                                              │ negotiate → PUT (plugin→R2) → confirm
                                              ▼
                                         short-lived download URL (~30 min TTL)
```

## Why bytes are sourced locally, not from the browser

`host/uploadFile` persists a blob the **Executa already holds** — an image it
generated, a screenshot, an intermediate PDF — and in `negotiate` mode the
bytes stream **plugin → R2 directly**, never touching the JSON-RPC stdio
channel.

A browser-picked `File` can only reach a subprocess **over that stdio
channel**. Shipping it as base64 through `anna.tools.invoke` makes the bytes
cross stdio twice (in via the invoke request; back out via the reverse-RPC
request for `inline`), which caps the practical file size at the stdio line
limit and defeats the whole point of `negotiate`. So this demo flips the
model: the iframe sends only **small control messages** (a size, or a local
path) and the **Executa supplies the bytes**. That is what lets
`host/uploadFile` scale past the stdio limit.

## The three modes

| Mode                | When                     | Path                                                                 |
| ------------------- | ------------------------ | -------------------------------------------------------------------- |
| `inline`            | payload ≤ 8 MiB          | one reverse-RPC round-trip, bytes ride as base64                     |
| `negotiate`         | payload > 8 MiB          | host signs an R2 `PUT` URL; the Executa streams the file to R2       |
| `confirm`           | after a `negotiate` PUT  | host HEADs R2, registers the object, returns the short-lived link    |

All three return a short-lived HTTPS GET URL. Store the `r2_key`, **not** the
`download_url` — URLs TTL out (~30 min), keys are stable for the object's
lifetime.

## Tools exposed by the Executa

| Tool               | Does                                                                                     | Returns                                                       |
| ------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `make_sample`      | Write a scratch file of `size_bytes` bytes to the local filesystem.                     | `{ ok, path, filename, size_bytes }`                         |
| `host_upload_path` | Read a **local file path** and persist it via `host/uploadFile` (auto/forced inline/forced negotiate). | `{ ok, mode, filename, size_bytes, mime_type, download_url, r2_key, expires_at }` |
| `get_diagnostic_log` | Return one byte-bounded page of Executa-side phase logs for a diagnostic run. | `{ ok, run_id, cursor, next_cursor, done, total_events, events }` |

`make_sample` exists only so the UI can conjure preset-size payloads that
straddle the thresholds without committing large binaries to the repo. A real
Executa would already have the bytes (a rendered image, a downloaded asset)
and call `host_upload_path` directly.

The Executa declares `host_capabilities: ["host.upload"]`. Without it the host
refuses `host/uploadFile` with `UPLOAD_NOT_GRANTED` (-32201). The user must
also have `upload_grant` enabled on their `UserExecuta`.

## Quotas & MIME whitelist (`upload_grant`)

The host enforces the user's grant before any R2 round-trip:

- **Per-file size cap** — `25 MiB` under `anna-app dev` (the doc-default is
  `20 MiB`). Over the cap &rarr; `UPLOAD_TOO_LARGE` (-32204). The **30 MiB**
  preset deliberately trips it.
- **MIME whitelist** — the dev grant allows `image/png`, `image/jpeg`,
  `image/webp`, `image/gif`, `text/plain`, `text/markdown`,
  `application/json`, `application/pdf`. A type outside the list (e.g.
  `application/octet-stream`) &rarr; `UPLOAD_MIME_REJECTED` (-32210). The
  synthetic samples upload as `application/pdf`; the upload-by-path field
  infers the MIME from the file extension.

This demo does not change the quota.

---

## Run

```bash
pnpm install
```

Then:

```bash
# Real Host Upload. Needs a signed-in account so the host can mint an
# upload_token — but, unlike the APS files/* flow, does NOT need --storage aps.
anna-app login --host https://anna.partners   # one-time
pnpm dev

# Mocked (offline, deterministic): the bridge intercepts tools.invoke and
# replays fixtures/happy-path.jsonl. No real host/uploadFile is issued.
pnpm dev:mock

# UI-only (LLM disabled):
pnpm dev:off
```

The harness opens the bundle in a Chromium iframe:

1. **Preset uploads** — click a size button. The Executa `make_sample`s a
   payload of that size and `host_upload_path`s it. Watch the **mode** flip
   from `inline` (1/6 MiB) to `negotiate+confirm` (12/18 MiB) across the 8 MiB
   cap, and the **30 MiB** button trip `UPLOAD_TOO_LARGE` against the per-file
   quota.
2. **Upload a local file by path** — type an absolute path the Executa can
   read on this machine, pick a `purpose`, and click **Upload path**.

Each result shows the size + chosen mode and, on success, the short-lived
`open ↗` link. Host Upload objects are transient and **never** listed — the
returned link is the only deliverable.

## 并发 invoke 关联验证

页面中的“并发 invoke 关联验证”区域用于确认多个独立 `tools.invoke`
同时执行 `host/uploadFile` 时，`negotiate` 和 `confirm` 是否始终携带各自的
`params.context.invoke_id`，且 `r2_key` 不会被错误归属。

- 测试文件固定为 256 KiB，并强制使用 `negotiate → PUT → confirm`，与
  `ppt-engine` 上传页面截图的路径一致。
- 可配置并发数、总调用数、confirm 前固定延迟和随机抖动。
- 建议使用并发数 4 或 8；通过标准是归属错误为 0。
- 浏览器记录调用调度、耗时和最终错误；Executa 单独记录
  negotiate、PUT、confirm 的阶段事件。
- 测试完成后可从浏览器下载合并后的 JSONL。下载 URL、签名和 token 会被
  脱敏，`run_id`、`call_id`、父级 `invoke_id`、reverse RPC 实际携带的
  `wire_invoke_id` 和 `r2_key` 会保留用于关联；同一调用的两个 ID 应一致。
- Executa 日志按约 24 KiB 的字节预算分页返回，浏览器自动逐页拉取并合并，
  避免单行 JSON-RPC 响应超过 Anna Runtime 默认的 64 KiB stdout 限制。

`pnpm dev` 可以检查本地 Host Upload 链路和新的上下文发帧，但原缺陷只在
平台安装模式稳定复现，因此本地测试成功不能单独证明平台问题已修复。
最终验证应重新构建并发布 `0.2.5` Executa，通过平台安装后交给
`1.1.0-beta.26+` 的 Local Agent 运行并发测试。通过标准如下：

- 所有调用成功，归属错误为 0。
- 每次调用的 `negotiate` 和 `confirm` 日志中，`invoke_id` 与
  `wire_invoke_id` 一致。
- 同一次调用从 `negotiate` 返回、PUT 使用、再传给 `confirm` 的 `r2_key`
  完全一致。

`pnpm dev:mock` 不会发出真实 reverse RPC，因此只能检查界面，不能验证
并发归属问题。

Executa 是自包含的，不依赖仓库外的 Python SDK 路径。可以先运行下面的
启动回归测试，确认 Anna Dev 使用的真实 `uv run` 命令能够完成 `describe`
和 `make_sample`：

```bash
pnpm test:startup
```

> **No browser CORS is involved.** Unlike a browser-side `PUT`, the `negotiate`
> `PUT` happens inside the Executa subprocess, so the R2 bucket does not need
> to allow the dev origin.

## Permission surface

```json
"permissions": ["chat.write_message", "tools.invoke"],
"required_executas": [
  { "tool_id": "bundled:file-upload-via-executa", "min_version": "0.1.0", "version": "latest" }
],
"ui": {
  "host_api": {
    "tools":  ["required:bundled:file-upload-via-executa"],
    "chat":   ["write_message"],
    "window": ["set_title"]
  }
}
```

The app itself requests **nothing** beyond `tools.invoke` — no upload grant of
its own. All host storage is reached through *the Executa's* `host.upload`
capability, keeping the app's permission surface tiny. That is the recommended
pattern: put the storage trust boundary on the Executa, where it belongs.

## See also

- [`anna-app-aps-files-demo`](../anna-app-aps-files-demo) — **durable**,
  enumerable per-user object storage via the `files/*` reverse-RPC
  (`upload_begin` → PUT → `upload_complete`). Use that for state the user
  should find again; use **this** demo's `host/uploadFile` for throwaway
  invoke-scoped artefacts.
