import React from "react";

import { redBlueComparisonTheme, type ComparisonTone } from "../theme/tokens.ts";
import CardAccentRail from "./CardAccentRail.tsx";

export type AgendaTopicIconName =
  | "chart-line"
  | "users"
  | "microchip"
  | "exchange"
  | "landmark"
  | "culture"
  | "globe"
  | "strategy";

type AgendaTopicIconProps = {
  name: AgendaTopicIconName;
  className?: string;
};

export const AgendaTopicIcon = ({ name, className }: AgendaTopicIconProps) => {
  const shared = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "chart-line") {
    return (
      <svg {...shared}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="m7 15 4-4 3 3 5-7" />
      </svg>
    );
  }

  if (name === "users") {
    return (
      <svg {...shared}>
        <path d="M16 20v-2a4 4 0 0 0-8 0v2" />
        <circle cx="12" cy="8" r="4" />
        <path d="M22 20v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 4.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }

  if (name === "microchip") {
    return (
      <svg {...shared}>
        <rect x="7" y="7" width="10" height="10" rx="2" />
        <path d="M9 1v3" />
        <path d="M15 1v3" />
        <path d="M9 20v3" />
        <path d="M15 20v3" />
        <path d="M20 9h3" />
        <path d="M20 15h3" />
        <path d="M1 9h3" />
        <path d="M1 15h3" />
      </svg>
    );
  }

  if (name === "exchange") {
    return (
      <svg {...shared}>
        <path d="M7 7h13" />
        <path d="m16 3 4 4-4 4" />
        <path d="M17 17H4" />
        <path d="m8 13-4 4 4 4" />
      </svg>
    );
  }

  if (name === "landmark") {
    return (
      <svg {...shared}>
        <path d="m3 10 9-6 9 6" />
        <path d="M5 10h14" />
        <path d="M6 10v8" />
        <path d="M10 10v8" />
        <path d="M14 10v8" />
        <path d="M18 10v8" />
        <path d="M4 18h16" />
        <path d="M3 21h18" />
      </svg>
    );
  }

  if (name === "culture") {
    return (
      <svg {...shared}>
        <path d="M12 3v18" />
        <path d="M5 7h14" />
        <path d="M7 7c0 5 2 8 5 9" />
        <path d="M17 7c0 5-2 8-5 9" />
        <path d="M8 21h8" />
      </svg>
    );
  }

  if (name === "strategy") {
    return (
      <svg {...shared}>
        <path d="M4 20V5" />
        <path d="M4 5h12l-2 4 2 4H4" />
        <path d="M8 20h8" />
      </svg>
    );
  }

  return (
    <svg {...shared}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
};

type AgendaTopicCardProps = {
  number: string;
  title: string;
  description: string;
  iconName: AgendaTopicIconName;
  tone?: ComparisonTone;
};

const AgendaTopicCard = ({
  number,
  title,
  description,
  iconName,
  tone = "comparison",
}: AgendaTopicCardProps) => {
  const toneValue = redBlueComparisonTheme.tone[tone];

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden border px-[24px] pb-[18px] pt-[24px]"
      style={{
        borderRadius: redBlueComparisonTheme.radius.xl,
        borderColor: redBlueComparisonTheme.colors.neutralBorder,
        backgroundColor: redBlueComparisonTheme.colors.card,
        boxShadow: redBlueComparisonTheme.shadow.card,
      }}
    >
      <CardAccentRail position="top" color={toneValue.color} size={5} />
      <div
        className="absolute right-[18px] top-[14px] z-10 select-none text-[48px] font-black leading-none"
        style={{
          color: redBlueComparisonTheme.alpha.textPrimary(0.035),
          fontFamily: redBlueComparisonTheme.fonts.heading,
        }}
      >
        {number}
      </div>

      <div
        className="relative z-10 mb-[16px] flex h-[44px] w-[44px] flex-none items-center justify-center rounded-[10px]"
        style={{ backgroundColor: toneValue.tint, color: toneValue.color }}
      >
        <AgendaTopicIcon name={iconName} className="h-[22px] w-[22px]" />
      </div>

      <div
        className="relative z-10 min-w-0 overflow-hidden text-[20px] font-black leading-[1.18]"
        style={{
          maxHeight: 48,
          color: redBlueComparisonTheme.colors.textPrimary,
          fontFamily: redBlueComparisonTheme.fonts.heading,
        }}
      >
        {title}
      </div>
      <div
        className="relative z-10 mt-[8px] min-w-0 overflow-hidden text-[14px] font-medium leading-[1.5]"
        style={{ maxHeight: 64, color: redBlueComparisonTheme.colors.textMuted }}
      >
        {description}
      </div>
    </div>
  );
};

export default AgendaTopicCard;
