import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";
import AnalyticsCardShell from "./AnalyticsCardShell.tsx";

export type AdvantageBarItem = {
  label: string;
  valueLabel: string;
  leftValue: number;
  rightValue: number;
};

type AdvantageBarListProps = {
  title: string;
  leftLabel: string;
  leftColor: string;
  rightLabel: string;
  rightColor: string;
  items: AdvantageBarItem[];
};

const clamp = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

const AdvantageBarList = ({
  title,
  leftLabel,
  leftColor,
  rightLabel,
  rightColor,
  items,
}: AdvantageBarListProps) => (
  <AnalyticsCardShell padding={24}>
    <div className="mb-[20px] flex items-center justify-between gap-[18px]">
      <h3 className="m-0 truncate text-[18px] font-bold" style={{ color: "#1E293B" }}>
        {title}
      </h3>
      <div className="flex flex-none items-center gap-[16px]">
        <div className="flex items-center gap-[7px]">
          <span className="h-[8px] w-[8px] rounded-full" style={{ backgroundColor: leftColor }} />
          <span className="text-[10px] font-bold uppercase" style={{ color: chartAnalyticsTheme.colors.subtleText }}>
            {leftLabel}
          </span>
        </div>
        <div className="flex items-center gap-[7px]">
          <span className="h-[8px] w-[8px] rounded-full" style={{ backgroundColor: rightColor }} />
          <span className="text-[10px] font-bold uppercase" style={{ color: chartAnalyticsTheme.colors.subtleText }}>
            {rightLabel}
          </span>
        </div>
      </div>
    </div>

    <div className="flex min-h-0 flex-1 flex-col justify-center gap-[18px]">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-[6px] flex justify-between gap-[16px] text-[12px] font-bold" style={{ color: "#475569" }}>
            <span className="truncate">{item.label}</span>
            <span className="flex-none">{item.valueLabel}</span>
          </div>
          <div className="relative h-[12px] w-full overflow-hidden rounded-full" style={{ backgroundColor: "#F1F5F9" }}>
            <div className="absolute left-0 top-0 h-full" style={{ width: `${clamp(item.leftValue)}%`, backgroundColor: leftColor }} />
            <div className="absolute right-0 top-0 h-full" style={{ width: `${clamp(item.rightValue)}%`, backgroundColor: rightColor }} />
          </div>
        </div>
      ))}
    </div>
  </AnalyticsCardShell>
);

export default AdvantageBarList;
