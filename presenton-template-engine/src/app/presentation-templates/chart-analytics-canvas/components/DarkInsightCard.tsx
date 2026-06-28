import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";
import AnalyticsCardShell from "./AnalyticsCardShell.tsx";
import { AnalyticsIcon } from "./AnalyticsIcons.tsx";

type DarkInsightCardProps = {
  label: string;
  title: string;
  text: string;
  icon?: string;
  accentColor?: string;
  className?: string;
};

const DarkInsightCard = ({
  label,
  title,
  text,
  icon = "scale",
  accentColor = "#60A5FA",
  className,
}: DarkInsightCardProps) => (
  <AnalyticsCardShell dark padding={20} className={className}>
    <div className="absolute right-[18px] top-[16px] opacity-[0.08]">
      <AnalyticsIcon name={icon} className="h-[70px] w-[70px]" stroke="#FFFFFF" />
    </div>
    <div className="relative z-[1] flex h-full min-h-0 flex-col justify-center">
      <div className="text-[13px] font-bold uppercase leading-[1.2]" style={{ color: accentColor }}>
        {label}
      </div>
      <div className="mt-[10px] text-[17px] font-bold leading-[1.2]" style={{ color: chartAnalyticsTheme.colors.darkText }}>
        {title}
      </div>
      <div className="mt-[8px] text-[13px] leading-[1.45]" style={{ color: chartAnalyticsTheme.colors.darkMutedText }}>
        {text}
      </div>
    </div>
  </AnalyticsCardShell>
);

export default DarkInsightCard;
