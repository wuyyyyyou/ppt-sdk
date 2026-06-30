import React from "react";

import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";
import CardAccentRail from "./CardAccentRail.tsx";

type StrategicInsightIconName = "lightbulb" | "microscope" | "target";

type StrategicInsightCardProps = {
  title: string;
  text: string;
  icon?: StrategicInsightIconName;
  tone?: RedBlueTone;
  height?: number;
};

const iconPath = {
  lightbulb: (
    <>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M8 14a6 6 0 1 1 8 0c-.8.7-1 1.6-1 2H9c0-.4-.2-1.3-1-2Z" />
    </>
  ),
  microscope: (
    <>
      <path d="M6 18h8" />
      <path d="M3 22h18" />
      <path d="M14 22a7 7 0 0 0 7-7" />
      <path d="m9 14 6-6" />
      <path d="m7 12 4 4" />
      <path d="m12 3 4 4-2 2-4-4 2-2Z" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </>
  ),
} satisfies Record<StrategicInsightIconName, React.ReactNode>;

const StrategicInsightIcon = ({ name }: { name: StrategicInsightIconName }) => (
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

const StrategicInsightCard = ({
  title,
  text,
  icon = "lightbulb",
  tone = "purple",
  height = 152,
}: StrategicInsightCardProps) => {
  const toneValue = redBlueComparisonTheme.tone[tone];
  const paddingY = 17;
  const titleHeight = 20;
  const titleMarginBottom = 8;
  const textMaxHeight = Math.max(40, height - paddingY * 2 - titleHeight - titleMarginBottom);

  return (
    <div
      className="relative flex min-w-0 flex-col overflow-hidden border px-[20px]"
      style={{
        height,
        paddingTop: paddingY,
        paddingBottom: paddingY,
        borderRadius: redBlueComparisonTheme.radius.xl,
        borderColor: toneValue.border,
        backgroundColor: redBlueComparisonTheme.colors.neutralTint,
        boxShadow: redBlueComparisonTheme.shadow.card,
      }}
    >
      <CardAccentRail position="left" color={toneValue.color} size={5} />
      <div
        className="mb-[8px] flex h-[20px] flex-none items-center gap-[8px] break-words text-[14px] font-black uppercase"
        style={{ color: toneValue.color, fontFamily: redBlueComparisonTheme.fonts.heading }}
      >
        <StrategicInsightIcon name={icon} />
        <span className="break-words">{title}</span>
      </div>
      <div
        data-validation-role="multi-line-body-text"
        className="overflow-hidden text-[13px] font-medium leading-[1.46]"
        style={{
          color: redBlueComparisonTheme.colors.backgroundText,
          maxHeight: textMaxHeight,
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default StrategicInsightCard;
