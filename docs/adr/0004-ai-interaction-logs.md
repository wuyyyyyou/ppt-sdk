# 分离语义日志和 AI 原始交互日志

PPT 工作区需要能排查所有 LLM completion 和 Agent session run,包括 retry、repair、取消、中断和 session 基础设施失败。为此采用按业务域分 channel 的日志结构,保留现有大纲、page plan、page agent、agent stream 等语义日志文件,同时为大纲、page plan、page agent 新增对应的 `*-interactions` 原始交互日志文件;语义日志只保存业务阶段、状态、页面信息、解析摘要和 `operation_id` / `interaction_id` 引用,完整 request/prompt/response/output 写入原始交互日志。相比单一大日志或 raw-only 日志,这个方案既保留按业务块查日志的便利,又避免高层日志和原始 payload 互相污染;底层 interaction 采用 started/finished 追加记录,保证进程退出或流式卡死时仍能追踪已发送的 prompt。日志写入是 best-effort,不阻断生成链路;新日志 entry 带 schema version,超大 payload 由 engine 写入 sidecar 并在日志中保留引用、大小和 hash,旧 workspace 日志不迁移。
