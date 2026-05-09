import React from "react";

import StableInlineRow from "./StableInlineRow.js";

type KpiMetricItemProps = {
  value: string;
  label: string;
};

const KPI_ROW_HEIGHT = 24;

const KpiMetricItem = ({ value, label }: KpiMetricItemProps) => (
  <StableInlineRow height={KPI_ROW_HEIGHT} gap={10}>
    <div
      className="flex flex-none items-center"
      style={{
        height: KPI_ROW_HEIGHT,
        lineHeight: `${KPI_ROW_HEIGHT}px`,
        fontSize: 17,
        fontWeight: 900,
        color: "var(--primary-color,#B71C1C)",
      }}
    >
      {value}
    </div>
    <div
      className="flex items-center"
      style={{
        height: KPI_ROW_HEIGHT,
        lineHeight: `${KPI_ROW_HEIGHT}px`,
        fontSize: 12,
        color: "var(--text-muted,#616161)",
      }}
    >
      {label}
    </div>
  </StableInlineRow>
);

export default KpiMetricItem;
