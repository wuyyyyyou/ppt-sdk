---
status: accepted
---

# 记录 Anna Web API 交互

PPT App 对 `anna.web.search`、`anna.web.fetch`、`anna.web.image_search` 和 `anna.web.image_fetch` 的每次实际调用，都写入 Workspace-owned、append-only（只追加）的 Research Web Interaction Log。四个方法共用一份按时间排列的日志，并与 AI Interaction Log 分离；每次进入线性共享研究流程创建一个诊断用 `operation_id`，同一次尝试中的调用共享它，每个请求拥有独立的 `interaction_id`，恢复执行创建新的 `operation_id`，但不引入研究业务 `run_id`、批次目录或新的恢复状态。

每次调用在请求 Anna Runtime 前先追加 `started`，正常返回给调用方后追加 `succeeded`，抛错时追加 `failed`。日志完整保存调用方输入、应用默认值后的 Runtime 请求与选项、Runtime 原始响应、宽松规范化后的响应、稳定诊断摘要、时间与耗时；失败还完整保存错误栈、`cause` 和自定义字段。Runtime 返回且现有宽松规范化完成即视为交互成功，即使结果为空、部分页面失败或结构异常被容错；被容错的结构问题另记 `normalization_warnings`，不收紧响应契约，不改变 Research Evidence Gap、warning 或非阻塞生成语义。

这些 API 交互的原始值按敏感诊断材料原样落盘，包括网页正文、普通或签名 URL、错误对象和 `image_fetch.get_url`，不做脱敏或字段删减；较大载荷沿用 Workspace Log sidecar。日志与 Workspace 同生命周期保留，不轮转、不覆盖，Generation Abandonment 也不删除已经归入正式 Workspace 的记录，并随 Workspace Diagnostic Bundle 收集。因此问题排查包继续按包含原始资料与可用访问引用的敏感文件管理，不应分享给无关人员。

日志写入采用 best-effort：任何 `started`、`succeeded` 或 `failed` 记录写入失败都不得阻止 API 调用、改变其返回或异常、触发 API 重试，或延长研究恢复路径。本决策不改变现有超时、并发度、官方 Web API 无自动重试、无旧 Executa 回退和用户界面；悬空的 `started` 只表示请求结果未知或结束日志未写入，不能单独证明 Anna API 卡死。

`image_fetch` 成功后的 APS 图片下载与 Host Upload 仍属于 Workspace Storage Transfer Log。它们分别拥有独立的 `transfer_id`，共享研究尝试的 `operation_id`，并以 `parent_interaction_id` 指向对应的 `image_fetch` interaction；Storage Transfer Log 继续遵守 ADR-0038 的既有脱敏规则，不复制 Research Web Interaction Log 的原始响应。

**考虑过的方案**

- 复用 `ai-research-interactions.jsonl`。放弃，因为 Anna Web API 调用既不是 LLM completion，也不是 Agent run，混用会破坏 AI Interaction Log 的既有语义。
- 只记录摘要或失败。放弃，因为无法区分正常空结果、Host 协议变化、Runtime bridge 异常和 App 规范化行为。
- 同时收紧响应校验或新增重试。放弃，因为本次目标是增强可观测性；研究链路应继续优先完成用户的 PPT，而不是因外部资料异常增加阻塞或等待时间。
