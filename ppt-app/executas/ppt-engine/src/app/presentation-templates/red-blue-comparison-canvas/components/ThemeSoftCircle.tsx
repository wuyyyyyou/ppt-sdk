import React from "react";

import { redBlueComparisonTheme, type ComparisonTone } from "../theme/tokens.ts";

type ThemeSoftCircleProps = {
  tone?: ComparisonTone;
  left: number;
  top: number;
  size: number;
  alpha?: number;
  className?: string;
  fillColor?: string;
};

const alphaByTone: Record<ComparisonTone, (opacity: number) => string> = {
  sideA: redBlueComparisonTheme.alpha.sideA,
  sideB: redBlueComparisonTheme.alpha.sideB,
  comparison: redBlueComparisonTheme.alpha.comparison,
  neutral: redBlueComparisonTheme.alpha.neutral,
};

const ThemeSoftCircle = ({
  tone = "comparison",
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
        backgroundColor: fillColor ?? alphaByTone[tone](boundedAlpha),
      }}
    />
  );
};

export default ThemeSoftCircle;
