# PRD: Manifest Deck Render Plan Module

Status: ready-for-agent
Parent: Issue 03 - 深化 Manifest Deck Render Plan Module

## Problem Statement

当前 manifest 到 Deck 输出的链路把两类事情混在了一起。

一类是纯解析：读取 manifest、解析 Template、处理 slide data、归一化 theme、计算输出命名、处理 single-page 选择。
另一类是执行：启动浏览器、等待页面 ready、写 Deck HTML、写单页或整套截图、以及把 rendered validation 跑起来。

这些职责现在分散在多个实现里，导致同一种 manifest 解析逻辑在不同入口重复出现，Chrome 查找和 render-ready 等待也各自维护一份。结果是：

- 纯解析很难单独测试。
- Deck HTML、单页预览、整套截图和 rendered validation 的行为容易漂移。
- 新增或修改 manifest 规则时，需要在多个地方同步改动。
- 输出兼容性和术语一致性没有一个清晰的权威模块。

这个 PRD 要解决的问题，是把 manifest 到 Deck 输出的这一层整理成一个可测试、可复用、纯度更高的 Render Plan Module。

## Solution

引入一个内部的 Render Plan Module，负责把 manifest、Template、slide data、theme、single-page 选择和输出命名解析成可执行计划。

这个计划本身不负责启动浏览器，也不负责写文件。它只描述“要渲染什么、怎么命名、输出到哪里、哪些 slide 需要执行、对应的 HTML 是什么”。

再引入一个共享的 browser runtime helper，集中处理 Chrome 查找、Puppeteer 启动、页面 ready 等待和通用浏览器生命周期。

现有对外能力保持兼容：

- 构建 Deck HTML
- 生成单页预览截图
- 生成整套截图
- rendered validation

这些能力继续作为 Adapter 存在，只是它们都消费同一份 Render Plan 和同一套 browser runtime helper。

## User Stories

1. 作为维护者，我想把 manifest 解析成独立的 Render Plan，以便我不启动浏览器也能验证解析结果。
2. 作为维护者，我想让 Render Plan 覆盖完整 manifest，而不是单页特例，以便 single-page 只是输出选择而不是另一条语义分支。
3. 作为维护者，我想在同一份计划里看到全部 slide 的解析结果，以便 Deck HTML、截图和 validation 复用同一套输入。
4. 作为维护者，我想在计划里看到每页的输出文件名和输出路径，以便输出命名规则只维护一处。
5. 作为维护者，我想在计划里看到归一化后的 theme，以便 builtin 和 local slide 的外观输入一致。
6. 作为维护者，我想在计划里看到 local runtime bundle 的需求和结果，以便 local slide 渲染不会在多个入口重复扫描。
7. 作为维护者，我想保留现有的 build 和 validation 导出能力，以便现有调用方无需迁移。
8. 作为维护者，我想 Deck HTML 写入、截图写入和 validation 仍然由 Adapter 负责，以便计划层保持纯净。
9. 作为维护者，我想共享 Chrome 查找逻辑，以便不同入口不会再维护三份浏览器发现代码。
10. 作为维护者，我想共享浏览器启动逻辑，以便 Puppeteer 参数和错误信息保持一致。
11. 作为维护者，我想共享 render-ready 等待逻辑，以便单页截图、整套截图和 validation 对 ready 状态的判断一致。
12. 作为维护者，我想让 rendered validation 复用同一套 browser runtime helper，以便它不再有独立的 Chrome 选择分支。
13. 作为维护者，我想让 manifest 解析可以独立测试，以便不依赖真实浏览器也能覆盖非法 manifest。
14. 作为维护者，我想让 builtin slide 的解析可以独立测试，以便 template group 和 layout 解析错误更容易定位。
15. 作为维护者，我想让 local slide 的解析可以独立测试，以便本地 TSX 引用和 group 解析更容易验证。
16. 作为维护者，我想让 theme 归一化可以独立测试，以便不同 theme 输入形式不会引入歧义。
17. 作为维护者，我想让 data_path 读取可以独立测试，以便数据文件错误能在计划阶段暴露。
18. 作为维护者，我想让非法 manifest 在计划阶段就失败，以便后续浏览器和写文件不会在脏输入上继续执行。
19. 作为维护者，我想让单页预览仍然保持当前输出格式，以便现有工作流和调用方不需要改动。
20. 作为维护者，我想让整套 Deck HTML、截图和 validation 的输出摘要保持兼容，以便外部工具还能继续消费结果。

## Implementation Decisions

- Render Plan Module 作为内部模块存在，不新增对外公共 API。
- Render Plan 包含完整 manifest 的解析结果，不为 single-page 单独生成另一种计划。
- Render Plan 包含已生成的 slide HTML。
- Render Plan 包含 local runtime bundle 的需求和结果，但不包含浏览器实例。
- Render Plan 包含输出命名、输出路径、deck title、slide 顺序和单页选择信息。
- 现有 build 和 validation 能力继续保留原导出和原返回结构，内部切换为消费 Render Plan。
- browser runtime helper 统一负责 Chrome 查找、Puppeteer 启动、默认启动参数和 render-ready 等待。
- rendered validation 复用共享 browser runtime helper，不再维护独立的 Chrome 查找和 ready 等待实现。
- Deck HTML 写入、单页预览截图、整套截图和 rendered validation 都作为 Adapter 消费同一份 Render Plan。
- 对非法 manifest、非法 slide source、非法 theme、非法 data_path 的处理都应在计划阶段失败，不进入浏览器阶段。
- local slide 与 builtin slide 的解析结果都应在计划阶段归一化到统一结构。
- 现有输出字段和命名尽量保持兼容，避免影响 app-workspace、task-state-machine 和 validation 的调用方。

## Testing Decisions

- 好测试只验证对外行为，不锁死内部实现细节。
- Render Plan 需要纯单测，覆盖不启动浏览器、不写文件的解析行为。
- Render Plan 单测至少覆盖 builtin slide、local slide、single page、theme 归一化、data_path 读取和非法 manifest。
- browser runtime helper 需要单测，覆盖 Chrome 查找、显式启动参数、默认启动参数和 render-ready 等待失败/超时。
- Deck HTML、单页截图、整套截图和 rendered validation 需要回归测试，确认它们仍然使用兼容的输出形状。
- rendered validation 的测试要确认它复用共享浏览器基础能力，而不是自己再维护一套不同的 ready 逻辑。
- 现有 validate 目录里的纯单测风格可以作为参考，尤其是对 mock page、mock element 和文件 fixture 的使用方式。
- 现有 manifest 相关测试风格可以作为参考，尤其是对 local template、data_path 和非法输入的覆盖方式。

## Out of Scope

- 不改 `presenton-pptx-generator` 的职责边界。
- 不改 HTML 到 PPTX model 的核心转换语义。
- 不改 task-state-machine 的状态语义。
- 不改前端 Workspace 页面交互。
- 不新增新的对外工具协议。
- 不做破坏性的输出文件名迁移。
- 不把浏览器实例或文件写入逻辑塞进 Render Plan。

## Further Notes

- 这个 PRD 的目标是把“manifest 渲染”拆成更深的内部模块，而不是把功能拆散。
- 术语上优先使用 Template、Deck、Page、Manifest、Render Plan、rendered validation。
- 计划层越纯，后续新增输出形态、预览模式或 validation 规则时越容易复用。
