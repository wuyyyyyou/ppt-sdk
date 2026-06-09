import React, { type ReactNode } from "react";

import { getToneColor, type RedBlueTone, redBlueTheme } from "../theme/tokens.ts";

type RedBlueNumberCalloutProps = {
  value: string;
  label: string;
  description?: string;
  tone?: RedBlueTone;
  icon?: ReactNode;
  density?: "normal" | "compact";
};

const RedBlueNumberCallout = ({
  value,
  label,
  description,
  tone = "purple",
  icon,
  density = "normal",
}: RedBlueNumberCalloutProps) => {
  const color = getToneColor(tone);
  const compact = density === "compact";
  return (
    <div
      className="relative overflow-hidden rounded-[18px] bg-white"
      style={{
        padding: compact ? 16 : 22,
        border: `1px solid ${redBlueTheme.colors.softStroke}`,
        boxShadow: `0 8px 24px ${redBlueTheme.colors.shadow}`,
      }}
    >
      {icon ? (
        <div className="absolute right-[16px] top-[14px] text-[38px]" style={{ color, opacity: 0.12 }}>
          {icon}
        </div>
      ) : null}
      <div
        className="text-[52px] font-black leading-none"
        style={{
          color,
          fontFamily: redBlueTheme.fonts.heading,
          fontSize: compact ? 38 : 52,
        }}
      >
        {value}
      </div>
      <div
        className="font-extrabold"
        style={{
          color: redBlueTheme.colors.backgroundText,
          fontSize: compact ? 14 : 16,
          marginTop: compact ? 8 : 10,
        }}
      >
        {label}
      </div>
      {description ? (
        <div
          className="font-medium"
          style={{
            color: redBlueTheme.colors.mutedText,
            fontSize: compact ? 11 : 13,
            lineHeight: compact ? "15px" : "18px",
            marginTop: compact ? 5 : 6,
          }}
        >
          {description}
        </div>
      ) : null}
    </div>
  );
};

export default RedBlueNumberCallout;
