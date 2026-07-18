# Deck Refinement 保留页面身份

Deck Refinement 是已生成 Deck 上的整套优化流程，不应退化为全量重新生成，也不应复用只面向目标页的 Page Refinement 语义。决定采用独立的 deck-level flow：先做 Deck Refinement Context Review 和 operation-based outline reconciliation，用 `page_id` 保留既有 Page Generation Unit 身份；保留页继续使用现有 `slides/<page_id>.tsx`，布局与表达变化由 Agent 在该 Page Source 上完成；新增页获得新身份并从 Page Source Bootstrap 初始化；删除页只从当前 Outline、根 Deck Manifest、Page Progress 和渲染引用中移除，不物理删除旧 Workspace 文件。恢复状态继续使用独立的 `deck-refinement` run kind，研究能力后续通过 Page Evidence Assignment 接入而不恢复 Page Plan。

**Considered Options**

- 全量重新生成整套 Deck。拒绝，因为会丢失 accepted 页面上的已有 TSX 修改、研究证据使用痕迹和用户已经认可的页面质量。
- 把整套优化实现成对所有页面的 Page Refinement。拒绝，因为它无法表达 context/output language、outline operation、增删页、Research Requirement 合并和 deck-level recovery。
- 直接复用不携带页面身份的 Outline 输出数组。拒绝，因为中间增删页后无法可靠区分 keep、update、add、delete。
- 为 Refinement 保留 Page Plan 或 blueprint。拒绝，因为现有 Page Source 已经是页面唯一权威实现，额外规划表会重新引入重复身份、路径和布局来源。
