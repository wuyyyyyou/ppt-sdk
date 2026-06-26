import React, { type ReactNode } from "react";

import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";
import CardAccentRail, { type CardAccentRailPosition } from "./CardAccentRail.tsx";

type ThemeCardProps = {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  eyebrow?: ReactNode;
  children?: ReactNode;
  tone?: RedBlueTone;
  height?: number | string;
  minHeight?: number;
  padding?: number;
  rail?: "none" | CardAccentRailPosition;
  railColor?: string;
  railSize?: number;
  className?: string;
};

const ThemeCard = ({
  title,
  description,
  icon,
  eyebrow,
  children,
  tone = "purple",
  height,
  minHeight,
  padding = 20,
  rail = "top",
  railColor,
  railSize = 5,
  className,
}: ThemeCardProps) => {
  const toneValue = redBlueComparisonTheme.tone[tone];
  const resolvedRailColor = railColor ?? toneValue.color;

  return (
    <div
      className={["relative flex min-w-0 flex-col overflow-hidden border", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        height,
        minHeight,
        padding,
        borderRadius: redBlueComparisonTheme.radius.xl,
        borderColor: toneValue.border,
        backgroundColor: redBlueComparisonTheme.colors.card,
        boxShadow: redBlueComparisonTheme.shadow.card,
      }}
    >
      {rail !== "none" ? (
        <CardAccentRail position={rail} color={resolvedRailColor} size={railSize} />
      ) : null}

      <div className="relative z-10 flex min-w-0 items-start gap-[14px]" style={{ paddingTop: rail === "top" ? 4 : 0 }}>
        {icon ? (
          <div
            className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-[10px]"
            style={{ backgroundColor: toneValue.tint, color: toneValue.color }}
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <div
              className="mb-[5px] truncate text-[11px] font-black uppercase leading-none"
              style={{ color: toneValue.color }}
            >
              {eyebrow}
            </div>
          ) : null}
          {title ? (
            <div
              className="min-w-0 overflow-hidden text-[18px] font-black leading-[1.22]"
              style={{ maxHeight: 44, color: redBlueComparisonTheme.colors.backgroundText }}
            >
              {title}
            </div>
          ) : null}
          {description ? (
            <div
              className="mt-[8px] overflow-hidden text-[13px] font-medium leading-[1.45]"
              style={{ maxHeight: 58, color: redBlueComparisonTheme.colors.mutedText }}
            >
              {description}
            </div>
          ) : null}
        </div>
      </div>

      {children ? <div className="relative z-10 mt-[14px] min-h-0 flex-1">{children}</div> : null}
    </div>
  );
};

export default ThemeCard;
