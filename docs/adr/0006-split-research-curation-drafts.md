# 拆分 Research Curation Draft 并由代码合并最终 Research Evidence

Research Curation 从 Raw Research Material 中筛选事实证据和视觉素材，但 web 事实判断与图片可用性判断是不同任务。决定将单个 Research Curation agent 拆为 Web Research Curation Draft 和 Visual Research Curation Draft 两类中间产物；agent 只写各自 draft，最终 Research Evidence 由代码确定性合并写入。这样牺牲一部分生成速度和实现简单性，换取事实证据、视觉资产和最终 evidence 写入边界更清晰，并避免多个 agent 竞争修改同一个 `evidence-index.json`。

**考虑过的方案**

- 继续由单个 agent 直接写最终 Research Evidence。拒绝，因为事实筛选和图片筛选混在同一 prompt 中，容易让图片中的文字、图表或 claim 被误当作事实证据，也让图片分析被事实摘要任务稀释。
- 让 web agent 和 visual agent 分别 patch 最终 `evidence-index.json`。拒绝，因为两个 agent 会竞争同一个最终聚合文件，容易出现覆盖、状态冲突和恢复语义不清。
- 让两个 agent 分别写 draft，再由代码合并最终 Research Evidence。选择这个方案，因为 draft 文件互相隔离，代码拥有最终 page evidence 状态、gap 合并、当前页覆盖和 markdown/index 写入的所有权。
