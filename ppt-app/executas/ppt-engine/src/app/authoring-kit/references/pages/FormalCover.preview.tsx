import React from "react";

import FormalCoverReference from "./FormalCover.tsx";

export default function FormalCoverPreview() {
  return (
    <FormalCoverReference
      eyebrow="FORMAL REPORT · 示例结构"
      title="示例经营复盘汇报"
      subtitle="用一页识别主题、周期与汇报身份，再进入后续分析。"
      period="2026 H1 · 示例周期"
      presenter="示例汇报人"
      organization="示例组织"
      date="YYYY.MM.DD"
      classification="示意内容，不代表当前 Workspace 事实"
    />
  );
}
