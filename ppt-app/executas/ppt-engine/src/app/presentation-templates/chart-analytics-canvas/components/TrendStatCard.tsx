import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";

type TrendMetric = {
  label: string;
  value: string;
  note?: string;
};

type TrendStatCardProps = {
  subject: string;
  symbol?: string;
  statusLabel: string;
  statusColor?: string;
  statusBackground?: string;
  accentColor?: string;
  metrics: TrendMetric[];
  narrative: string;
};

const TrendStatCard = ({
  subject,
  symbol,
  statusLabel,
  statusColor,
  statusBackground,
  accentColor,
  metrics,
  narrative,
}: TrendStatCardProps) => {
  const resolvedAccentColor = accentColor ?? chartAnalyticsTheme.colors.entityPrimary;

  return (
  <div
    className="relative flex min-h-0 flex-col overflow-hidden rounded-[8px] border px-[18px] py-[16px]"
    style={{
      backgroundColor: chartAnalyticsTheme.colors.card,
      borderColor: chartAnalyticsTheme.colors.stroke,
      boxShadow: chartAnalyticsTheme.shadows.card,
    }}
  >
    <div className="absolute bottom-0 left-0 top-0 w-[4px] flex-none" style={{ backgroundColor: resolvedAccentColor }} />
    <div className="mb-[12px] flex items-center justify-between gap-[12px]">
      <div className="flex min-w-0 items-center gap-[8px]">
        {symbol ? <div className="flex-none text-[23px] leading-none">{symbol}</div> : null}
        <h3 className="m-0 truncate text-[18px] font-bold leading-[1.1]" style={{ color: chartAnalyticsTheme.colors.textPrimary }}>
          {subject}
        </h3>
      </div>
      <div
        className="flex-none rounded-[6px] px-[8px] py-[4px] text-[11px] font-bold leading-none"
        style={{
          color: statusColor ?? resolvedAccentColor,
          backgroundColor: statusBackground ?? chartAnalyticsTheme.colors.signalPrimaryTint,
        }}
      >
        {statusLabel}
      </div>
    </div>

    <div
      className="grid gap-[12px]"
      style={{ gridTemplateColumns: `repeat(${Math.min(metrics.length, 2)}, minmax(0, 1fr))` }}
    >
      {metrics.slice(0, 2).map((metric, index) => (
        <div key={`${metric.label}-${index}`} className="min-w-0">
          <div className="truncate text-[11px] font-semibold uppercase" style={{ color: chartAnalyticsTheme.colors.textMuted }}>
            {metric.label}
          </div>
          <div className="mt-[5px] flex items-baseline gap-[5px]">
            <div className="truncate text-[21px] font-bold leading-none" style={{ color: index === 0 ? resolvedAccentColor : chartAnalyticsTheme.colors.signalNeutral }}>
              {metric.value}
            </div>
            {metric.note ? (
              <div className="flex-none text-[11px] leading-none" style={{ color: chartAnalyticsTheme.colors.textMuted }}>
                {metric.note}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>

    <div className="mt-[13px] border-t pt-[11px] text-[12px] leading-[1.42]" style={{ borderColor: chartAnalyticsTheme.colors.strokeSoft, color: chartAnalyticsTheme.colors.textSubtle }}>
      {narrative}
    </div>
  </div>
  );
};

export default TrendStatCard;
