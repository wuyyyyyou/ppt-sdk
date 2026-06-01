# Sources

这些笔记来自 2026-06-01 使用 Chrome DevTools MCP 阅读 staging Anna Developer Hub 页面所得。

## 主要页面

- Persistent Storage (APS): <https://staging.anna.partners/developers/tools/executa-storage>
- Lifecycle & Capability Negotiation: <https://staging.anna.partners/developers/tools/executa-lifecycle>
- Protocol Specification: <https://staging.anna.partners/developers/tools/executa-protocol>
- Host Upload: <https://staging.anna.partners/developers/tools/executa-host-upload>
- Host API upload.* reference: <https://staging.anna.partners/developers/reference/host-api-upload>
- Host API storage.* reference: <https://staging.anna.partners/developers/reference/host-api-storage>
- Host API files.* reference: <https://staging.anna.partners/developers/reference/host-api-files>

## 本仓库相关约束

- `AGENTS.md`
- `CONTEXT.md`
- `ppt-app/README.md`
- `presenton-template-engine/README.md`
- `presenton-pptx-generator/README.md`

## 注意

Staging 文档可能先于本仓库依赖版本。落地实现时：

1. 以当前 `ppt-app` 使用的 `@anna-ai/cli` / runtime SDK 实际方法名为准。
2. 以真实 Anna server / matrix-nexus 的当前 schema 校验为准。
3. 如果 staging 文档与本仓库 adapter 不一致，先在 adapter 层做兼容，不要把差异泄漏到 React 页面组件。
