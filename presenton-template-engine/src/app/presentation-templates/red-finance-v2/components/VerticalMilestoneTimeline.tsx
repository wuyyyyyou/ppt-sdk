import React from "react";

import { redFinanceTheme } from "../theme/tokens.js";
import HorizontalFeatureCard from "./HorizontalFeatureCard.js";
import { type FinanceIconName } from "./FinanceIcons.js";

export type VerticalMilestoneTimelineItem = {
  period: string;
  stage: string;
  title: string;
  description: string;
  icon: FinanceIconName;
  tone?: "default" | "accent" | "future";
  tag?: string;
};

type VerticalMilestoneTimelineProps = {
  items: VerticalMilestoneTimelineItem[];
  density?: "normal" | "compact";
  className?: string;
};

const VerticalMilestoneTimeline = ({
  items,
  density = "normal",
  className,
}: VerticalMilestoneTimelineProps) => {
  const isCompact = density === "compact";
  const axisLeft = isCompact ? 172 : 184;
  const leftWidth = isCompact ? 164 : 176;
  const leftPaddingRight = isCompact ? 26 : 30;
  const rowGap = isCompact ? 8 : 10;
  const axisInset = isCompact ? 46 : 52;
  const connectorWidth = isCompact ? 18 : 22;
  const connectorGap = isCompact ? 12 : 14;
  const dotSize = isCompact ? 14 : 16;
  const dotBorderWidth = isCompact ? 2.5 : 3;
  const dotHalo = isCompact ? "0 0 0 3px rgba(255,255,255,1)" : "0 0 0 4px rgba(255,255,255,1)";
  const cardMinHeight = isCompact ? 68 : 76;
  const periodFontSize = isCompact ? 22 : 24;
  const stageFontSize = isCompact ? 11 : 12;
  const timelineStroke = "#E0E0E0";

  return (
    <div className={["relative h-full overflow-hidden", className].filter(Boolean).join(" ")}>
      <div
        className="absolute w-[2px] rounded-full"
        style={{
          left: axisLeft,
          top: axisInset,
          bottom: axisInset,
          backgroundColor: timelineStroke,
        }}
      />

      <div className="flex h-full flex-col" style={{ gap: rowGap }}>
        {items.map((item) => {
          const tone = item.tone ?? "default";
          const isFuture = tone === "future";
          const yearColor = isFuture
            ? redFinanceTheme.colors.primary
            : redFinanceTheme.colors.primary;

          return (
            <div
              key={`${item.period}-${item.title}`}
              className="flex min-h-0 flex-1 items-center"
            >
              <div
                className="flex flex-none flex-col items-end justify-center"
                style={{
                  width: leftWidth,
                  paddingRight: leftPaddingRight,
                }}
              >
                <div
                  className="whitespace-nowrap font-black leading-none"
                  style={{
                    fontSize: periodFontSize,
                    color: yearColor,
                  }}
                >
                  {item.period}
                </div>
                <div
                  className="mt-[5px] whitespace-nowrap font-medium leading-none"
                  style={{
                    fontSize: stageFontSize,
                    color: redFinanceTheme.colors.mutedText,
                  }}
                >
                  {item.stage}
                </div>
              </div>

              <div
                className="relative z-10 flex flex-none items-center justify-center"
                style={{ width: dotSize }}
              >
                <div
                  className="rounded-full border"
                  style={{
                    width: dotSize,
                    height: dotSize,
                    borderWidth: dotBorderWidth,
                    borderColor: isFuture
                      ? redFinanceTheme.colors.primary
                      : redFinanceTheme.colors.primary,
                    backgroundColor: isFuture
                      ? redFinanceTheme.colors.primary
                      : "#FFFFFF",
                    boxShadow: dotHalo,
                  }}
                />
              </div>

              <div
                className="flex min-w-0 flex-1 items-center"
                style={{ paddingLeft: leftPaddingRight, gap: connectorGap }}
              >
                <div
                  className="flex-none rounded-full"
                  style={{
                    width: connectorWidth,
                    height: 2,
                    backgroundColor: timelineStroke,
                  }}
                />
                <HorizontalFeatureCard
                  className="min-w-0 flex-1"
                  iconName={item.icon}
                  title={item.title}
                  description={item.description}
                  tag={item.tag}
                  tone={tone}
                  density={isCompact ? "dense" : "compact"}
                  minHeight={cardMinHeight}
                  tagUppercase={false}
                  railColor={
                    isFuture ? redFinanceTheme.colors.primary : undefined
                  }
                  iconBackgroundColor={isFuture ? redFinanceTheme.colors.paleRed : undefined}
                  iconStroke={
                    isFuture ? redFinanceTheme.colors.primary : undefined
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VerticalMilestoneTimeline;
