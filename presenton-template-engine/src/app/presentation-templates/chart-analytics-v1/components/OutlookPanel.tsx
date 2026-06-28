import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";
import AnalyticsCardShell from "./AnalyticsCardShell.tsx";
import { AnalyticsIcon } from "./AnalyticsIcons.tsx";
import ProgressMeter from "./ProgressMeter.tsx";

type TimelineItem = {
  period: string;
  text: string;
  color: string;
};

type OutlookPanelProps = {
  title: string;
  icon: string;
  timelineItems: TimelineItem[];
  progressLabel: string;
  progressValueLabel: string;
  progressValue: number;
  progressColor: string;
};

const OutlookPanel = ({
  title,
  icon,
  timelineItems,
  progressLabel,
  progressValueLabel,
  progressValue,
  progressColor,
}: OutlookPanelProps) => (
  <AnalyticsCardShell dark padding={24}>
    <div className="mb-[18px] flex items-center gap-[9px] border-b pb-[14px]" style={{ borderColor: "#334155" }}>
      <AnalyticsIcon name={icon} className="h-[18px] w-[18px]" stroke="#60A5FA" />
      <h3 className="m-0 text-[13px] font-bold uppercase" style={{ color: chartAnalyticsTheme.colors.darkText }}>
        {title}
      </h3>
    </div>

    <div className="grid gap-[18px]">
      {timelineItems.map((item) => (
        <div key={item.period} className="border-l-[2px] pl-[14px]" style={{ borderColor: item.color }}>
          <div className="text-[12px] font-bold" style={{ color: item.color }}>
            {item.period}
          </div>
          <div className="mt-[5px] text-[14px] font-medium leading-[1.25]" style={{ color: chartAnalyticsTheme.colors.darkText }}>
            {item.text}
          </div>
        </div>
      ))}
    </div>

    <div className="mt-auto border-t pt-[16px]" style={{ borderColor: "#334155" }}>
      <div className="flex justify-between gap-[12px] text-[12px]">
        <span className="truncate" style={{ color: chartAnalyticsTheme.colors.darkMutedText }}>
          {progressLabel}
        </span>
        <span className="flex-none font-bold" style={{ color: progressColor }}>
          {progressValueLabel}
        </span>
      </div>
      <div className="mt-[8px]">
        <ProgressMeter value={progressValue} color={progressColor} backgroundColor="#334155" height={6} />
      </div>
    </div>

    <div className="pointer-events-none absolute bottom-[-28px] right-[-24px] opacity-[0.08]">
      <AnalyticsIcon name="chart-line" className="h-[128px] w-[128px]" stroke="#FFFFFF" />
    </div>
  </AnalyticsCardShell>
);

export default OutlookPanel;
