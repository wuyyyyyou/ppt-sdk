import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";
import AnalyticsDonutChart, { type AnalyticsDonutSegment } from "./AnalyticsDonutChart.tsx";
import { AnalyticsIcon } from "./AnalyticsIcons.tsx";

export type StructureComparisonCardData = {
  name: string;
  symbol: string;
  statusLabel: string;
  accentColor: string;
  symbolTint: string;
  totalValue: string;
  totalLabel: string;
  centerMetricLabel: string;
  centerMetricValue: string;
  segments: AnalyticsDonutSegment[];
  footerLabel: string;
  footerValue: string;
  footerSuffix?: string;
  footerTint: string;
  footerTextColor: string;
  footerIcon?: string;
};

type StructureComparisonCardProps = {
  entity: StructureComparisonCardData;
};

const StructureComparisonCard = ({ entity }: StructureComparisonCardProps) => (
  <div
    className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[8px] border bg-white p-[24px]"
    style={{
      borderColor: "#F1F5F9",
      borderTopWidth: 6,
      borderTopColor: entity.accentColor,
      boxShadow: "0 12px 18px rgba(15,23,42,0.10), 0 4px 7px rgba(15,23,42,0.05)",
    }}
  >
    <div className="flex flex-none items-center justify-between border-b pb-[14px]" style={{ borderColor: "#F1F5F9" }}>
      <div className="flex min-w-0 items-center gap-[14px]">
        <div
          className="flex h-[48px] w-[48px] flex-none items-center justify-center rounded-[8px] border text-[19px] font-black"
          style={{
            backgroundColor: entity.symbolTint,
            borderColor: entity.symbolTint,
            color: entity.accentColor,
          }}
        >
          {entity.symbol}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[25px] font-bold leading-[1.1]" style={{ color: "#1E293B" }}>
            {entity.name}
          </div>
          <div className="mt-[5px] truncate text-[12px] font-medium uppercase" style={{ color: chartAnalyticsTheme.colors.subtleText }}>
            {entity.statusLabel}
          </div>
        </div>
      </div>

      <div className="flex-none pl-[18px] text-right">
        <div className="text-[30px] font-black leading-none" style={{ color: "#1E293B" }}>
          {entity.totalValue}
        </div>
        <div className="mt-[5px] text-[10px] font-bold uppercase leading-none" style={{ color: chartAnalyticsTheme.colors.mutedText }}>
          {entity.totalLabel}
        </div>
      </div>
    </div>

    <div className="min-h-0 flex-1 py-[8px]">
      <AnalyticsDonutChart
        segments={entity.segments}
        centerLabel={entity.centerMetricLabel}
        centerValue={entity.centerMetricValue}
        size={270}
        strokeWidth={66}
      />
    </div>

    <div
      className="flex h-[58px] flex-none items-center justify-between rounded-[8px] border px-[15px]"
      style={{
        backgroundColor: entity.footerTint,
        borderColor: entity.footerTint,
        color: entity.footerTextColor,
      }}
    >
      <div className="flex min-w-0 items-center gap-[9px]">
        <AnalyticsIcon name={entity.footerIcon ?? "users"} className="h-[17px] w-[17px] flex-none" stroke={entity.footerTextColor} />
        <div className="truncate text-[12px] font-bold uppercase">{entity.footerLabel}</div>
      </div>
      <div className="flex flex-none items-start pl-[16px]">
        <span className="text-[27px] font-black leading-none" style={{ color: entity.accentColor }}>
          {entity.footerValue}
        </span>
        {entity.footerSuffix ? (
          <span className="ml-[2px] pt-[2px] text-[14px] font-black leading-none" style={{ color: entity.accentColor }}>
            {entity.footerSuffix}
          </span>
        ) : null}
      </div>
    </div>
  </div>
);

export default StructureComparisonCard;
