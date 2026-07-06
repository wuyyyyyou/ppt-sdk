import React from "react";

import { redBlueComparisonTheme, type ComparisonTone } from "../theme/tokens.ts";

export type AlternatingTimelineItem = {
  date: string;
  title: string;
  description: string;
  tone?: ComparisonTone;
};

type AlternatingTimelineProps = {
  items: AlternatingTimelineItem[];
  className?: string;
  maxItems?: number;
};

const AlternatingTimeline = ({
  items,
  className,
  maxItems = 6,
}: AlternatingTimelineProps) => {
  const visibleItems = items.slice(0, maxItems);

  return (
    <div className={["relative h-full w-full", className].filter(Boolean).join(" ")}>
      <div
        className="absolute left-0 right-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full"
        style={{ backgroundColor: redBlueComparisonTheme.colors.comparisonSoft }}
      />

      <div className="relative z-10 flex h-full w-full items-center justify-between gap-[18px]">
        {visibleItems.map((item, index) => {
          const isTop = index % 2 === 0;
          const tone = item.tone ?? "comparison";
          const color = redBlueComparisonTheme.tone[tone].color;
          const tint = redBlueComparisonTheme.tone[tone].tint;

          return (
            <div
              key={`${item.date}-${item.title}-${index}`}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-center"
            >
              {isTop ? (
                <TimelineTextBlock
                  title={item.title}
                  description={item.description}
                  align="bottom"
                />
              ) : (
                <TimelineDate date={item.date} color={color} tint={tint} />
              )}

              <div className="flex h-[74px] flex-none items-center justify-center">
                <div
                  className="flex h-[42px] w-[42px] items-center justify-center"
                  data-pptx-export="screenshot"
                  data-validation-ignore="true"
                >
                  <div
                    className="h-[26px] w-[26px] rotate-45 border-[4px]"
                    style={{
                      backgroundColor: color,
                      borderColor: redBlueComparisonTheme.colors.card,
                      boxShadow: `0 0 0 3px ${color}`,
                    }}
                  />
                </div>
              </div>

              {isTop ? (
                <TimelineDate date={item.date} color={color} tint={tint} />
              ) : (
                <TimelineTextBlock
                  title={item.title}
                  description={item.description}
                  align="top"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

type TimelineDateProps = {
  date: string;
  color: string;
  tint: string;
};

const TimelineDate = ({ date, color, tint }: TimelineDateProps) => (
  <div className="flex h-[86px] flex-none items-center justify-center">
    <div
      className="max-w-[174px] break-words rounded-full px-[18px] py-[8px] text-center text-[28px] font-black leading-none"
      style={{ color, backgroundColor: tint }}
    >
      {date}
    </div>
  </div>
);

type TimelineTextBlockProps = {
  title: string;
  description: string;
  align: "top" | "bottom";
};

const TimelineTextBlock = ({ title, description, align }: TimelineTextBlockProps) => (
  <div
    className={[
      "flex h-[148px] w-full flex-none flex-col items-center px-[4px] text-center",
      align === "bottom" ? "justify-end pb-[18px]" : "justify-start pt-[18px]",
    ].join(" ")}
  >
    <div
      className="w-full text-[22px] font-black leading-[1.12]"
      style={{ color: redBlueComparisonTheme.colors.textPrimary }}
    >
      {title}
    </div>
    <div
      className="mt-[10px] w-full text-[15px] font-medium leading-[1.35]"
      style={{ color: redBlueComparisonTheme.colors.textMuted }}
    >
      {description}
    </div>
  </div>
);

export default AlternatingTimeline;
