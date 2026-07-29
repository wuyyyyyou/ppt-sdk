# 使用 APS Files 保存 Export Artifact Mirror

## 决策

Workspace 持有的 PPTX 或 PDF 是权威 Export Artifact（导出产物）。PPT App 通过声明 `aps.files` capability（能力）的 Executa，把每种格式的当前产物发布为一个 `scope: "user"` 的 Export Artifact Mirror（导出产物镜像）。镜像使用固定 APS path 覆盖写入，只在需要兜底下载路径时生成短期 URL，不持久化 URL，也不回退到 Host Upload。选择 `user` scope 是为了与官方 Executa APS Files 示例和平台当前可用的授权路径保持一致；对象仍使用 PPT App 内部 path，并且不登记为产品层面的 My Files Export（导出到“我的文件”）。

镜像发布失败不会删除本地 Export Artifact，用户可以在不重新生成 PPT 的情况下显式重试。`updated_at` 和源文件 SHA-256 共同判断镜像是否仍对应当前产物；如果上传完成后发现源产物发生变化，本次发布直接失败，不自动重试。遗留的 `scope: "app"` 或 `scope: "tool"` mirror 记录不再复用，下一次准备下载时会按缺失镜像重新发布到 `user` scope。My Files Export 仍需要未来单独提供明确的用户操作、产品记录和生命周期语义，不能仅凭底层对象使用 `user` scope 就视为已经导出到“我的文件”。

## 下载交互：优先交给 Host，签名 URL 只作兜底

导出页的「下载」按钮一次点击完成全部动作：必要时发布镜像，然后按下面的顺序取第一条能走通的路径。

1. **Host 中介下载**（默认路径）。调用 `anna.files.download({ path, scope, filename })`，把镜像的 APS path 交给 Host；Host 自己解析对象、校验授权、在顶层浏览上下文触发下载，并处理 attachment disposition 和非 ASCII 文件名。签名 URL 完全不进入 App 的状态和 DOM，这是这条路径优先的原因。App manifest 必须声明 `ui.host_api.files: ["download"]`。
2. **签名 URL + offscreen frame**（兜底）。Host 没有 `files.download`（旧版本或未授权该 namespace）时，退回 `app_get_export_artifact_download_url`，把短期 URL 加载进一个隐藏 frame 让浏览器按 attachment 保存，同时在按钮下方显示只读 URL 输入框和复制按钮。

只有「方法不存在 / 未授权」才降级；路径不存在、会话过期这类真实失败必须直接报错，不能悄悄改走签名 URL 把问题盖掉。

设置页的问题排查包 ZIP 走同一顺序：`app_prepare_workspace_diagnostic_bundle` 除短期 URL 外还返回对象引用（`mirror.path`、`mirror.scope`），前端先交给 `anna.files.download`，不可用时再退回 offscreen frame 加签名 URL。区别在于这个 ZIP 是一次性的：每次点击都重新打包并覆盖写入固定 APS path，引用只存在于当次响应和当前前端状态里，不写进 Workspace，也没有「镜像是否仍然有效」这个概念。

选择 offscreen frame 而不是 `<a download>` 或弹窗，是因为它的失败方式最轻：签名 URL 过期时错误响应渲染在不可见的 frame 里，既不会把 App 自己的页面导航走，也不会留下空白弹窗。

### 历史：为什么曾经必须手动复制 URL

Anna App 运行在 sandboxed iframe（沙箱 iframe）中，早期 Host 给的 sandbox 是 `allow-scripts allow-same-origin allow-forms allow-popups`，没有 `allow-downloads`。当时排查确认 APS 签名 URL 返回 HTTP 200、正确的 PPTX MIME、文件字节和 `Content-Disposition: attachment`，问题不在 APS 或 R2：浏览器会拦掉这个 iframe 发起的一切下载，`target="_blank"` 只是创建继承同一 sandbox 的页面，Blob URL 配合隐藏 `<a download>` 也被静默拦截。因此那一版只提供只读 URL 输入框，让用户粘贴到顶层地址栏。

平台后来同时补上了两件事：App iframe 启用 `allow-downloads`（hosted App 与 `anna-app dev` 本地 harness 行为一致），以及新增 `anna.files.download`。所以现在直接下载可用，兜底路径只为兼容旧 Host 保留。

## 约束与后果

- 按钮不做「准备下载」和「下载」两段式。走 Host 路径时不签发任何 URL；已经落到兜底路径且 URL 仍在有效期内时，再次点击只重新触发一次传输，不重新签发。
- 签名 URL 是短期 bearer credential（持有即授权凭证）。只有兜底路径会产生它，且只保存在当前前端状态中；不得写入 Workspace、日志或长期缓存。
- 复制 URL 的入口只在兜底路径下出现。浏览器是否真的开始下载无法从 JS 侧检测，所以一旦进入兜底路径就必须让入口保持可见，不能依赖失败回调再显示。
- URL 过期后，页面必须隐藏旧 URL；再次点击下载按钮时重新走一遍上面的顺序。
- Clipboard API（剪贴板接口）可能被 iframe permission policy（权限策略）拒绝。复制失败时输入框仍应保持选中，允许用户手动复制。
- APS 镜像继续保存 attachment 的 `Content-Disposition`，兜底路径和用户手动打开 URL 都依赖它。
- Host 路径需要镜像的 APS path。前端从 Workspace 的 `task.artifacts.<type>.mirror` 或发布结果里读，不要在前端重新拼 path 公式；拿不到 path 时先重新发布镜像。
- 不要为了绕过 sandbox 限制去用顶层页面（`window.top.document`）发起下载：它依赖 App 与 Host 同源，生产环境会失效，而且是在规避 Host 明确设置的安全约束。
