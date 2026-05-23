# Issue 04: 共享浏览器运行时 Helper

Status: ready-for-agent
Type: AFK

## What to build

将浏览器查找、Puppeteer 启动参数、显式 executablePath / channel 处理，以及 render-ready 等待逻辑收敛到一个共享的内部 Helper。

第一阶段先把 `html-to-pptx-model` 的浏览器执行路径切到这个 Helper，保留现有对外 API 和返回结构不变。这样可以先验证共享运行时边界是可行的，再让后续的 Deck 输出和 rendered validation 复用同一套基础能力。

## Acceptance criteria

- [ ] Chrome 查找、浏览器启动和 render-ready 等待只保留一份权威实现。
- [ ] `html-to-pptx-model` 继续可用，但不再维护自己的浏览器查找和 ready 等待逻辑。
- [ ] 共享 Helper 对显式启动参数、系统 Chrome、环境变量 Chrome 和默认 Puppeteer 启动都能正确处理。
- [ ] render-ready 的成功、error 和 timeout 行为保持兼容。
- [ ] 为共享 Helper 增加测试，覆盖至少一个成功路径和一个失败路径。

## Blocked by

None - can start immediately

