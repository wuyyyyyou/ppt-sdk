import React from "react";

import { redBlueComparisonTheme, type ComparisonTone } from "../theme/tokens.ts";
import CardAccentRail from "./CardAccentRail.tsx";

export type TrendInsightIconName = "trend" | "decline" | "outlook" | "users";

type TrendInsightCardProps = {
  title: string;
  value: string;
  description: string;
  tone?: ComparisonTone;
  icon?: TrendInsightIconName;
  height?: number;
};

const iconPath = {
  trend: (
    <>
      <path d="m4 17 6-6 4 4 6-8" />
      <path d="M14 7h6v6" />
    </>
  ),
  decline: (
    <>
      <path d="m4 7 6 6 4-4 6 8" />
      <path d="M14 17h6v-6" />
    </>
  ),
  outlook: (
    <>
      <circle cx="8" cy="11" r="3" />
      <circle cx="16" cy="11" r="3" />
      <path d="M2 11h3" />
      <path d="M11 11h2" />
      <path d="M19 11h3" />
      <path d="M8 14v5" />
      <path d="M16 14v5" />
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
} satisfies Record<TrendInsightIconName, React.ReactNode>;

const TrendInsightIcon = ({ name }: { name: TrendInsightIconName }) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={20}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={20}
  >
    {iconPath[name]}
  </svg>
);

const TrendInsightCard = ({
  title,
  value,
  description,
  tone = "comparison",
  icon = "trend",
  height = 142,
}: TrendInsightCardProps) => {
  const toneValue = redBlueComparisonTheme.tone[tone];

  return (
    <div
      className="relative flex min-w-0 flex-col overflow-hidden border px-[20px] py-[16px]"
      style={{
        height,
        borderRadius: redBlueComparisonTheme.radius.xl,
        backgroundColor: redBlueComparisonTheme.colors.card,
        borderColor: redBlueComparisonTheme.colors.neutralBorder,
        boxShadow: redBlueComparisonTheme.shadow.card,
      }}
    >
      <CardAccentRail position="left" color={toneValue.color} size={5} />
      <div className="absolute right-[18px] top-[18px] opacity-[0.18]" style={{ color: toneValue.color }}>
        <TrendInsightIcon name={icon} />
      </div>
      <div
        className="relative z-10 mb-[6px] max-w-[178px] break-words text-[13px] font-black uppercase"
        style={{ color: toneValue.color, fontFamily: redBlueComparisonTheme.fonts.heading }}
      >
        {title}
      </div>
      <div
        className="relative z-10 mb-[7px] break-words text-[28px] font-black leading-none"
        style={{ color: toneValue.color, fontFamily: redBlueComparisonTheme.fonts.heading }}
      >
        {value}
      </div>
      <div
        className="relative z-10 overflow-hidden text-[12px] font-medium leading-[1.35]"
        style={{ color: redBlueComparisonTheme.colors.textMuted, maxHeight: 66 }}
      >
        {description}
      </div>
    </div>
  );
};

export default TrendInsightCard;
