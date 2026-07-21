# 记录 Workspace Storage Transfer Log

PPT Workspace 需要排查 Host Upload、R2 对象确认和 APS Files 发布之间的传输问题。现有 AI Interaction Log 只能说明 Agent 或 LLM 的调用过程，不能可靠定位一次文件传输是在 negotiate、PUT、confirm、APS 发布还是结果写回阶段失败。因此新增独立的 Workspace Storage Transfer Log，作为 Workspace-owned 的诊断旁路。

## 决策

- 使用统一的 `.log/storage-transport.jsonl` 记录 Workspace 相关的 Host Upload、后端 Executa Host Upload 和 APS Files 操作。
- 每次实际传输拥有独立的 `transfer_id`，通过 `operation_id`、`interaction_id`、`page_id` 等已有上下文关联到业务操作；同一业务操作可以包含多个独立传输。
- Host Upload 和 APS Files 都记录阶段级生命周期事件，并在每个阶段完成或失败后立即追加日志，而不是只保存最终结果。
- 前端 App Host Upload 通过 `app_append_workspace_log` 写入；已经持有 Workspace 路径的 engine/Executa 后端直接使用同一套 Workspace append 逻辑写入。
- `upload_local_file` 的普通工具活动继续归属于 Agent session 日志，不在 storage 日志中重复记录；本决策不修改 Agent session 日志协议。
- 日志写入采用 best-effort。日志写入失败不得改变上传、渲染、APS 发布或生成主流程的结果。
- 保存完整原始响应以避免遗漏未知诊断字段，但写入 Workspace 前对已知 bearer URL、签名和 token 字段做确定性脱敏。完整保留 `r2_key`、`invoke_id`、`operation_id`、`interaction_id` 等关联标识；不保存文件内容。
- 新日志属于 Workspace 内容，会随 Workspace Diagnostic Bundle 一并收集；旧 Workspace 不迁移。

## 传输边界

Host Upload 至少记录 `started`、`negotiate`、`put`、`confirm`、`finished` 和 `failed` 阶段。APS Files 至少记录发布开始、上传/提交、完成和失败阶段。每条事件包含传输标识、来源、transport、phase、status、文件元数据、关联上下文和必要的原始响应/错误信息。

本 ADR 只定义观测和日志边界，不改变现有并发度、错误分类、页面 `render-fix` 行为、Agent 重试策略或 Host/APS 服务端行为。发现真实故障来源后，另行设计行为修复。

## 后果

统一传输日志可以把前端、后端和 APS Files 的阶段串起来，并让 `r2_key` 与 `invoke_id` 的归属问题具备 Workspace 内的证据。日志会增加少量本地追加写入和日志体积，但不把文件字节放入 JSONL；presigned URL 和 token 即使出现在原始响应中，也不会以可复用形式进入 Workspace。
