# Issue 05: Manifest Render Plan Module

Status: ready-for-agent
Type: AFK

## What to build

将 manifest 到 Deck 输出的纯解析部分抽成一个内部 Render Plan Module。

这个 Module 负责把 manifest、Template、slide data、theme、local runtime 需求、输出命名和 single-page 选择解析成可执行计划，但不负责启动浏览器、不负责写文件。Deck HTML、单页预览截图和整套截图的适配器继续保留现有对外 API，只是改为消费同一份 Render Plan。

## Acceptance criteria

- [ ] manifest 可以在不启动浏览器、也不写输出文件的情况下被解析成 Render Plan。
- [ ] Render Plan 覆盖完整 manifest，而不是为 single-page 单独生成另一种语义。
- [ ] Render Plan 包含 slide HTML、输出命名、输出路径、theme 归一化结果、local runtime bundle 结果和单页选择信息。
- [ ] Deck HTML 构建、单页预览截图和整套截图仍然可用，输出文件名、输出路径和返回摘要保持兼容。
- [ ] 为 Render Plan 增加测试，至少覆盖 builtin slide、local slide、single page、theme 归一化、data_path 读取和非法 manifest。

## Blocked by

- Issue 04

