---
status: accepted
---

# 使用全局 Performance Run 进行内部性能测试

PPT App 使用显式启用的 Performance Testing（性能测试）能力记录内部测试人员实际执行的产品操作，不将其作为正式用户遥测、产品分析或 Workspace 诊断日志。测试入口由前端构建开关控制并放在 Settings（设置）中；每个 PPT 全局根目录最多有一个活动 Performance Run（性能测试运行），运行可以关联零个、一个或多个 Workspace，历史运行默认保留并由测试人员显式删除。

每次运行存放在全局 `performance-runs/<run_id>/`，其中 `run.json` 持有生命周期、数据完整性、初始环境和设置快照，append-only（只追加）的 `events.jsonl` 是唯一权威性能数据，`report.html` 是结束运行时由后端全量聚合事件生成的可重建产物；不维护 `summary.json`。运行中断后仍保持记录状态，直到测试人员继续、结束或放弃；结束时如果仍有活动操作，默认提示继续等待，也允许强制将未完成测量标记为 `interrupted`，但不停止被测产品任务。报告只呈现指标，不评分或判定通过失败，并区分运行终态、报告生成结果、被测业务结果和 Performance Data Integrity（性能数据完整性）。

采集采用前后端混合、后端统一持久化：App 自有按钮通过稳定标识和顶层监听记录 Button Interaction（按钮交互），`PptBackend` 装饰器统一记录后端往返，当前主线工作流在领域阶段显式记录 Performance Operation（性能操作）；现有 AI、Agent、研究、存储、渲染和导出计时点在活动运行中同步投影不含业务载荷的轻量性能事件，报告不读取 Workspace `.log`。Performance Run 包含多条 Performance Trace（性能链路），父子 Span 串联按钮、前端、后端和工作流阶段；需要后端继续链路的 app-facing tool 在原有 `args` 中接受可选、严格受限的 `performance_context`，不修改 JSON-RPC envelope，也不把性能字段写入 Workspace artifact。跨重启关联通过 `events.jsonl` 和既有业务标识恢复。

前后端记录器都使用有界非阻塞队列批量追加事件，埋点写入失败不得改变 PPT 业务结果；已知丢失、损坏或序列缺口使数据完整性变为 `degraded`，并在报告中明确展示。精确耗时由 Span 所属生产者使用单调时钟计算，跨生产者 ISO 时间只用于关联；自动重试保留为父操作下的独立 Performance Attempt（性能尝试），并行页面同时报告用户等待时长和累计工作时长，避免把并行子操作相加后冒充端到端耗时。

App 内查看报告时，`ppt-engine` 复用现有 Host Upload 传输本地 `report.html`，并按当前 Host Upload MIME 白名单使用 `text/plain`；前端获取文本后在独立报告页的无脚本沙箱 iframe 中通过 `srcDoc` 渲染。Host Upload URL 是短期传输状态，不写入运行记录；本地报告生成成功即表示 Performance Run 完成，后续报告上传失败只允许重试传输，不倒推运行失败。HTML 使用所有有效事件完成全量聚合，但不复制全部原始 JSONL，明细受文件大小上限约束并明确标注省略数量；报告语言取结束记录时的 App Locale（界面语言）并持久化以支持一致重生成。

第一阶段不引入 OpenTelemetry Collector、Sentry、PostHog 等大型第三方平台。事件与 Trace/Span 模型借鉴 OpenTelemetry（开放遥测），保留未来增加 Exporter（导出器）的空间，但本地 JSONL、静态报告和当前 Anna Runtime 边界保持自有轻量实现。
