import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";
import AnalyticsCardShell from "./AnalyticsCardShell.tsx";
import { AnalyticsIcon } from "./AnalyticsIcons.tsx";

export type MilestoneTimelineItem = {
  period: string;
  title: string;
  description: string;
  icon: string;
  color: string;
};

type HorizontalMilestoneTimelineProps = {
  items: MilestoneTimelineItem[];
};

const CONNECTOR_DASH_COUNT = 6;
const toTintColor = (color: string) => (/^#[0-9a-f]{6}$/i.test(color) ? `${color}16` : "rgba(37,99,235,0.08)");

const HorizontalMilestoneTimeline = ({ items }: HorizontalMilestoneTimelineProps) => {
  const gridTemplateColumns = `repeat(${items.length}, minmax(0, 1fr))`;

  return (
    <div className="relative h-full min-h-0">
      <div className="absolute left-0 right-0 top-[56px] h-[4px]" style={{ backgroundColor: "#CBD5E1" }} />

      <div className="relative z-10 grid h-full gap-[20px]" style={{ gridTemplateColumns }}>
        {items.map((item) => (
          <div key={`${item.period}-${item.title}`} className="flex h-full min-w-0 flex-col items-center">
            <div className="relative flex h-[112px] flex-none flex-col items-center">
              <div
                className="mb-[7px] max-w-full truncate px-[6px] text-center text-[24px] font-bold leading-[1.1]"
                style={{ backgroundColor: chartAnalyticsTheme.colors.surface, color: item.color }}
              >
                {item.period}
              </div>
              <div
                className="relative z-20 h-[24px] w-[24px] rounded-full border-[4px]"
                style={{ backgroundColor: item.color, borderColor: "#FFFFFF", boxShadow: "0 2px 6px rgba(15,23,42,0.18)" }}
              />
              <div className="absolute top-[64px] flex h-[48px] w-[2px] flex-col gap-[4px] overflow-hidden">
                {Array.from({ length: CONNECTOR_DASH_COUNT }).map((_, index) => (
                  <div key={index} className="h-[4px] w-[2px] flex-none" style={{ backgroundColor: "#CBD5E1" }} />
                ))}
              </div>
            </div>

            <AnalyticsCardShell accentColor={item.color} className="w-full flex-1" padding={18}>
              <div className="mb-[12px] flex h-[32px] w-[32px] flex-none items-center justify-center rounded-[7px]" style={{ backgroundColor: toTintColor(item.color) }}>
                <AnalyticsIcon name={item.icon} className="h-[19px] w-[19px]" stroke={item.color} />
              </div>
              <h3 className="m-0 text-[17px] font-bold leading-[1.16]" style={{ color: "#1E293B" }}>
                {item.title}
              </h3>
              <p className="mt-[10px] min-h-0 text-[13px] leading-[1.38]" style={{ color: chartAnalyticsTheme.colors.subtleText }}>
                {item.description}
              </p>
            </AnalyticsCardShell>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HorizontalMilestoneTimeline;
