import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";
import AnalyticsCardShell from "./AnalyticsCardShell.tsx";
import { AnalyticsIcon } from "./AnalyticsIcons.tsx";

export type CircularComparisonEntity = {
  label: string;
  valueLabel: string;
  progress: number;
  color: string;
  emphasized?: boolean;
};

type CircularComparisonMetricCardProps = {
  category: string;
  title: string;
  accentColor: string;
  entities: CircularComparisonEntity[];
  footerLabel: string;
  footerValue: string;
  icon?: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

const MetricRing = ({ entity }: { entity: CircularComparisonEntity }) => {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = clamp(entity.progress);
  const sizeClass = entity.emphasized ? "h-[96px] w-[96px]" : "h-[80px] w-[80px]";
  const valueClass = entity.emphasized ? "text-[22px] font-black" : "text-[18px] font-bold";

  return (
    <div className={`relative flex flex-none items-center justify-center ${sizeClass}`} style={{ opacity: entity.emphasized ? 1 : 0.82 }}>
      <svg className="h-full w-full" viewBox="0 0 100 100" data-pptx-export="screenshot">
        <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#F1F5F9" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke={entity.color}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress / 100)}
          strokeLinecap="round"
          strokeWidth="8"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={`${valueClass} leading-none`} style={{ color: entity.emphasized ? "#1E293B" : "#475569" }}>
          {entity.valueLabel}
        </div>
        <div className="mt-[5px] text-[10px] font-bold uppercase leading-none" style={{ color: entity.color }}>
          {entity.label}
        </div>
      </div>
    </div>
  );
};

const CircularComparisonMetricCard = ({
  category,
  title,
  accentColor,
  entities,
  footerLabel,
  footerValue,
  icon = "chart-column",
}: CircularComparisonMetricCardProps) => (
  <AnalyticsCardShell accentColor={accentColor} padding={16}>
    <div className="mb-[10px] border-b pb-[9px] text-center" style={{ borderColor: "#F1F5F9" }}>
      <div className="text-[11px] font-bold uppercase leading-[1.2]" style={{ color: chartAnalyticsTheme.colors.mutedText }}>
        {category}
      </div>
      <div className="mt-[5px] truncate text-[14px] font-bold leading-[1.2]" style={{ color: "#1E293B" }}>
        {title}
      </div>
    </div>

    <div className="flex min-h-0 flex-1 items-center justify-center gap-[22px]">
      {entities.slice(0, 2).map((entity) => (
        <MetricRing key={entity.label} entity={entity} />
      ))}
    </div>

    <div className="mt-[10px] flex items-center justify-between gap-[12px] rounded-[4px] px-[9px] py-[6px]" style={{ backgroundColor: "#F8FAFC" }}>
      <div className="flex min-w-0 items-center gap-[4px] text-[10px]">
        <div className="flex-none" style={{ color: chartAnalyticsTheme.colors.subtleText }}>
          {footerLabel}:
        </div>
        <div className="min-w-0 truncate font-bold" style={{ color: accentColor }}>
          {footerValue}
        </div>
      </div>
      <AnalyticsIcon name={icon} className="h-[14px] w-[14px] flex-none" stroke="#94A3B8" />
    </div>
  </AnalyticsCardShell>
);

export default CircularComparisonMetricCard;
