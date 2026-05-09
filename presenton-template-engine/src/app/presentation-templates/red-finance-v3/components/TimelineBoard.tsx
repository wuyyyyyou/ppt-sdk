import React from "react";

import { redFinanceTheme } from "../theme/tokens.js";

export type TimelineBoardItem = {
  label: string;
  title: string;
  items: string[];
};

type TimelineBoardProps = {
  phases: TimelineBoardItem[];
  density?: "normal" | "compact";
  showConnectorLine?: boolean;
  className?: string;
};

const TimelineBoard = ({
  phases,
  density = "normal",
  showConnectorLine = true,
  className,
}: TimelineBoardProps) => {
  const isCompact = density === "compact";
  const nodeSize = isCompact ? 32 : 34;
  const phaseGap = isCompact ? 12 : 14;
  const cardPaddingX = isCompact ? 12 : 14;
  const cardPaddingTop = isCompact ? 10 : 12;
  const cardPaddingBottom = isCompact ? 12 : 14;
  const bulletGap = isCompact ? 6 : 7;
  const bulletTopOffset = isCompact ? 4 : 5;
  const titleMarginBottom = isCompact ? 6 : 8;

  return (
    <div
      className={[
        "relative flex h-full min-h-0 flex-col rounded-[12px] border px-[18px] py-[16px]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundColor: redFinanceTheme.colors.background,
        borderColor: redFinanceTheme.colors.stroke,
        boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
      }}
    >
      <div className="relative flex min-h-0 flex-1 gap-[14px] pt-[6px]">
        {showConnectorLine ? (
          <div
            className="absolute left-[56px] right-[56px] top-[20px] h-[2px] rounded-full"
            style={{ backgroundColor: "#E0E0E0" }}
          />
        ) : null}
        {phases.map((phase) => (
          <div
            key={`${phase.label}-${phase.title}`}
            className="relative z-10 flex min-w-0 flex-1 flex-col rounded-[10px] border"
            style={{
              paddingLeft: cardPaddingX,
              paddingRight: cardPaddingX,
              paddingTop: cardPaddingTop,
              paddingBottom: cardPaddingBottom,
              backgroundColor: "#FFFFFF",
              borderColor: redFinanceTheme.colors.stroke,
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            }}
          >
            <div
              className="mb-[10px] flex items-center justify-center rounded-full text-[14px] font-black"
              style={{
                width: nodeSize,
                height: nodeSize,
                backgroundColor: redFinanceTheme.colors.primary,
                color: "#FFFFFF",
                boxShadow: "0 3px 6px rgba(183,28,28,0.2)",
              }}
            >
              {phase.label}
            </div>
            <div
              className="text-[15px] font-bold leading-[1.2]"
              style={{
                marginBottom: titleMarginBottom,
                color: redFinanceTheme.colors.backgroundText,
              }}
            >
              {phase.title}
            </div>
            <div className="flex min-h-0 flex-1 flex-col" style={{ gap: bulletGap }}>
              {phase.items.map((item, itemIndex) => (
                <div
                  key={`${phase.label}-${itemIndex}`}
                  className="flex items-start gap-[8px]"
                >
                  <div
                    className="flex-none rounded-full"
                    style={{
                      width: 5,
                      height: 5,
                      marginTop: bulletTopOffset,
                      backgroundColor: redFinanceTheme.colors.primary,
                    }}
                  />
                  <div
                    className="min-w-0 text-[12px] leading-[1.35]"
                    style={{ color: redFinanceTheme.colors.mutedText }}
                  >
                    {item}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimelineBoard;
