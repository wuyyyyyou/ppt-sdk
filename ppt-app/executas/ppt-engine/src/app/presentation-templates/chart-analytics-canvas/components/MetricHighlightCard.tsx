import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";
import { AnalyticsIcon } from "./AnalyticsIcons.tsx";
import AnalyticsCardShell from "./AnalyticsCardShell.tsx";
import ProgressMeter from "./ProgressMeter.tsx";
import StatusBadge from "./StatusBadge.tsx";

type ProgressItem = {
  label: string;
  valueLabel: string;
  value: number;
  color?: string;
};

type ValueTile = {
  label: string;
  value: string;
  note: string;
  tint?: string;
  labelColor?: string;
};

type StatusItem = {
  title: string;
  description: string;
  badge: string;
  badgeColor?: string;
  badgeBackground?: string;
};

type MetricHighlightCardProps = {
  accentColor?: string;
  icon: string;
  label: string;
  value: string;
  qualifier: string;
  progressItems?: ProgressItem[];
  valueTiles?: ValueTile[];
  statusItems?: StatusItem[];
};

const MetricHighlightCard = ({
  accentColor,
  icon,
  label,
  value,
  qualifier,
  progressItems = [],
  valueTiles = [],
  statusItems = [],
}: MetricHighlightCardProps) => {
  const resolvedAccentColor = accentColor ?? chartAnalyticsTheme.colors.signalPrimary;

  return (
  <AnalyticsCardShell accentColor={resolvedAccentColor} padding={18}>
    <div className="absolute right-[18px] top-[18px] opacity-[0.08]">
      <AnalyticsIcon name={icon} className="h-[66px] w-[66px]" stroke={resolvedAccentColor} />
    </div>

    <div className="relative z-[1] flex h-full min-h-0 flex-col justify-center">
      <div className="text-[13px] font-semibold uppercase leading-[1.2]" style={{ color: chartAnalyticsTheme.colors.textSubtle }}>
        {label}
      </div>
      <div className="mt-[8px] flex items-baseline gap-[8px]">
        <div
          className="text-[48px] font-bold leading-none"
          style={{ color: chartAnalyticsTheme.colors.textPrimary, fontFamily: chartAnalyticsTheme.fonts.display }}
        >
          {value}
        </div>
        <div className="text-[14px] font-medium" style={{ color: chartAnalyticsTheme.colors.textSubtle }}>
          {qualifier}
        </div>
      </div>

      {progressItems.length > 0 ? (
        <div className="mt-[16px] grid gap-[10px]">
          {progressItems.map((item, index) => {
            const itemColor = item.color ?? chartAnalyticsTheme.palette.chart[index % chartAnalyticsTheme.palette.chart.length];

            return (
            <div key={item.label}>
              <div className="mb-[4px] flex justify-between gap-[12px] text-[11px] font-bold">
                <span className="truncate" style={{ color: itemColor }}>
                  {item.label}
                </span>
                <span className="flex-none" style={{ color: chartAnalyticsTheme.colors.textMuted }}>
                  {item.valueLabel}
                </span>
              </div>
              <ProgressMeter value={item.value} color={itemColor} />
            </div>
            );
          })}
        </div>
      ) : null}

      {valueTiles.length > 0 ? (
        <div className="mt-[16px] grid grid-cols-2 gap-[12px]">
          {valueTiles.map((tile, index) => {
            const tone = index === 0 ? chartAnalyticsTheme.tone.signalSecondary : chartAnalyticsTheme.tone.signalNeutral;

            return (
            <div key={tile.label} className="rounded-[8px] px-[12px] py-[10px]" style={{ backgroundColor: tile.tint ?? tone.tint }}>
              <div className="text-[11px] font-bold uppercase" style={{ color: tile.labelColor ?? tone.color }}>
                {tile.label}
              </div>
              <div className="mt-[3px] text-[18px] font-bold leading-none" style={{ color: chartAnalyticsTheme.colors.textPrimary }}>
                {tile.value}
              </div>
              <div className="mt-[5px] text-[10px] leading-[1.25]" style={{ color: chartAnalyticsTheme.colors.textSubtle }}>
                {tile.note}
              </div>
            </div>
            );
          })}
        </div>
      ) : null}

      {statusItems.length > 0 ? (
        <div className="mt-[14px] grid gap-[9px]">
          {statusItems.map((item, index) => (
            <div
              key={item.title}
              className={`flex items-center justify-between gap-[12px] ${index < statusItems.length - 1 ? "border-b pb-[9px]" : ""}`.trim()}
              style={{ borderColor: chartAnalyticsTheme.colors.strokeSoft }}
            >
              <div className="min-w-0">
                <div className="truncate text-[12px] font-bold" style={{ color: chartAnalyticsTheme.colors.signalNeutral }}>
                  {item.title}
                </div>
                <div className="mt-[2px] truncate text-[10px]" style={{ color: chartAnalyticsTheme.colors.textSubtle }}>
                  {item.description}
                </div>
              </div>
              <StatusBadge label={item.badge} color={item.badgeColor} backgroundColor={item.badgeBackground} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  </AnalyticsCardShell>
  );
};

export default MetricHighlightCard;
