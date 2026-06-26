import React, { type ReactNode } from "react";

import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";

type TimelineNodeProps = {
  date: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  tone?: RedBlueTone;
  position?: "above" | "below";
  width?: number;
  className?: string;
};

const TimelineNode = ({
  date,
  title,
  description,
  tone = "purple",
  position = "above",
  width = 210,
  className,
}: TimelineNodeProps) => {
  const toneValue = redBlueComparisonTheme.tone[tone];
  const isAbove = position === "above";

  return (
    <div
      className={["flex flex-col items-center text-center", className].filter(Boolean).join(" ")}
      style={{ width }}
    >
      {isAbove ? (
        <div className="mb-[24px] min-h-[88px]">
          <div className="overflow-hidden text-[19px] font-black leading-[1.2]" style={{ maxHeight: 46, color: redBlueComparisonTheme.colors.backgroundText }}>
            {title}
          </div>
          {description ? <div className="mt-[8px] overflow-hidden text-[13px] font-medium leading-[1.35]" style={{ maxHeight: 36, color: redBlueComparisonTheme.colors.mutedText }}>{description}</div> : null}
        </div>
      ) : (
        <div className="mb-[24px] rounded-full px-[18px] py-[7px] text-[20px] font-black leading-none" style={{ color: toneValue.color, backgroundColor: toneValue.tint }}>
          {date}
        </div>
      )}

      <div className="h-[24px] w-[24px] rotate-45 border-[4px] border-white" style={{ backgroundColor: toneValue.color, boxShadow: `0 0 0 3px ${toneValue.color}` }} />

      {isAbove ? (
        <div className="mt-[24px] rounded-full px-[18px] py-[7px] text-[20px] font-black leading-none" style={{ color: toneValue.color, backgroundColor: toneValue.tint }}>
          {date}
        </div>
      ) : (
        <div className="mt-[24px] min-h-[88px]">
          <div className="overflow-hidden text-[19px] font-black leading-[1.2]" style={{ maxHeight: 46, color: redBlueComparisonTheme.colors.backgroundText }}>
            {title}
          </div>
          {description ? <div className="mt-[8px] overflow-hidden text-[13px] font-medium leading-[1.35]" style={{ maxHeight: 36, color: redBlueComparisonTheme.colors.mutedText }}>{description}</div> : null}
        </div>
      )}
    </div>
  );
};

export default TimelineNode;
