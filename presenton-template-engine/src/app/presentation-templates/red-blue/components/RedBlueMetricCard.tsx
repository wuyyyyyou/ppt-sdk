import React from "react";

import { getToneColor, type RedBlueTone, redBlueTheme } from "../theme/tokens.ts";

export type RedBlueMetricRow = {
  label: string;
  value: string;
  share?: number;
  tone?: RedBlueTone;
};

type RedBlueMetricCardProps = {
  title: string;
  rows: RedBlueMetricRow[];
  accentTone?: RedBlueTone;
};

const clampShare = (value: number | undefined) =>
  Math.max(0, Math.min(100, Number.isFinite(value ?? NaN) ? value ?? 0 : 0));

const RedBlueMetricCard = ({
  title,
  rows,
  accentTone = "purple",
}: RedBlueMetricCardProps) => {
  return (
    <div
      className="rounded-[14px] bg-white p-[18px]"
      style={{
        borderLeft: `5px solid ${getToneColor(accentTone)}`,
        boxShadow: `0 4px 18px ${redBlueTheme.colors.shadow}`,
      }}
    >
      <div
        className="mb-[12px] text-[13px] font-extrabold uppercase tracking-[0.5px]"
        style={{ color: redBlueTheme.colors.mutedText }}
      >
        {title}
      </div>
      <div className="grid gap-[9px]">
        {rows.map((row) => {
          const color = getToneColor(row.tone ?? "neutral");
          return (
            <div key={`${row.label}-${row.value}`} className="flex items-center gap-[12px]">
              <div className="flex w-[78px] items-center gap-[7px] text-[14px] font-extrabold" style={{ color }}>
                <span className="h-[10px] w-[10px] rounded-full" style={{ backgroundColor: color }} />
                {row.label}
              </div>
              <div className="h-[12px] flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "#F1F2F6" }}>
                <div className="h-full rounded-full" style={{ width: `${clampShare(row.share)}%`, backgroundColor: color }} />
              </div>
              <div className="w-[84px] text-right text-[16px] font-black" style={{ color }}>
                {row.value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RedBlueMetricCard;
