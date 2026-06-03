# Session 生命周期测试 App

这个 Anna App 用于测试前端 raw Agent session API：

- `agent.session.create`
- `agent.session.run`
- `agent.session.delete`

它专门测试 `app_session_uuid` 的生命周期，包括创建多个 session、当前页面持有的 session 列表、localStorage 持久化 ID、用持久化 ID 尝试继续 `run`、以及手动删除 session。

## 目录

```text
test-session-app/
├── manifest.json
├── app.json
├── src/              # 静态前端源码
├── bundle/           # npm run build 后生成，anna-app runtime 加载这里
└── scripts/build.mjs
```

## 运行

```bash
cd test-session-app
npm run build
npm run dev
```

如果本目录还没有安装依赖，先运行：

```bash
npm install
```

如果要校验 manifest：

```bash
npm run validate
```

## 测试建议

1. 打开 App 后确认右上角显示“已连接 Anna”。
2. 点击“创建 session”，每点一次只创建一个新的 raw Agent session。
3. 在 session 列表中选择某个 session，点击“运行选中 session”。
4. 查看日志里的 `session.create` 结果、`session.run` stream frame 和最终结果。
5. 刷新页面，App 会从 localStorage 恢复保存过的 `app_session_uuid`，可以继续尝试 `run`。
6. 如果本地 `anna-app dev` harness 没有缓存该 session，预期会看到类似 `session_expired` / `no cached session` 的错误。
7. 用“删除选中”或“清理全部”手动释放 session。

## 重要边界

- App 不会在页面关闭时自动删除 session，方便观察 active session 和复用行为。
- localStorage 只保存 `app_session_uuid`，不会保存 `app_session_token`。
- 在本地 `@anna-ai/cli` harness 中，`session.run` 仍依赖 harness 进程内存中的 token 缓存；只凭 `app_session_uuid` 不能跨 harness 重启复用。
- 未连接 Anna runtime 时，页面只显示错误并禁用 session 操作，不提供 mock session。
