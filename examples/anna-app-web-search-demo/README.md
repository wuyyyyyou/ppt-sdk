# Anna App Web 与图片搜索 Demo

这是一个不依赖 Executa 的纯前端 Anna App，用于验证 Anna 官方 `web.*` Host API：

- `anna.web.search`：Web / 新闻搜索。
- `anna.web.fetch`：抓取网页正文并提取 Markdown。
- `anna.web.image_search`：安全搜索开启的图片搜索。
- `anna.web.image_fetch`：由宿主下载图片并存入 APS Files，返回工件引用。

## 运行

需要使用已登录、支持 `web.*` Host API 的 Anna App CLI。首次安装依赖后运行：

```bash
cd examples/anna-app-web-search-demo
npm install
npm run dev
```

本 demo 必须通过 `anna-app dev` 或 Anna Host 打开，不能直接双击 `bundle/index.html`，因为浏览器页面本身没有 `AnnaAppRuntime`。

开发安装通常会为 App 创建完整启用的 `web_grant`，因此本地调用可能不会出现生产环境首次授权的 `APP_NOT_GRANTED` 流程，而且开发调用通常不计费。

## 构建与检查

```bash
npm run check
npm run build
npm run validate
```

静态构建只是把 `src/` 中的 HTML、CSS 和 JavaScript 复制到 `bundle/`，没有额外的前端框架或打包器。

## 观察重点

- Web 搜索的 `provider_tier`、`quota_consumed`、结果摘要和调用耗时。
- `web.fetch` 的逐 URL `ok`、`error`、`truncated` 和正文质量。
- 图片结果的尺寸、来源页、`license_hint` 和缓存状态。
- `image_fetch` 返回的 `path`、`get_url`、MIME、字节数与 SHA-256。
- 页面底部诊断区中的完整请求参数、原始响应、错误码和耗时。

官方参考：<https://staging.anna.partners/developers/reference/host-api-web.md>
