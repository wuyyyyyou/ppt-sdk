import React from "react";

import AnalyticsCardShell from "./AnalyticsCardShell.tsx";
import { AnalyticsIcon } from "./AnalyticsIcons.tsx";

export type SummaryInsightRow = {
  label: string;
  text: string;
  labelColor: string;
};

type SummaryInsightCardProps = {
  indexLabel: string;
  title: string;
  description: string;
  icon: string;
  accentColor: string;
  iconTint: string;
  iconColor: string;
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
}: SummaryInsightCardProps) => (
  <AnalyticsCardShell accentColor={accentColor} padding={22}>
    <div className="flex items-start justify-between gap-[16px]">
      <div className="flex h-[48px] w-[48px] flex-none items-center justify-center rounded-[12px]" style={{ backgroundColor: iconTint }}>
        <AnalyticsIcon name={icon} className="h-[22px] w-[22px]" stroke={iconColor} />
      </div>
      <div className="text-[12px] font-bold leading-none" style={{ color: "#CBD5E1" }}>
        {indexLabel}
      </div>
    </div>

    <h3 className="m-0 mt-[16px] text-[18px] font-bold leading-[1.15]" style={{ color: "#1E293B" }}>
      {title}
    </h3>
    <p className="m-0 mt-[8px] text-[13px] leading-[1.35]" style={{ color: "#64748B" }}>
      {description}
    </p>

    <div className="mt-auto grid gap-[8px] pt-[14px]">
      {rows.map((row) => (
        <div key={`${row.label}-${row.text}`} className="flex min-h-[34px] items-center gap-[10px] rounded-[6px] px-[10px] py-[7px]" style={{ backgroundColor: "#F8FAFC" }}>
          <div className="w-[52px] flex-none truncate text-[11px] font-bold leading-[1.15]" style={{ color: row.labelColor }}>
            {row.label}
          </div>
          <div className="min-w-0 flex-1 text-[11px] leading-[1.2]" style={{ color: "#334155" }}>
            {row.text}
          </div>
        </div>
      ))}
    </div>
  </AnalyticsCardShell>
);

export default SummaryInsightCard;
