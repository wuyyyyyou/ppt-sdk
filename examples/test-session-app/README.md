# Session 生命周期测试 App

这个 Anna App 用于诊断前端 raw Agent session API 和 `llm.complete` 的调用结果与耗时：

- `agent.session.create`
- `agent.session.run`
- `agent.session.delete`
- `llm.complete`

页面分为 `Session 测试`、`LLM 测试`、`调用记录` 三个页签。每次 API 操作都有独立的
`record_id`，完整请求、响应、错误、事件时间线和耗时会持久化到浏览器 IndexedDB。

## 目录

```text
test-session-app/
├── manifest.json
├── app.json
├── src/
│   ├── app.js             # Anna 调用编排和 UI 状态
│   ├── anna-llm.js        # LLM 请求构造和 Runtime 调用适配
│   ├── record-store.js    # IndexedDB 调用记录存储
│   └── record-utils.js    # 安全序列化、文本提取和耗时工具
├── test/                  # 不依赖后端的纯逻辑单测
├── bundle/                # npm run build 后生成
└── scripts/build.mjs
```

## 记录内容

Session 操作会分别记录：

- `session.create` 的完整请求、响应和创建耗时；
- `session.run` 的 RPC 响应耗时、`stream_id`、`run_id`、首帧耗时、完成耗时、最大帧间隔、完整 stream frames 和输出文本；
- `session.delete` 的完整请求、响应和删除耗时。

LLM 操作会记录：

- system/user messages；
- 实际调用路径：`runtime.call` 或回退的 `runtime.llm.complete`；
- 传给 Anna Runtime 的超时时间；
- 完整原始响应、提取文本、model、usage、stop reason 和完整耗时。

记录使用 `performance.now()` 计算毫秒耗时，同时保存 ISO 时间。无法直接写入 IndexedDB
的错误、循环引用或特殊对象会转成 JSON-compatible（JSON 兼容）结构，不截断长文本或流帧。

## 停止等待

“停止等待”只解除当前页面的前台等待状态，不宣称取消平台请求。请求会继续在后台运行，
之后收到的响应或 stream frames 仍会更新到原来的 IndexedDB 记录。页面顶部会显示后台请求数量，
用户可以立即发起新的测试。

如果页面在请求完成前刷新或关闭，下次加载时会将遗留的 `running` / `waiting_stopped` 记录标记为
`interrupted`。

## 数据存储

- 完整调用记录保存在 IndexedDB 数据库 `anna-session-llm-diagnostics` 中，不自动删除。
- 表单配置和现有 `app_session_uuid` 列表保存在 `localStorage`。
- “调用记录”页签支持筛选、查看完整 JSON、复制、删除和清空。
- Chrome DevTools 中也可以通过 `Application → Storage → IndexedDB` 查看原始记录。

App 不会在页面关闭时自动删除 Session，方便观察 active session 和 ID 复用行为。`localStorage`
只保存 `app_session_uuid`，不会保存 `app_session_token`。本地 `@anna-ai/cli` harness 中，
`session.run` 仍依赖 harness 进程内存中的 token 缓存，只凭 UUID 不能跨 harness 重启复用。

## 构建与验证

```bash
cd examples/test-session-app
npm test
npm run build
npm run validate
```

本地交互测试由用户自行启动：

```bash
npm run dev
```

未连接 Anna runtime 时，页面会显示错误并禁用 Session 和 LLM 操作，不提供 mock 响应。
