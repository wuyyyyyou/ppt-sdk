import React from "react";

import { redBlueTheme } from "../theme/tokens.ts";

export type RedBlueTimelineItem = {
  date: string;
  title: string;
  description: string;
};

type RedBlueTimelineProps = {
  items: RedBlueTimelineItem[];
};

const RedBlueTimeline = ({ items }: RedBlueTimelineProps) => {
  return (
    <div className="relative flex h-full items-center px-[16px] pb-[20px]">
      <div
        className="absolute left-[16px] right-[16px] top-1/2 h-[4px] rounded-full"
        style={{ backgroundColor: redBlueTheme.colors.purpleSoft }}
      />
      <div className="relative z-10 flex w-full justify-between">
        {items.map((item, index) => {
          const top = index % 2 === 0;
          return (
            <div key={`${item.date}-${item.title}`} className="flex w-[20%] flex-col items-center text-center">
              {top ? (
                <div className="mb-[42px] min-h-[116px]">
                  <TimelineText item={item} />
                </div>
              ) : (
                <TimelineDate date={item.date} className="mb-[30px]" />
              )}
              <div className="flex h-[32px] w-[32px] items-center justify-center">
                <div
                  className="h-[24px] w-[24px] rotate-45 border-[4px] border-white"
                  style={{
                    backgroundColor: redBlueTheme.colors.purple,
                    boxShadow: `0 0 0 3px ${redBlueTheme.colors.purple}`,
                  }}
                />
              </div>
              {top ? (
                <TimelineDate date={item.date} className="mt-[30px]" />
              ) : (
                <div className="mt-[42px] min-h-[116px]">
                  <TimelineText item={item} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TimelineDate = ({ date, className }: { date: string; className?: string }) => (
  <div
    className={`inline-flex rounded-full px-[18px] py-[8px] text-[28px] font-black leading-none ${className ?? ""}`}
    style={{
      color: redBlueTheme.colors.purple,
      backgroundColor: "rgba(221,216,247,0.45)",
      fontFamily: redBlueTheme.fonts.heading,
    }}
  >
    {date}
  </div>
);

const TimelineText = ({ item }: { item: RedBlueTimelineItem }) => (
  <>
    <div className="text-[22px] font-black leading-[26px]" style={{ color: redBlueTheme.colors.backgroundText }}>
      {item.title}
    </div>
    <div className="mt-[10px] text-[16px] font-medium leading-[22px]" style={{ color: redBlueTheme.colors.mutedText }}>
      {item.description}
    </div>
  </>
);

export default RedBlueTimeline;
