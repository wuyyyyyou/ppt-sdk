import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";

type AnalyticsSourceFooterProps = {
  source: string;
  slideLabel?: string;
  pageNumber?: string;
  confidentialityLabel?: string;
  height?: number;
  padded?: boolean;
  backgroundColor?: string;
};

const AnalyticsSourceFooter = ({
  source,
  slideLabel,
  pageNumber,
  confidentialityLabel,
  height = 38,
  padded = true,
  backgroundColor = chartAnalyticsTheme.colors.card,
}: AnalyticsSourceFooterProps) => {
  const resolvedSlideLabel = slideLabel ?? (pageNumber ? `SLIDE ${pageNumber}` : undefined);

  return (
    <div
      className={`flex flex-none items-center justify-between border-t text-[10px] ${padded ? "px-[48px]" : ""}`.trim()}
      style={{
        height,
        backgroundColor,
        borderColor: chartAnalyticsTheme.colors.stroke,
        color: chartAnalyticsTheme.colors.textMuted,
      }}
    >
      <div className="min-w-0 truncate">{source}</div>
      {resolvedSlideLabel || confidentialityLabel ? (
        <div className="flex flex-none items-center gap-[18px] pl-[20px]" style={{ color: chartAnalyticsTheme.colors.textSubtle }}>
          {confidentialityLabel ? <span>{confidentialityLabel}</span> : null}
          {resolvedSlideLabel ? <span className="font-bold">{resolvedSlideLabel}</span> : null}
        </div>
      ) : null}
    </div>
  );
};

export default AnalyticsSourceFooter;
