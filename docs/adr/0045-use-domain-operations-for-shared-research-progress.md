---
status: accepted
---

# 使用领域操作增量更新共享研究进度

Shared Research Progress（共享研究进度）由 `ppt-engine` 持有合并语义；PPT App 不再通过工具调用反复发送完整检查点，而是发送以研究阶段、搜索词、候选图片和分析批次等稳定身份为目标的领域操作，由引擎读取当前检查点、合并并原子写回。写入工具只返回有界的确认结果，不返回完整进度。

增量协议使用固定的领域操作集合，并以 `query`、`candidate_id`、`batch_id` 等稳定身份执行 set 或 upsert。协议不接受任意 JSON path，也不允许用通用操作替换整个 Web 或图片研究 section；每种操作只能修改其明确拥有的字段。

同一次请求中的领域操作构成一个原子批次。引擎先在内存副本中按顺序应用并验证全部操作，任意操作失败时不写入任何部分结果；只有最终状态整体合法时才以一次原子文件替换发布新检查点。

同一 Workspace 的研究进度 patch 在 `ppt-engine` 内按 Workspace 串行执行，每一批都基于锁内重新读取的最新检查点合并，避免并发分析或导入覆盖彼此的更新。每次成功变更递增检查点的单调 `revision` 并在有界确认响应中返回；调用方不提交 `expected_revision`，阶段陈旧或回退由领域状态迁移校验拒绝。

所有领域操作必须幂等并可安全重试，集合增长使用稳定键 upsert 或确定性去重合并而不提供非幂等 append。整批操作应用后若有效状态没有变化，引擎返回 `updated: false`，不写文件、不修改 `updated_at`、不递增 `revision`；只有实际状态变化才原子写入并推进 revision。

单次 patch 的序列化 `args` 上限为 32 KiB，不通过 Host Upload 放大 patch。调用方以完整领域操作为不可拆分单元，保持顺序按实际 UTF-8 字节数自动装箱；单个操作超限即报错。阶段完成是独立的最终屏障，只能在所有数据批次成功后提交，因此中断恢复可重新 upsert 已完成条目并补齐缺失条目。

图片去重条目将对应 group 与 candidate 作为同一领域操作，图片分析以一个分析批次及其候选判断为操作，图片导入以单个 candidate 为操作。大型 `prepared_batch` 不从前端整体提交；`finalize_image_research` 根据已持久化候选、去重统计和导入结果在引擎内派生它。

正式研究证据由引擎从 checkpoint 发布，而不是由前端再次提交完整 `prepared_batch`。引擎先幂等写入 `web-summary.md` 或 `image-catalog.json`，再在同一 Workspace 锁内标记对应的 `written`；崩溃后的重试依赖正式证据写入的幂等性恢复。

研究进度 patch 或正式研究证据发布失败时，本轮生成立即中断并保持可恢复，不允许带着未持久化状态继续 Page Authoring（页面创作）。本次改造保留现有 v2 checkpoint 的协议兼容，但不把实际恢复或修改既有失败任务空间作为交付要求；回归验证使用同构的大检查点与 5 query × 6 result 场景。

旧的 `app_record_shared_research_progress` 全量写入工具不保留协议兼容入口，改由 `app_patch_shared_research_progress` 及独立的 Web/Image 发布工具取代。现有磁盘上的 v2 checkpoint 仍可恢复，但旧前端 bundle 不再作为新 Executa 的支持协议。

Patch operations 以严格的判别联合公开，每种 `op` 拥有明确的字段和稳定身份；前端类型、后端校验和 Executa manifest 表达同一协议。未知操作、未知字段或缺失字段使整个原子批次失败，公开接口不接受通用 `Record<string, unknown>` patch。

Checkpoint 生命周期时间戳由 `ppt-engine` 生成和保留；前端不提交 `updated_at`、`started_at` 或 `completed_at`。幂等重试保留既有时间，只有有效状态变化才更新根级 `updated_at`；外部研究来源自身的业务时间不属于该生命周期规则。

恢复读取仍由 `prepareSharedResearchWorkspace` 和 `getSharedResearchContext` 提供完整研究进度；当完整 JSON-RPC 响应序列化后的 UTF-8 大小超过 48 KiB 时，这两个入口使用现有 Host Upload JSON reference（JSON 引用）返回，低于阈值时继续内联。48 KiB 为相对 bridge 65,536 字节行限制保留封装和增长余量的保守阈值。

检查点继续使用 `schema_version: 2`；新增的 `revision` 是兼容字段，旧文件缺失时按 0 读取，首次实际 patch 后写为 1。`prepareSharedResearchWorkspace({ reset_progress: true })` 创建 revision 0 的默认检查点，因此现有 v2 中断运行无需迁移即可恢复。

阶段状态使用单向迁移：`waiting` 可进入 `running` 或 `skipped`，`running` 可保持运行或进入 `completed`、`warning`、`skipped`，三个终态只能幂等地重复设置自身；任何终态回退或互相转换都被拒绝。重新开始研究轮次只能使用 `reset_progress: true`。

阶段完成屏障除状态迁移外还必须验证领域前置条件，包括决策 query 与搜索记录完整对应、去重 occurrence/group/candidate 和统计一致、分析批次与候选判断齐全，以及所选候选的导入结果完备。前置条件不满足时整批拒绝；存在技术失败时使用 `warning`，不得伪装为 `completed`。

根级 checkpoint 状态不接受前端直接设置。任一阶段首次进入 `running` 时引擎将根状态置为 `running`；`finalize_shared_research` 在所有阶段终态、正式研究证据已发布且前置条件满足后，依据 warning、是否需要新增研究等事实派生 `completed`、`warning` 或 `skipped`。重复 finalize 为幂等 no-op。

损坏或不兼容的 checkpoint（无法解析、schema 不是 2、revision 非法或研究结构不一致）使 patch 和 resume 严格失败；引擎不自动修复、不静默创建默认状态。只有显式 `reset_progress: true` 才能替换该轮次进度，正式累积的研究证据不因此清理。

不采用通用 JSON Merge Patch，因为搜索、候选和分析批次主要存储在数组中，通用数组替换语义容易覆盖无关条目，也无法表达按 `query`、`candidate_id` 或 `batch_id` 更新的领域不变量。不以 Host Upload 传输完整检查点作为常规路径，因为该进度是高频、本地、用于恢复的控制状态；外部上传只可作为未来大载荷操作的独立兜底，而不是默认持久化协议。
