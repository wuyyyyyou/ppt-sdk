import React from "react";

import { redBlueComparisonTheme, type ComparisonTone } from "../theme/tokens.ts";

export type ComparativeMetricIconName =
  | "certificate"
  | "flask"
  | "graduation-cap"
  | "microchip"
  | "rocket";

export type ComparativeMetricValue = {
  value: string;
  sublabel: string;
  tone?: ComparisonTone;
};

type ComparativeMetricRowProps = {
  label: string;
  icon: ComparativeMetricIconName;
  values: ComparativeMetricValue[];
  height?: number;
};

const iconPath = {
  certificate: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="m9 14-1 7 4-2 4 2-1-7" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6" />
      <path d="M10 3v5l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V3" />
      <path d="M8 15h8" />
    </>
  ),
  "graduation-cap": (
    <>
      <path d="M3 9 12 4l9 5-9 5-9-5Z" />
      <path d="M7 12v4c3 2 7 2 10 0v-4" />
      <path d="M21 9v6" />
    </>
  ),
  microchip: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
    </>
  ),
  rocket: (
    <>
      <path d="M4 13c2-5 6-8 13-9 1 7-4 12-9 13l-4-4Z" />
      <path d="M13 5h6v6" />
      <path d="M6 15 4 21l6-2" />
      <circle cx="14" cy="10" r="2" />
    </>
  ),
} satisfies Record<ComparativeMetricIconName, React.ReactNode>;

const MetricIcon = ({ name }: { name: ComparativeMetricIconName }) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={15}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={15}
  >
    {iconPath[name]}
  </svg>
);

const ComparativeMetricRow = ({
  label,
  icon,
  values,
  height = 64,
}: ComparativeMetricRowProps) => {
  return (
    <div
      className="grid min-w-0 items-center border px-[16px]"
      style={{
        height,
        gridTemplateColumns: "1.05fr 1.35fr",
        borderRadius: redBlueComparisonTheme.radius.xl,
        backgroundColor: redBlueComparisonTheme.colors.card,
        borderColor: redBlueComparisonTheme.colors.neutralBorder,
        boxShadow: redBlueComparisonTheme.shadow.card,
      }}
    >
      <div className="flex min-w-0 items-center gap-[10px]">
        <div
          className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[7px]"
          style={{
            backgroundColor: redBlueComparisonTheme.colors.comparisonTint,
            color: redBlueComparisonTheme.colors.comparison,
          }}
        >
          <MetricIcon name={icon} />
        </div>
        <div
          className="min-w-0 overflow-hidden text-[13px] font-bold leading-[1.15]"
          style={{
            color: redBlueComparisonTheme.colors.textMuted,
            maxHeight: 32,
          }}
        >
          {label}
        </div>
      </div>

      <div
        className="grid min-w-0"
        style={{
          gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))`,
          gap: 16,
        }}
      >
        {values.map((entry, index) => {
          const tone = entry.tone ?? (index === 0 ? "sideA" : "sideB");
          const toneValue = redBlueComparisonTheme.tone[tone];

          return (
            <div key={`${entry.value}-${index}`} className="min-w-0 text-right">
              <div
                className="break-words text-[16px] font-black leading-[1.1]"
                style={{
                  color: toneValue.color,
                  fontFamily: redBlueComparisonTheme.fonts.heading,
                }}
              >
                {entry.value}
              </div>
              <div
                className="mt-[3px] break-words text-[10px] font-semibold leading-none"
                style={{ color: redBlueComparisonTheme.colors.textSubtle }}
              >
                {entry.sublabel}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ComparativeMetricRow;
