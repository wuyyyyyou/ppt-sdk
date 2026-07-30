---
status: accepted
---

# 使用 Anna Host Web API 执行线性共享研究

PPT App 重新启用 Web 和图片研究时，不再恢复基于 `anna-search` Executa、迭代 Research Discovery、Research Curation Draft 和 Page Evidence Assignment 的旧链路。新的研究流程直接使用 Anna Host 提供的 `anna.web.search`、`anna.web.fetch`、`anna.web.image_search` 和 `anna.web.image_fetch`，在逐页创作前按 Web 后图片的顺序执行一次 deck 级线性研究，并将整理结果作为 Shared Research Evidence（共享研究证据）提供给所有页面。这个决定用更少的 Session、LLM 往返和中间工件换取显著更短、也更容易恢复的生成路径；它取代 ADR-0006 和 ADR-0011，并取代 ADR-0009 中针对 Research Curation Draft 的重试规则以及 ADR-0018 中“用户可达生成流程继续移除研究阶段”的临时范围决定。

官方 Web API 由 PPT App 中独立的 `ResearchWebClient` 边界调用，不再放入只负责 `ppt-engine` 的 `PptBackend`，也不再保留 `anna-search` 的 bundled handle、工具 ID、manifest 同步、adapter、构建、测试或发布路径。搜索授权和失败仍由 Host API 契约控制；App 不持有供应商密钥，不提供旧 Executa 回退，也不为本地开发阶段保留旧 Workspace 或旧研究 schema 的迁移兼容。

每次首次生成、Page Refinement 或存在实际重创作目标的 Deck Refinement 都在本轮最终大纲和艺术指导准备完成后、Page Authoring 开始前执行相同流程。Deck Refinement 的 `no_op` 结果不启动研究。Web 需求判断读取完整用户 Brief、本轮优化要求、Confirmed Outline、Workspace Style Guide 和既有 Web 总结；需要时一次返回有限数量的 query，图片目录不进入 Web 判断、抓取选择或总结上下文。App 并行搜索，直接 LLM 从编号结果中选择有限数量的页面，App 批量抓取，再由直接 LLM 将搜索摘要和成功正文整理成纯 Markdown。Web 完成后，图片需求判断读取完整上下文、最新 Web 总结和精简后的可复用本地图片目录，生成简短英文图片 query。App 先按规范化原图 URL 合并搜索结果，再对所有 URL 唯一候选调用 `anna.web.image_fetch` 预取到 APS；预取失败只过滤对应候选。成功工件按 `sha256` 再次去重并合并匹配 query，每个内容唯一的代表候选才进入最多六张一组的 Agent Session。Session 附件使用根据持久化 `aps_path` 即时签发的短时效 APS URL，不直接使用搜索结果的源站 URL，也不持久化 `get_url`。Session 只判断每个候选的 `use_in_ppt`、描述和原因。所有非视觉研究步骤使用直接 LLM，图片 Session 是唯一依赖多模态 Session 的研究步骤。

正式研究工件固定为 append-only（只追加）的 `research/evidence/web-summary.md`、物化的 `research/evidence/image-catalog.json` 可用图片资产目录，以及只保存最终可用图片的 `research/evidence/images/`。App 负责组装和写入最终工件；LLM 和图片 Session 不直接重写完整文件。图片目录只保留 `use_in_ppt: true`、已由 `ppt-engine` 从 APS 导入影子 Workspace、同时具有本地 `file_path`、内容 `sha256` 和文件元数据的图片；目录包含描述、选择理由、匹配 query 和来源 URL，但不包含未入选候选、搜索结果、APS path、缩略图 URL、预取/分析/导入状态、去重过程、缺口或统计。研究图片导入不再经过浏览器下载和 Host Upload；App 只把持久化 `aps_path`、MIME、大小和 SHA-256 交给 `ppt-engine`，Executa 通过 `aps.files` 签发下载地址、流式下载到 staging、复验大小、SHA-256 和图片可解析性后写入 Workspace。跨轮次写入按 `sha256` 合并，Page Authoring 从 deck 级可用资产中自行判断相关性，不预先分配页面范围。最终 Web 总结不强制事实 ID、来源 ID、URL 列表或逐条引用；原始响应、完整候选、视觉判断、技术错误和中间统计只属于 Research Log（研究日志）与当前轮次研究进度诊断。

研究在每次生成或优化的影子 Workspace 中运行，并用单一的 `research/web-image-search-progress.json` 原子覆盖记录线性阶段、query、原始搜索结果、URL 去重、候选预取状态与 APS 元数据、SHA-256 内容去重、图片 Session 视觉判断、Workspace 导入和最终写入检查点。`get_url` 不进入该文件；恢复和每批分析都根据 `aps_path` 重新获得短时效地址。它不建立研究专用 `run_id`、批次 ID 或 `.runs/<run_id>/` 层级；影子 Workspace 已提供运行隔离。恢复只继续未完成步骤，最终写入前把待追加 Web 内容和待合并图片资产保存在进度文件中；Web 总结通过与正式文件末尾的完全匹配避免重复追加，图片目录通过 `sha256` 合并保证幂等。停止并放弃时研究结果随整个影子 Workspace 丢弃；未入选的预取图片仍由 APS 平台生命周期和用户配额管理。图片目录中的 `file_path` 始终保存当前 Workspace 内已导入图片的绝对路径，Page Authoring 必须原样用于 TSX 图片引用。Shadow Preparation 和 Generation Commit 通过既有的全量文本路径 rebase 分别在正式与影子 Workspace 根路径之间重写该字段及其下游 TSX 引用。

Web 与图片搜索开关只禁止对应方向的新增外部搜索，不禁止另一方向，也不禁止复用已有 Shared Research Evidence。判断不需要搜索时仍写入 `skipped` 批次；权限、限流、供应商、单页抓取、图片预取或导入失败记录为 gap 或 warning，但不阻塞 Page Authoring。除完全无法解析结构化 JSON 时允许一次格式修复外，App 不为官方 Web API 增加自动重试，也不恢复旧的迭代查询。图片 Session 继续以六张为固定批次；一个附件或 Session 基础设施错误使该批整体失败，不进一步拆批或逐张退避。图片 Session 并发使用独立的全局设置，默认 5、范围 1～10；该设置不限制搜索、抓取、图片预取或工作区导入。`image_fetch` 交互继续按 ADR-0044 写入包含原始响应的 Research Web Interaction Log（研究 Web 交互日志）；APS 预取、Session URL 签发和 Workspace 导入另写入 Workspace Storage Transfer Log（工作区存储传输日志），后者遵守既有脱敏规则，不保存仍有效的签名 URL。Uploaded Source Analysis 本轮继续封存，不进入新研究输入或研究工件，未来重构时另行决策。

**考虑过的方案**

- 恢复 ADR-0011 的迭代 Research Discovery、Evidence Pool、Curation Draft 和 Page Evidence Assignment。放弃，因为多轮 Session、分页分配和中间工件造成不可接受的延迟，并且当前页面 Agent 可以直接从 deck 级已整理证据中判断相关性。
- 继续使用本地 `anna-search` Executa。放弃，因为 Anna Host 已提供正式 Web 与图片接口，继续维护两套搜索协议、manifest 和发布链路没有价值。
- 让每页按需搜索或把原始搜索结果直接交给 Page Authoring。放弃，因为会重复搜索、放大延迟，并让未整理的 Raw Research Material（原始研究材料）成为页面事实依据。
- 所有研究都使用 Agent Session。放弃，因为非视觉 Session 明显慢于直接 LLM；只有实际读取图片附件时才需要多模态 Session。
- 为每轮研究创建独立 `.runs/<run_id>/` 和页面适用范围。放弃，因为影子 Workspace 已隔离单次运行，单一进度文件足以恢复，而页面范围元数据会重新引入不需要的证据分配逻辑。

**结果**

- 新研究实现以生成速度、简单恢复和共享上下文为优先，不提供迭代补查或分页证据预分配。
- 页面首次创作和 no-change 重试读取正式研究文件；TypeScript/render-fix 和 Page Visual Review 修复只修当前页面，不重新引入研究或更换研究图片。
- 旧研究代码、工件、测试和文档引用可以在同一次本地开发迁移中直接删除或替换，Git 历史是旧实现的唯一兼容参考。
- 图片版权或许可审核不在本次 App 重构范围内；App 不根据 `license_hint` 增加额外业务状态或工作流。
