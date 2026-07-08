import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";
import AnalyticsCardShell from "./AnalyticsCardShell.tsx";
import { AnalyticsIcon } from "./AnalyticsIcons.tsx";

export type SummaryInsightRow = {
  label: string;
  text: string;
  labelColor?: string;
};

type SummaryInsightCardProps = {
  indexLabel: string;
  title: string;
  description: string;
  icon: string;
  accentColor?: string;
  iconTint?: string;
  iconColor?: string;
  rows: SummaryInsightRow[];
};

const SummaryInsightCard = ({
  indexLabel,
  title,
  description,
  icon,
  accentColor,
  iconTint,
  iconColor,
  rows,
}: SummaryInsightCardProps) => {
  const resolvedAccentColor = accentColor ?? chartAnalyticsTheme.colors.signalPrimary;
  const resolvedIconTint = iconTint ?? chartAnalyticsTheme.colors.signalPrimaryTint;
  const resolvedIconColor = iconColor ?? resolvedAccentColor;

  return (
  <AnalyticsCardShell accentColor={resolvedAccentColor} padding={22}>
    <div className="flex items-start justify-between gap-[16px]">
      <div className="flex h-[48px] w-[48px] flex-none items-center justify-center rounded-[12px]" style={{ backgroundColor: resolvedIconTint }}>
        <AnalyticsIcon name={icon} className="h-[22px] w-[22px]" stroke={resolvedIconColor} />
      </div>
      <div className="text-[12px] font-bold leading-none" style={{ color: chartAnalyticsTheme.colors.signalNeutralBorder }}>
        {indexLabel}
      </div>
    </div>

    <h3 className="m-0 mt-[16px] text-[18px] font-bold leading-[1.15]" style={{ color: chartAnalyticsTheme.colors.textPrimary }}>
      {title}
    </h3>
    <p className="m-0 mt-[8px] text-[13px] leading-[1.35]" style={{ color: chartAnalyticsTheme.colors.textSubtle }}>
      {description}
    </p>

    <div className="mt-auto grid gap-[8px] pt-[14px]">
      {rows.map((row, index) => (
        <div key={`${row.label}-${row.text}`} className="flex min-h-[34px] items-center gap-[10px] rounded-[6px] px-[10px] py-[7px]" style={{ backgroundColor: chartAnalyticsTheme.colors.surface }}>
          <div
            className="w-[52px] flex-none truncate text-[11px] font-bold leading-[1.15]"
            style={{ color: row.labelColor ?? chartAnalyticsTheme.palette.chart[index % chartAnalyticsTheme.palette.chart.length] }}
          >
            {row.label}
          </div>
          <div className="min-w-0 flex-1 text-[11px] leading-[1.2]" style={{ color: chartAnalyticsTheme.colors.signalNeutral }}>
            {row.text}
          </div>
        </div>
      ))}
    </div>
  </AnalyticsCardShell>
  );
};

export default SummaryInsightCard;
