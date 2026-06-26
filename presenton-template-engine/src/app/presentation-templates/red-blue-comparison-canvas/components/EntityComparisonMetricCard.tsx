import React from "react";

import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";
import CardAccentRail from "./CardAccentRail.tsx";

export type EntityComparisonMetricItem = {
  label: string;
  shortLabel?: string;
  value: string;
  share?: number;
  tone: RedBlueTone;
};

type EntityComparisonMetricCardProps = {
  title: string;
  items: EntityComparisonMetricItem[];
  mode: "rank" | "bar";
  tone?: RedBlueTone;
  height?: number;
};

const clampPercent = (value?: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? Number(value) : 0));

const EntityComparisonMetricCard = ({
  title,
  items,
  mode,
  tone = "purple",
  height = 148,
}: EntityComparisonMetricCardProps) => {
  const toneValue = redBlueComparisonTheme.tone[tone];

  return (
    <div
      className="relative flex min-w-0 flex-col overflow-hidden border bg-white p-[18px]"
      style={{
        height,
        borderRadius: redBlueComparisonTheme.radius.xl,
        borderColor: redBlueComparisonTheme.colors.stroke,
        boxShadow: redBlueComparisonTheme.shadow.card,
      }}
    >
      <CardAccentRail position="left" color={toneValue.color} size={5} />
      <div className="relative z-10 mb-[13px] flex h-[18px] flex-none items-center justify-between gap-[12px]">
        <div className="min-w-0 truncate text-[12px] font-black uppercase tracking-[0.5px]" style={{ color: redBlueComparisonTheme.colors.mutedText }}>
          {title}
        </div>
      </div>

      {mode === "rank" ? (
        <div className="relative z-10 grid min-h-0 flex-1 grid-cols-2 gap-[14px]">
          {items.slice(0, 2).map((item) => {
            const itemTone = redBlueComparisonTheme.tone[item.tone];
            return (
              <div
                key={`${item.label}-${item.value}`}
                className="relative flex min-w-0 flex-col items-center justify-center overflow-hidden rounded-[10px] px-[10px]"
                style={{ backgroundColor: itemTone.tint, color: itemTone.color }}
              >
                <div className="absolute right-[9px] top-[8px] text-[36px] font-black opacity-10">◎</div>
                <div className="text-[11px] font-black uppercase leading-none" style={{ color: redBlueComparisonTheme.colors.mutedText }}>
                  {item.shortLabel ?? item.label}
                </div>
                <div className="mt-[8px] text-[40px] font-black leading-none" style={{ fontFamily: redBlueComparisonTheme.fonts.heading }}>
                  {item.value}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center gap-[12px]">
          {items.slice(0, 3).map((item) => {
            const itemTone = redBlueComparisonTheme.tone[item.tone];
            return (
              <div key={`${item.label}-${item.value}`} className="grid h-[26px] grid-cols-[58px_1fr_74px] items-center gap-[12px]">
                <div className="flex min-w-0 items-center gap-[6px]">
                  <div className="h-[9px] w-[9px] flex-none rounded-full" style={{ backgroundColor: itemTone.color }} />
                  <div className="truncate text-[13px] font-black uppercase" style={{ color: itemTone.color }}>
                    {item.shortLabel ?? item.label}
                  </div>
                </div>
                <div className="h-[12px] overflow-hidden rounded-full" style={{ backgroundColor: redBlueComparisonTheme.colors.neutralTint }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${clampPercent(item.share)}%`,
                      backgroundColor: itemTone.color,
                    }}
                  />
                </div>
                <div className="text-right text-[15px] font-black" style={{ color: itemTone.color }}>
                  {item.value}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EntityComparisonMetricCard;
