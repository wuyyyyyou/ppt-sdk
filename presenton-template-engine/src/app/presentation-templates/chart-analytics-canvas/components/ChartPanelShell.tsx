import React, { type ReactNode } from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";
import AnalyticsCardShell from "./AnalyticsCardShell.tsx";

type LegendItem = {
  label: string;
  color?: string;
};

type ChartPanelShellProps = {
  title: string;
  subtitle: string;
  legend: LegendItem[];
  children: ReactNode;
};

const ChartPanelShell = ({ title, subtitle, legend, children }: ChartPanelShellProps) => (
  <AnalyticsCardShell padding={24}>
    <div className="mb-[18px] flex items-start justify-between gap-[20px]">
      <div className="min-w-0 flex-1">
        <h3 className="m-0 truncate text-[18px] font-bold leading-[1.2]" style={{ color: chartAnalyticsTheme.colors.textPrimary }}>
          {title}
        </h3>
        <div className="mt-[4px] truncate text-[13px]" style={{ color: chartAnalyticsTheme.colors.textSubtle }}>
          {subtitle}
        </div>
      </div>
      <div className="flex flex-none items-center gap-[16px] pt-[2px]">
        {legend.map((item, index) => (
          <div key={item.label} className="flex items-center gap-[7px] text-[12px] font-medium" style={{ color: chartAnalyticsTheme.colors.signalNeutral }}>
            <span
              className="h-[12px] w-[12px] rounded-[2px]"
              style={{ backgroundColor: item.color ?? chartAnalyticsTheme.palette.chart[index % chartAnalyticsTheme.palette.chart.length] }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="min-h-0 flex-1">{children}</div>
  </AnalyticsCardShell>
);

export default ChartPanelShell;
