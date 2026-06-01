# Host Upload 测试 App

这个 Anna App 用于测试两类文件链路：

1. **Host Upload**：Node Executa 插件调用 `host/uploadFile`，支持 `inline` 和 `negotiate + PUT + confirm`。
2. **APS Files**：Node Executa 插件参考官方 `storage-notebook` 示例，调用 `files/upload_begin`、`files/upload_complete`、`files/download_url`、`files/list`、`files/delete`。
3. **前端下载**：App 前端拿后端返回的短期 `url`，先尝试 `fetch` 校验，再触发浏览器下载。

## 目录

```text
test-aps-app/
├── manifest.json
├── app.json
├── src/                         # 工程化前端源码
├── bundle/                      # anna-app runtime 加载的静态 bundle
├── scripts/build.mjs            # 无依赖构建脚本
└── executas/host-upload-node/   # Node Executa 后端
```

## 运行

```bash
cd test-aps-app
npm run build
anna-app dev
```

如果要严格校验 manifest：

```bash
npm run validate
```

## 权限和 grant

后端插件的 `describe` manifest 声明：

```json
{
  "host_capabilities": ["host.upload", "aps.files"]
}
```

真实环境中，还需要 Anna Admin 为该 Executa 开启 `upload_grant` 和 APS / storage grant。初始化响应按官方 Host Upload 示例声明 `client_capabilities: { upload: {} }`，并为 APS Files 声明 `storage.files`。

默认表单使用 `text/plain` 上传测试文本。如果 Admin grant 的 “允许的 MIME 类型”只填了图片类型，需要额外加入 `text/plain`，否则 manifest 权限通过后会继续被 MIME allow-list 拒绝。

## 测试建议

- 先用 `inline`，内容大小保持在 1-100 KiB。
- 再用 `negotiate`，测试 PUT 到 R2 和 confirm。
- 切到 “APS Files 测试” 标签页，先上传 `test-aps/hello.txt`，再测试“签下载 URL”“列文件”“删除文件”。
- 如果前端 `fetch` 因 CORS 失败，可用“直接打开下载 URL”验证 URL 是否可用。
- `url` 是短期 presigned GET URL，不要当长期状态保存。
