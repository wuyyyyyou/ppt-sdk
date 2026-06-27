import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";
import AnalyticsCardShell from "./AnalyticsCardShell.tsx";
import { AnalyticsIcon } from "./AnalyticsIcons.tsx";

type SummaryOutcomeCardProps = {
  title: string;
  text: string;
  icon: string;
  accentColor: string;
  iconTint?: string;
  tags?: string[];
  kicker?: string;
  dark?: boolean;
};

const SummaryOutcomeCard = ({
  title,
  text,
  icon,
  accentColor,
  iconTint = "#F0FDFA",
  tags = [],
  kicker,
  dark = false,
}: SummaryOutcomeCardProps) => (
  <AnalyticsCardShell dark={dark} padding={24} className={dark ? "" : "border-l-[4px]"}>
    {!dark ? <div className="absolute bottom-0 left-0 top-0 w-[4px]" style={{ backgroundColor: accentColor }} /> : null}

    <div className="relative z-[1] flex h-full min-h-0 items-center gap-[18px]">
      <div
        className="flex h-[48px] w-[48px] flex-none items-center justify-center rounded-[12px] border"
        style={{
          backgroundColor: dark ? "#334155" : iconTint,
          borderColor: dark ? "#475569" : "transparent",
        }}
      >
        <AnalyticsIcon name={icon} className="h-[22px] w-[22px]" stroke={dark ? accentColor : accentColor} />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="m-0 text-[18px] font-bold leading-[1.15]" style={{ color: dark ? "#FFFFFF" : "#1E293B" }}>
          {title}
        </h3>
        <p className="m-0 mt-[9px] text-[13px] leading-[1.38]" style={{ color: dark ? "#CBD5E1" : chartAnalyticsTheme.colors.subtleText }}>
          {text}
        </p>

        {tags.length > 0 ? (
          <div className="mt-[12px] flex flex-wrap gap-[8px]">
            {tags.map((tag) => (
              <span key={tag} className="rounded-[5px] px-[9px] py-[5px] text-[11px] font-semibold" style={{ backgroundColor: "#F1F5F9", color: "#64748B" }}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {kicker ? (
          <div className="mt-[10px] text-[11px] font-bold uppercase leading-[1.2]" style={{ color: accentColor }}>
            {kicker}
          </div>
        ) : null}
      </div>
    </div>
  </AnalyticsCardShell>
);

export default SummaryOutcomeCard;
