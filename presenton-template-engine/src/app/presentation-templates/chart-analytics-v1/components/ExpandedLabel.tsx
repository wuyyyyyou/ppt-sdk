import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";

type ExpandedLabelProps = {
  text: string;
  color?: string;
  fontSize?: number;
  underline?: boolean;
};

const toExpandedText = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .map((word) => word.split("").join(" "))
    .join("   ");

const ExpandedLabel = ({
  text,
  color = chartAnalyticsTheme.colors.primary,
  fontSize = 16,
  underline = true,
}: ExpandedLabelProps) => {
  return (
    <div className={underline ? "border-b pb-[12px]" : ""} style={{ borderColor: "rgba(59,130,246,0.5)" }}>
      <div
        className="whitespace-nowrap text-center font-black uppercase leading-none"
        style={{
          color,
          fontFamily: chartAnalyticsTheme.fonts.display,
          fontSize,
        }}
      >
        {toExpandedText(text)}
      </div>
    </div>
  );
};

export default ExpandedLabel;
