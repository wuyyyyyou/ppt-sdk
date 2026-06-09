# presenton-template-engine 采用 ESM-only 产物

`presenton-template-engine` 在本仓库中按内部 Anna Executa 工具包维护，不作为公开的 CommonJS 兼容 npm SDK。它的 runtime/SDK 产物面向 Node 20+ 采用 ESM-only 构建和导出，移除 CommonJS `require` 包契约；非导出的 CommonJS 文件只保留在 Node SEA bootstrap 这类启动胶水场景中。这样可以避免 ESM/CJS 双产物的长期维护成本和构建 warning 噪音，同时让支持的模块边界更明确。

**考虑过的方案**

- 保留 ESM/CJS 双产物并静默 `import.meta` warning。拒绝，因为这会继续保留项目不再需要的兼容承诺。
- 保留 ESM/CJS 双产物并通过 shim 消除 warning。拒绝，因为 warning 虽然消失，但双模块维护面仍然存在。
- 采用 ESM-only 产物。选择这个方案，因为该包是内部工具包，运行目标是 Node 20+，主插件路径也已经消费 ESM 构建产物。
