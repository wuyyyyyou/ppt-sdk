import React from "react";

import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";
import CardAccentRail from "./CardAccentRail.tsx";

type InsightIconName = "flag" | "lightbulb" | "users" | "trend";

export type InsightMetricCardProps = {
  label: string;
  value?: string;
  description: string;
  tone?: RedBlueTone;
  icon?: InsightIconName;
  height?: number;
  emphasis?: "metric" | "conclusion";
};

const iconPath = {
  flag: (
    <>
      <path d="M5 20V4" />
      <path d="M5 5h12l-2 4 2 4H5" />
    </>
  ),
  lightbulb: (
    <>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M8 14a6 6 0 1 1 8 0c-.8.7-1 1.6-1 2H9c0-.4-.2-1.3-1-2Z" />
    </>
  ),
  users: (
    <>
      <path d="M16 20v-2a4 4 0 0 0-8 0v2" />
      <circle cx="12" cy="8" r="4" />
      <path d="M22 20v-2a4 4 0 0 0-3-3.8" />
      <path d="M16 4.2a4 4 0 0 1 0 7.6" />
    </>
  ),
  trend: (
    <>
      <path d="m4 17 6-6 4 4 6-8" />
      <path d="M14 7h6v6" />
    </>
  ),
} satisfies Record<InsightIconName, React.ReactNode>;

const InsightIcon = ({ name }: { name: InsightIconName }) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={18}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={18}
  >
    {iconPath[name]}
  </svg>
);

const InsightMetricCard = ({
  label,
  value,
  description,
  tone = "purple",
  icon = "flag",
  height = 138,
  emphasis = "metric",
}: InsightMetricCardProps) => {
  const toneValue = redBlueComparisonTheme.tone[tone];
  const isConclusion = emphasis === "conclusion";

  return (
    <div
      className="relative flex min-w-0 flex-col overflow-hidden border px-[20px] py-[18px]"
      style={{
        height,
        borderRadius: redBlueComparisonTheme.radius.xl,
        borderColor: isConclusion ? toneValue.border : "rgba(45,52,54,0.05)",
        backgroundColor: isConclusion ? toneValue.tint : redBlueComparisonTheme.colors.neutralTint,
        boxShadow: isConclusion ? "none" : redBlueComparisonTheme.shadow.card,
      }}
    >
      {isConclusion ? null : <CardAccentRail position="left" color={toneValue.color} size={5} />}
      <div className="relative z-10 mb-[8px] flex h-[22px] flex-none items-center justify-between gap-[12px]">
        <div className="min-w-0 break-words text-[12px] font-black uppercase" style={{ color: redBlueComparisonTheme.colors.mutedText }}>
          {label}
        </div>
        <div className="flex h-[24px] w-[24px] flex-none items-center justify-center" style={{ color: toneValue.color }}>
          <InsightIcon name={icon} />
        </div>
      </div>

      {value ? (
        <div
          className="relative z-10 mb-[8px] break-words text-[34px] font-black leading-none"
          style={{ color: redBlueComparisonTheme.colors.backgroundText, fontFamily: redBlueComparisonTheme.fonts.heading }}
        >
          {value}
        </div>
      ) : null}

      <div
        className="relative z-10 overflow-hidden text-[13px] font-medium leading-[1.45]"
        style={{
          color: redBlueComparisonTheme.colors.backgroundText,
          maxHeight: isConclusion ? 68 : 58,
        }}
      >
        {description}
      </div>
    </div>
  );
};

export default InsightMetricCard;
