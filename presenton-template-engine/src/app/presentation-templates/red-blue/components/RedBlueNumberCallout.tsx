import React, { type ReactNode } from "react";

import { getToneColor, type RedBlueTone, redBlueTheme } from "../theme/tokens.ts";

type RedBlueNumberCalloutProps = {
  value: string;
  label: string;
  description?: string;
  tone?: RedBlueTone;
  icon?: ReactNode;
};

const RedBlueNumberCallout = ({
  value,
  label,
  description,
  tone = "purple",
  icon,
}: RedBlueNumberCalloutProps) => {
  const color = getToneColor(tone);
  return (
    <div
      className="relative overflow-hidden rounded-[18px] bg-white p-[22px]"
      style={{
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
        style={{ color, fontFamily: redBlueTheme.fonts.heading }}
      >
        {value}
      </div>
      <div className="mt-[10px] text-[16px] font-extrabold" style={{ color: redBlueTheme.colors.backgroundText }}>
        {label}
      </div>
      {description ? (
        <div className="mt-[6px] text-[13px] font-medium leading-[18px]" style={{ color: redBlueTheme.colors.mutedText }}>
          {description}
        </div>
      ) : null}
    </div>
  );
};

export default RedBlueNumberCallout;
