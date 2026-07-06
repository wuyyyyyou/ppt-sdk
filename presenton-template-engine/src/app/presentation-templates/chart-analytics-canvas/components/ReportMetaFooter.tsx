import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";

type ReportMetaFooterProps = {
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
};

const ReportMetaFooter = ({ leftLabel, leftValue, rightLabel, rightValue }: ReportMetaFooterProps) => {
  return (
    <div
      className="absolute bottom-0 left-0 z-20 flex h-[96px] w-full items-end justify-between border-t px-[48px] pb-[30px]"
      style={{ borderColor: chartAnalyticsTheme.alpha.textInverse(0.05) }}
    >
      <div className="min-w-0 text-left">
        <div className="mb-[7px] text-[12px] font-bold uppercase tracking-wider" style={{ color: chartAnalyticsTheme.colors.darkMutedText }}>
          {leftLabel}
        </div>
        <div className="flex items-center gap-[10px]">
          <div className="h-[8px] w-[8px] flex-none rounded-full" style={{ backgroundColor: chartAnalyticsTheme.colors.signalPrimary }} />
          <div className="max-w-[520px] truncate text-[19px] font-bold tracking-wide" style={{ color: chartAnalyticsTheme.colors.textInverse }}>
            {leftValue}
          </div>
        </div>
      </div>

      <div className="max-w-[360px] text-right">
        <div className="mb-[7px] text-[12px] font-bold uppercase tracking-wider" style={{ color: chartAnalyticsTheme.colors.darkMutedText }}>
          {rightLabel}
        </div>
        <div className="truncate text-[19px] font-bold" style={{ color: chartAnalyticsTheme.colors.signalPrimary }}>
          {rightValue}
        </div>
      </div>
    </div>
  );
};

export default ReportMetaFooter;
