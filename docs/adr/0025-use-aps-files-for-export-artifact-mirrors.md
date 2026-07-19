# 使用 APS Files 保存 Export Artifact Mirror

## 决策

Workspace 持有的 PPTX 或 PDF 是权威 Export Artifact（导出产物）。PPT App 通过声明 `aps.files` capability（能力）的 Executa，把每种格式的当前产物发布为一个 `scope: "user"` 的 Export Artifact Mirror（导出产物镜像）。镜像使用固定 APS path 覆盖写入，只在用户准备下载时生成短期 URL，不持久化 URL，也不回退到 Host Upload。选择 `user` scope 是为了与官方 Executa APS Files 示例和平台当前可用的授权路径保持一致；对象仍使用 PPT App 内部 path，并且不登记为产品层面的 My Files Export（导出到“我的文件”）。

镜像发布失败不会删除本地 Export Artifact，用户可以在不重新生成 PPT 的情况下显式重试。`updated_at` 和源文件 SHA-256 共同判断镜像是否仍对应当前产物；如果上传完成后发现源产物发生变化，本次发布直接失败，不自动重试。遗留的 `scope: "app"` 或 `scope: "tool"` mirror 记录不再复用，下一次准备下载时会按缺失镜像重新发布到 `user` scope。My Files Export 仍需要未来单独提供明确的用户操作、产品记录和生命周期语义，不能仅凭底层对象使用 `user` scope 就视为已经导出到“我的文件”。

## 为什么下载需要手动复制 URL

Anna App 运行在 sandboxed iframe（沙箱 iframe）中。当前 Host 为 iframe 设置：

```text
allow-scripts allow-same-origin allow-forms allow-popups
```

其中没有 `allow-downloads`。实际排查确认 APS 签名 URL 返回 HTTP 200、正确的 PPTX MIME、文件字节，以及 `Content-Disposition: attachment`；问题不在 APS 或 R2。浏览器仍会阻止由该 iframe 发起的下载。`target="_blank"` 只会创建继承原 sandbox 限制的空白页面，不能绕过下载限制；Blob URL 配合隐藏的 `<a download>` 也会被同一限制静默拦截。

因此，在不修改 Anna Host iframe sandbox 的前提下，PPT App 不直接触发浏览器下载。下载链接准备完成后，页面显示一个不可点击的只读 URL 输入框和复制按钮，并提醒用户把 URL 粘贴到普通浏览器标签页的地址栏。地址栏导航发生在顶层页面，不受 Anna App iframe 的下载限制，R2 的 attachment 响应会正常触发下载。

## 约束与后果

- 下载比标准按钮多一次复制和粘贴，这是当前 sandbox 约束下的显式取舍。
- 签名 URL 是短期 bearer credential（持有即授权凭证），只保存在当前前端状态中；不得写入 Workspace、日志或长期缓存。
- URL 过期后，页面必须隐藏旧 URL，并要求用户重新准备下载链接。
- Clipboard API（剪贴板接口）可能被 iframe permission policy（权限策略）拒绝。复制失败时输入框仍应保持选中，允许用户手动复制。
- APS 镜像继续保存 attachment 的 `Content-Disposition`，保证用户在顶层地址栏打开 URL 时浏览器按文件下载。
- 如果未来 Anna Host 为受信任 App 增加 `allow-downloads` 或等价的宿主下载 API，可以重新评估直接下载交互；在此之前不要恢复 Blob 下载或弹窗方案。
