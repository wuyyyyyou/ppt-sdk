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
            <div
              key={`${row.label}-${row.value}`}
              className="grid items-center gap-[10px]"
              style={{ gridTemplateColumns: "minmax(104px, 0.82fr) minmax(84px, 1fr) 58px" }}
            >
              <div className="flex min-w-0 items-center gap-[7px] text-[13px] font-extrabold leading-[15px]" style={{ color }}>
                <span className="h-[10px] w-[10px] flex-none rounded-full" style={{ backgroundColor: color }} />
                <span className="min-w-0 whitespace-normal break-words">{row.label}</span>
              </div>
              <div className="h-[12px] flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "#F1F2F6" }}>
                <div className="h-full rounded-full" style={{ width: `${clampShare(row.share)}%`, backgroundColor: color }} />
              </div>
              <div className="text-right text-[14px] font-black" style={{ color }}>
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
