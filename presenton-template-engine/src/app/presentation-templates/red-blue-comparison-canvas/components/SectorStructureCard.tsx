import React from "react";

import { redBlueComparisonTheme, type ComparisonTone } from "../theme/tokens.ts";
import CardAccentRail from "./CardAccentRail.tsx";
import SectorDonutChart, { type SectorDonutSegment } from "./SectorDonutChart.tsx";

export type SectorStructureInsight = {
  title: string;
  description: string;
};

type SectorStructureCardProps = {
  entityName: string;
  badge: string;
  tone: ComparisonTone;
  segments: SectorDonutSegment[];
  centerValue: string;
  centerLabel: string;
  insight: SectorStructureInsight;
};

const SectorStructureCard = ({
  entityName,
  badge,
  tone,
  segments,
  centerValue,
  centerLabel,
  insight,
}: SectorStructureCardProps) => {
  const toneValue = redBlueComparisonTheme.tone[tone];

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden border px-[30px] pb-[24px] pt-[25px]"
      style={{
        borderRadius: 20,
        backgroundColor: redBlueComparisonTheme.colors.card,
        borderColor: redBlueComparisonTheme.colors.neutralBorder,
        boxShadow: redBlueComparisonTheme.shadow.panel,
      }}
    >
      <CardAccentRail position="top" color={toneValue.color} size={6} />

      <div className="relative z-10 mb-[14px] flex h-[34px] flex-none items-center justify-between gap-[16px]">
        <div
          className="min-w-0 break-words text-[24px] font-black uppercase leading-none"
          style={{ color: toneValue.color, fontFamily: redBlueComparisonTheme.fonts.heading }}
        >
          {entityName}
        </div>
        <div
          className="flex h-[28px] flex-none items-center rounded-full px-[12px] text-[12px] font-bold"
          style={{ backgroundColor: redBlueComparisonTheme.colors.neutralTint, color: redBlueComparisonTheme.colors.textMuted }}
        >
          {badge}
        </div>
      </div>

      <div className="relative z-10 min-h-0 flex-1">
        <SectorDonutChart
          segments={segments}
          centerValue={centerValue}
          centerLabel={centerLabel}
          size={250}
          strokeWidth={44}
        />
      </div>

      <div className="relative z-10 mt-[13px] flex h-[24px] flex-none items-center justify-center gap-[12px]">
        {segments.map((segment) => (
          <div key={segment.label} className="flex min-w-0 items-center gap-[6px] text-[11px] font-bold" style={{ color: redBlueComparisonTheme.colors.textMuted }}>
            <div className="h-[10px] w-[10px] flex-none rounded-[3px]" style={{ backgroundColor: segment.color }} />
            <div className="break-words">{segment.label}</div>
          </div>
        ))}
      </div>

      <div
        className="relative z-10 mt-[14px] flex-none px-[15px] py-[13px]"
        style={{
          minHeight: 82,
          borderRadius: 12,
          backgroundColor: redBlueComparisonTheme.colors.neutralTint,
        }}
      >
        <CardAccentRail position="left" color={toneValue.color} size={4} />
        <div className="text-[14px] font-black leading-[1.25]" style={{ color: toneValue.color }}>
          {insight.title}
        </div>
        <div className="mt-[5px] overflow-hidden text-[13px] font-medium leading-[1.4]" style={{ maxHeight: 38, color: redBlueComparisonTheme.colors.textPrimary }}>
          {insight.description}
        </div>
      </div>
    </div>
  );
};

export default SectorStructureCard;
