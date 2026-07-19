# ppt-engine Binary 随包提供浏览器运行时

`ppt-engine` 的每个受支持平台 Anna Binary 分发包都必须包含版本固定且可用的浏览器运行时，目标机器不需要预装 Chrome，首次运行也不依赖联网下载。环境变量指定的浏览器和系统 Chrome 只作为显式覆盖或开发兼容能力；选择随包分发是为了让离线部署、渲染结果和故障定位保持确定性，代价是各平台分发包体积明显增加。

`ppt-engine` 暂停发布 `linux-aarch64` 二进制，因为 Chrome for Testing 没有对应的原生浏览器产物；当前受支持的 Binary 平台是 `darwin-x86_64`、`darwin-arm64`、`windows-x86_64` 和 `linux-x86_64`。这个范围调整只适用于 `ppt-engine`，不改变其他 Executa 的发布平台。

受支持平台统一随包提供与固定 Puppeteer 版本匹配的完整 Chrome for Testing，暂不使用体积更小的 Chrome Headless Shell。完整 Chrome 优先是为了保持当前新版 headless 渲染语义以及 CSS、SVG、字体测量、截图和 HTML 到 PPTX Model 转换的一致性；只有在真实 Deck 的视觉与转换回归通过后，才考虑切换到 Headless Shell。

Chrome for Testing 作为 Anna Binary archive 中与 `bin/ppt-engine` 并列的 `lib/browser/` 运行时资源分发，不进入 SEA blob。这样由 Anna Binary 安装过程完成一次解压，避免增加启动成本和临时目录磁盘占用。

运行时使用 Node `isSea()` 区分 Binary 模式与源码模式，并在 Binary 模式下通过 `process.execPath` 定位相邻的 `lib/browser`，不能使用 `lib/app` 内部模块路径定位分发资源。显式 launch 参数或浏览器路径环境变量可以覆盖默认选择；没有显式覆盖时，Binary 模式必须使用随包浏览器，缺失或启动失败应直接报告分发包损坏或运行环境不兼容，不得隐式回退到系统 Chrome 或用户 Puppeteer 缓存；源码模式继续允许这些本地回退。

浏览器版本由 `package.json` 中精确固定的 Puppeteer 版本拥有，构建流程从该 Puppeteer 包的 Chrome revision 派生 Chrome for Testing 版本，不另设一份手写浏览器版本。构建产物必须记录浏览器类型、版本、平台架构、相对入口、入口 SHA-256 和对应 Puppeteer 版本；升级 Puppeteer 必须在同一次 engine 发布中更新随包浏览器并通过真实渲染回归。

Chrome for Testing 不提交到仓库，也不要求运行时下载；Binary 平台构建 job 的 `npm ci` 跳过 Puppeteer 隐式下载，随后使用已安装的 Puppeteer 浏览器工具从官方源显式下载固定 revision，并把下载缓存作为可丢弃的构建加速层。第一版不建设自有浏览器镜像；构建需要网络，最终 Binary 运行必须离线可用。

每个受支持平台的发布门禁必须从最终 archive 启动 Binary：验证外置 `lib/app`、浏览器元数据和版本，并发运行多个插件进程，并通过 JSON-RPC 对仓库内固定、无网络、单页的 Binary smoke fixture 真实调用 `buildDeckHtmlFromManifest` 和 `convertDeckHtmlToPptxModel`。测试应验证静态 Deck HTML、非空且具有正确尺寸和基本像素差异的 PNG，以及单页 PPTX Model；不使用容易受跨平台字体抗锯齿影响的像素级截图快照。

`linux-x86_64` 的支持基线是 Ubuntu 22.04 兼容的 glibc Linux：分发包提供 Chrome for Testing，但不捆绑 glibc、NSS、GTK、GBM 等操作系统动态库，也不支持 Alpine/musl 或缺少 Chrome 基础运行库的极简镜像。Linux 发布门禁必须在该基线环境完成真实渲染，文档应列出必要系统库，并在依赖缺失时提供明确诊断。

Binary 启动和 `describe` 不启动 Chrome；只有真正依赖浏览器的工具进入统一浏览器启动路径时，才按需读取随包元数据、验证入口并启动内置 Chrome。浏览器故障不得阻止不依赖浏览器的 workspace 工具，浏览器实例继续按任务创建和关闭，不作为插件进程级长期共享资源。

Chrome 入口 SHA-256 用于构建和最终 archive 发布校验，不在每次渲染前重新读取大型浏览器文件计算哈希。运行时只验证元数据格式、平台匹配、相对路径边界、入口存在性和 POSIX 可执行权限，浏览器文件的运行时损坏通过明确的启动错误报告。
