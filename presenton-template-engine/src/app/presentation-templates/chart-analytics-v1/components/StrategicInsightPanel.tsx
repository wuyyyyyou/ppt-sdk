import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";
import AnalyticsCardShell from "./AnalyticsCardShell.tsx";
import { AnalyticsIcon } from "./AnalyticsIcons.tsx";

export type StrategicInsightItem = {
  label: string;
  text: string;
  color: string;
};

type StrategicInsightPanelProps = {
  eyebrow: string;
  headline: string;
  icon?: string;
  items: StrategicInsightItem[];
  statLabel: string;
  statValue: string;
  statBadge: string;
  statBadgeColor: string;
  statBadgeBackground: string;
};

const StrategicInsightPanel = ({
  eyebrow,
  headline,
  icon = "grid",
  items,
  statLabel,
  statValue,
  statBadge,
  statBadgeColor,
  statBadgeBackground,
}: StrategicInsightPanelProps) => (
  <div className="flex h-full min-h-0 flex-col gap-[16px]">
    <div className="min-h-0 flex-1">
      <AnalyticsCardShell dark padding={20}>
        <div className="pointer-events-none absolute right-[14px] top-[12px] opacity-[0.1]">
          <AnalyticsIcon name={icon} className="h-[78px] w-[78px]" stroke="#FFFFFF" />
        </div>

        <div className="text-[12px] font-bold uppercase leading-[1.2]" style={{ color: "#60A5FA" }}>
          {eyebrow}
        </div>
        <div className="mt-[10px] text-[20px] font-light leading-[1.15]" style={{ color: chartAnalyticsTheme.colors.darkText }}>
          {headline}
        </div>

        <div className="mt-[16px] grid flex-1 content-start gap-[12px]">
          {items.map((item) => (
            <div key={item.label} className="flex items-start gap-[9px]">
              <div className="mt-[5px] h-[7px] w-[7px] flex-none rounded-full" style={{ backgroundColor: item.color }} />
              <div className="flex min-w-0 flex-1 items-start gap-[5px]">
                <div className="w-[48px] flex-none text-[12px] font-bold leading-[1.2]" style={{ color: chartAnalyticsTheme.colors.darkText }}>
                  {item.label}:
                </div>
                <div className="min-w-0 flex-1 text-[11px] leading-[1.2]" style={{ color: chartAnalyticsTheme.colors.darkMutedText }}>
                  {item.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      </AnalyticsCardShell>
    </div>

    <div className="h-[88px] flex-none">
      <AnalyticsCardShell padding={16}>
        <div className="flex h-full items-center justify-between gap-[18px]">
          <div className="min-w-0">
            <div className="truncate text-[10px] font-bold uppercase" style={{ color: chartAnalyticsTheme.colors.mutedText }}>
              {statLabel}
            </div>
            <div className="mt-[5px] truncate text-[25px] font-black leading-none" style={{ color: "#1E293B" }}>
              {statValue}
            </div>
          </div>
          <div className="flex-none rounded-[4px] px-[9px] py-[6px] text-[10px] font-bold" style={{ color: statBadgeColor, backgroundColor: statBadgeBackground }}>
            {statBadge}
          </div>
        </div>
      </AnalyticsCardShell>
    </div>
  </div>
);

export default StrategicInsightPanel;
