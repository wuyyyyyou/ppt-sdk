import React from "react";

import { redFinanceTheme } from "../theme/tokens.js";
import { FinanceIcon, type FinanceIconName } from "./FinanceIcons.js";

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
        backgroundColor: redFinanceTheme.colors.primary,
        color: redFinanceTheme.colors.primaryText,
        boxShadow: "0 4px 10px rgba(183, 28, 28, 0.2)",
      }}
    >
      <div
        className="flex flex-none items-center justify-center"
        style={{ width: iconSize, height: iconSize }}
      >
        <FinanceIcon
          name={icon}
          className={iconClassName}
          stroke={redFinanceTheme.colors.primaryText}
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
