# Export Artifact Mirror 使用异步发布任务

---
status: accepted
---

## 决策

PPTX/PDF Export Artifact Mirror（导出产物镜像）的发布拆分为两个公开 Executa：

- `app_start_export_artifact_publish`：创建或复用一个发布任务并立即返回任务回执；
- `app_get_export_artifact_publish_status`：读取任务状态，供前端轮询。

发布任务由 `ppt-engine` 后台 runner（后台执行器）完成快照、APS Files `upload_begin`、HTTP PUT 和 `upload_complete`，单次 invoke 不等待网络传输完成。任务回执持久化到 Workspace 的 `output/export-artifact-publish-<type>.json`，保存源文件的 `updated_at` 与 SHA-256，提交前后都校验源文件版本，避免把旧产物记录为当前镜像。

公开状态为 `idle`、`queued`、`preparing`、`uploading`、`committing`、`completed`、`failed`。同一 Workspace 和格式最多存在一个活动任务；重复启动返回现有活动任务，失败任务可以再次启动并获得新的 `job_id`。启动流程在引擎内串行化，避免并发 invoke 在读取旧状态后重复创建任务。

引擎进程重启后，查询发现持久化状态仍处于活动状态但当前进程没有对应 runner 时，将任务标记为 `failed`，并在错误中写入 `interrupted: true`。任务不从中间上传阶段恢复，由用户重新启动；已完成的镜像仍可直接复用。

前端导出页和下载动作都通过上述两个接口工作：启动或复用任务后轮询直到 `completed`/`failed`，离开并重新进入页面时先读取持久化状态并恢复轮询。发布过程中继续显示现有导出进度体验，不提供取消接口。

任务状态中的 `artifact` 只保存正式的 `AppExportArtifactInfo` 元数据，不保存临时快照路径、内容类型等 runner 内部字段；临时快照在任务结束后删除。

## 后果

- APS Files 上传不再占用单次 invoke 的超时预算，超时错误不会中断前端请求本身。
- 页面关闭、刷新或引擎重启不会丢失任务结果；重启中的上传会明确显示为中断失败，需要用户重试。
- 任务状态文件成为新的持久化边界，需要保持 schema 兼容和轻量内容，不能写入签名下载 URL 或文件字节。
- 当前不支持取消；用户只能等待任务完成/失败后重新启动。
