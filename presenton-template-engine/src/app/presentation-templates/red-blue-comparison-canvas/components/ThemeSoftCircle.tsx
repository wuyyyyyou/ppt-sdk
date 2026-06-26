import React from "react";

import { type RedBlueTone } from "../theme/tokens.ts";

type ThemeSoftCircleProps = {
  tone?: RedBlueTone;
  left: number;
  top: number;
  size: number;
  alpha?: number;
  className?: string;
  fillColor?: string;
};

const rgbaByTone: Record<RedBlueTone, string> = {
  red: "255,71,87",
  blue: "46,134,222",
  purple: "80,56,166",
  neutral: "45,52,54",
};

const ThemeSoftCircle = ({
  tone = "purple",
  left,
  top,
  size,
  alpha = 0.08,
  className,
  fillColor,
}: ThemeSoftCircleProps) => {
  const boundedAlpha = Math.max(0, Math.min(1, alpha));

  return (
    <div
      className={["absolute z-[1] rounded-full", className].filter(Boolean).join(" ")}
      data-theme-soft-circle={tone}
      style={{
        left,
        top,
        width: size,
        height: size,
        backgroundColor: fillColor ?? `rgba(${rgbaByTone[tone]},${boundedAlpha})`,
      }}
    />
  );
};

export default ThemeSoftCircle;
