import React from "react";

import { redFinanceTheme } from "../theme/tokens.ts";
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
        color: redFinanceTheme.colors.primary,
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
        color: redFinanceTheme.colors.mutedText,
      }}
    >
      {label}
    </div>
  </StableInlineRow>
);

export default KpiMetricItem;
