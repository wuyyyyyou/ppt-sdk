# Deck Refinement 保留页面身份

Deck Refinement 是已生成 Deck 上的整套优化流程，不应退化为全量重新生成，也不应复用只面向目标页的 Page Refinement 语义。决定采用独立的 deck-level flow：先做 Deck Refinement Context Review 和 operation-based outline reconciliation，用 `page_id` 保留既有 Page Generation Unit 身份；保留页只把更新后的 title/outline 复制到 Page Plan，不改 `blueprint_id` / `blueprint_source`，布局变化交给 Agent 在现有 TSX 上完成；新增页才从 Template blueprint 初始化；删除页只从当前 outline、Page Plan、manifest、progress 和 render artifacts 中移除，不物理删除旧 workspace 文件；Research Requirements 增量合并；恢复状态使用独立的 `deck-refinement` run kind。这个方案牺牲了一部分实现简单性，换取已接受页面、文件路径、研究证据和恢复语义的稳定性。

**Considered Options**

- 全量重新生成整套 Deck。拒绝，因为会丢失 accepted 页面上的已有 TSX 修改、研究证据使用痕迹和用户已经认可的页面质量。
- 把整套优化实现成对所有页面的 Page Refinement。拒绝，因为它无法表达 context/output language、outline operation、增删页、Research Requirement 合并和 deck-level recovery。
- 直接复用现有 `reviseOutline` 输出数组。拒绝，因为数组没有 `page_id`，中间增删页后无法可靠区分 keep、update、add、delete。
- 对保留页自动更换 blueprint。拒绝，因为页面已经有可编辑 TSX，换 blueprint 会更接近覆盖重建；布局和表达调整应由 Agent 基于现有 TSX 完成。
