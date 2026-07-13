import React from "react";

import { theme } from "../theme.ts";
import StableInlineRow from "./StableInlineRow.tsx";

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
        color: theme.colors.accent,
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
        color: theme.colors.textMuted,
      }}
    >
      {label}
    </div>
  </StableInlineRow>
);

export default KpiMetricItem;
