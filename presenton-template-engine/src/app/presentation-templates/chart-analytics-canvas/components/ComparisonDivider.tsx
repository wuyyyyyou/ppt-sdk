import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";

type ComparisonDividerProps = {
  label: string;
  lineColor?: string;
  labelColor?: string;
};

const ComparisonDivider = ({
  label,
  lineColor = "#64748B",
  labelColor = chartAnalyticsTheme.colors.primary,
}: ComparisonDividerProps) => {
  return (
    <div className="flex h-[62px] items-center justify-center gap-[26px]">
      <div className="h-px w-[96px] flex-none" style={{ backgroundColor: lineColor }} />
      <div
        className="flex h-[52px] w-[64px] flex-none items-center justify-center whitespace-nowrap text-center text-[40px] font-light italic leading-none"
        style={{
          color: labelColor,
          fontFamily: chartAnalyticsTheme.fonts.display,
          transform: "translateY(-5px)",
        }}
      >
        {label}
      </div>
      <div className="h-px w-[96px] flex-none" style={{ backgroundColor: lineColor }} />
    </div>
  );
};

export default ComparisonDivider;
