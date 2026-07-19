# ppt-engine SEA 只加载外置应用运行时

`ppt-engine` Anna Binary 的 SEA 只包含 Node.js runtime 和最小启动器，完整应用运行时原样安装到 archive 的 `lib/app/`。启动器通过 `process.execPath` 定位 Binary 分发根目录，验证 `lib/app/example_plugin.js`、`package.json` 和 Executa tool manifest 存在后直接动态导入插件入口，不再把 `dist`、`node_modules`、模板和其他资源作为 SEA assets 内嵌，也不再在首次启动时创建版本化应用解包缓存。

第一阶段保持 `lib/app/` 内部目录结构与旧 SEA 解包结果一致，包括完整的 `dist` 和经过原有过滤规则处理的 `node_modules`。这样 Page Source 编译、TypeScript 类型解析、Puppeteer 动态导入、Sharp 原生模块、`pptx-svg` WASM 和模板资源仍使用原有文件系统语义；本阶段不裁剪依赖、不移动静态资源，也不改变 `lib/browser/`。

选择这一方案是因为旧实现首次启动需要释放并校验约一万个文件，冷启动成本明显高于应用正常加载。Anna Binary 安装过程已经负责解压最终 archive，继续在 SEA 进程内二次解包会重复占用磁盘空间，并让临时目录清理、bundle 版本变化和缓存损坏重新触发冷启动。外置 `lib/app/` 把应用安装成本收敛到 Binary 安装阶段，同时让每次进程启动直接复用已安装文件。

最终 archive 校验必须确认 `lib/app/` 的插件入口、package manifest、tool manifest、`dist/index.js` 和 `node_modules/` 存在，且外置 tool manifest 的 `display_name` 与 `version` 和发布来源一致。Binary smoke test 必须从最终 archive 启动多个并发 `describe` 进程，确认旧 SEA 缓存环境变量不会导致创建解包缓存，并继续完成使用随包 Chrome 的真实 Deck HTML、PNG 和 PPTX Model 转换。

后续如果将 Authoring Kit、模板预览或其他只读资源移动到 `data/`，或者裁剪 `node_modules`，必须作为独立变更处理，并增加对应的最终 archive 功能门禁；本 ADR 不授权改变这些运行时资源的内部结构。
