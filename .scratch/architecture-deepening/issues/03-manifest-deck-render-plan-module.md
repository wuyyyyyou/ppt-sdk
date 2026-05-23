# Issue 03: 深化 Manifest Deck Render Plan Module

Status: ready-for-agent
Type: AFK

## What to build

将 manifest 到 Deck 输出的渲染链路拆出一个纯粹的 Render Plan Module。该 Module 负责把 manifest、Template、slide data、theme 和输出命名解析为可执行计划；浏览器启动、截图写入、Deck HTML 写入和 rendered validation 则通过 Adapter 消费这个计划。

完成后，构建 Deck HTML、生成单页预览截图、生成整套截图、rendered validation 都应复用同一套 manifest 解析和浏览器运行基础能力，避免 Chrome 查找、render-ready 等逻辑在不同 Implementation 中重复。

## Acceptance criteria

- [ ] Manifest 到 Render Plan 的解析可以不启动浏览器、不写输出文件而单独测试。
- [ ] Deck HTML 构建、单页截图、整套截图仍然可用，输出文件名、输出路径和返回摘要保持兼容。
- [ ] rendered validation 复用共享的浏览器启动或 render-ready 能力，不再维护一份相似的 Chrome 查找逻辑。
- [ ] 为 Render Plan 增加测试，至少覆盖 builtin slide、local slide、single page、theme 归一化、data path 读取和非法 manifest。
- [ ] 相关命名使用项目术语：Template、Deck、Page、Manifest、Render Plan、rendered validation。

## Blocked by

None - can start immediately

## Comments

来源：架构分析候选 3。当前摩擦点是 manifest 渲染 Module 的 Interface 看似简单，但 Implementation 混合了纯解析、浏览器执行和文件输出，测试 Seam 不够清晰。
