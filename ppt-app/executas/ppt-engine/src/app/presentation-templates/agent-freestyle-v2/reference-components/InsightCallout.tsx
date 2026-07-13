import React from "react";

import { theme } from "../theme.ts";
import { FinanceIcon, type FinanceIconName } from "./FinanceIcons.tsx";

type InsightCalloutProps = {
  text: string;
  icon?: FinanceIconName;
  density?: "normal" | "compact" | "dense";
};

const InsightCallout = ({
  text,
  icon = "lightbulb",
  density = "normal",
}: InsightCalloutProps) => {
  const isCompact = density === "compact";
  const isDense = density === "dense";
  const iconSize = isDense ? 18 : isCompact ? 20 : 24;
  const paddingX = isDense ? 14 : isCompact ? 16 : 20;
  const paddingY = isDense ? 8 : isCompact ? 10 : 15;
  const fontSize = isDense ? 12 : isCompact ? 13 : 15;
  const lineHeight = isDense ? 1.25 : isCompact ? 1.3 : 1.4;
  const iconClassName = isDense
    ? "h-[18px] w-[18px]"
    : isCompact
      ? "h-[20px] w-[20px]"
      : "h-[24px] w-[24px]";

  return (
    <div
      className="flex items-center rounded-[6px]"
      style={{
        gap: isDense ? 10 : 15,
        padding: `${paddingY}px ${paddingX}px`,
        backgroundColor: theme.colors.accent,
        color: theme.colors.accentText,
        boxShadow: `0 4px 10px ${theme.shadows.accent}`,
      }}
    >
      <div
        className="flex flex-none items-center justify-center"
        style={{ width: iconSize, height: iconSize }}
      >
        <FinanceIcon
          name={icon}
          className={iconClassName}
          stroke={theme.colors.accentText}
        />
      </div>
      <div
        data-validation-role="multi-line-body-text"
        className="font-medium"
        style={{
          fontSize,
          lineHeight,
          maxHeight: fontSize * lineHeight * (isDense ? 2 : 3),
          overflow: "hidden",
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default InsightCallout;
