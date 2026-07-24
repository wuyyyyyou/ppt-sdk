# Agent Image Attachments Demo（Agent 图片附件演示）

> PROTOTYPE / 原型：用于验证 `本地图片路径 → Host Upload → 短时 URL → agent.session.run attachments → 多模态响应` 是否在真实 Anna 环境中工作。验证完成后应删除或吸收进正式实现。

这个示例故意不调用 `upload_local_file` 或 `analyze_image`。图片通过 `attachments` 直接交给 Session 背后的视觉模型。

## 运行

```bash
npm install
npm run validate
npm run dev
```

需要提前通过 `anna-app login` 登录真实 Anna 环境。不要用 `--no-llm` 或 mock 模式，因为 Host Upload 和视觉模型都需要真实 Host。

## 操作

1. 在“本地图片路径”文本框中每行输入一个绝对路径，最多 6 个。
2. 点击“上传图片”，由 bundled Executa 读取本地文件，并始终通过
   `negotiate → PUT → confirm` Host Upload 流程生成短时 URL。图片字节直接上传到
   R2，不会编码成 Base64 写入 Executa JSON-RPC stdout。
3. 输入提示词；如有需要，输入视觉模型提示，例如 `gemini`、`gpt-4o`。
4. 点击“运行 Session”。前端会创建临时 Session，把 URL 作为 `attachments` 传入，记录全部流式帧，然后删除 Session。

Host Upload URL 会过期；后续重新测试应重新上传。输入路径会交给本机 Executa 读取，只应在受信任的本地开发环境使用。

这个 Demo 不使用 `host/uploadFile mode=inline`。当前本地 Runtime 通过默认 64 KiB
`asyncio` 行读取器接收 Executa stdout，普通图片编码成 Base64 后会超过该限制；
预签名上传流程只在 stdout 中传递 URL、对象 key 和其他控制信息。

## 要验证的问题

- Session 模型是否直接看见多张图片。
- `detail: high` 是否正常工作。
- 非视觉模型是否明确返回 `APP_MODEL_NOT_VISION_CAPABLE`。
- 相比 `upload_local_file → analyze_image`，响应时间和视觉判断是否改善。
