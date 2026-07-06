import React from "react";

import { redBlueComparisonTheme } from "../theme/tokens.ts";
import ThemeSoftCircle from "./ThemeSoftCircle.tsx";

const coverCircles = [
  { key: "side-a-large", tone: "sideA", left: 0, top: 0, size: 300, alpha: 0.08 },
  { key: "side-a-small", tone: "sideA", left: 92, top: 438, size: 170, alpha: 0.14 },
  { key: "side-b-large", tone: "sideB", left: 990, top: 450, size: 260, alpha: 0.08 },
  { key: "side-b-small", tone: "sideB", left: 984, top: 86, size: 166, alpha: 0.14 },
] as const;

const balancedContentCircles = [
  { key: "comparison-top-right", tone: "comparison", left: 980, top: -100, size: 350, alpha: 0.03 },
  { key: "side-a-bottom-left", tone: "sideA", left: 20, top: 520, size: 150, alpha: 0.04 },
  { key: "side-b-middle", tone: "sideB", left: 575, top: 150, size: 120, alpha: 0.04 },
] as const;

export const CoverComparisonDecorations = () => {
  return (
    <>
      <div
        className="absolute inset-0 z-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(${redBlueComparisonTheme.colors.grid} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 z-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
        style={{ borderColor: redBlueComparisonTheme.alpha.comparison(0.12) }}
      />
      {coverCircles.map((circle) => (
        <ThemeSoftCircle
          key={circle.key}
          tone={circle.tone}
          left={circle.left}
          top={circle.top}
          size={circle.size}
          alpha={circle.alpha}
        />
      ))}
    </>
  );
};

export const BalancedComparisonDecorations = () => {
  return (
    <>
      {balancedContentCircles.map((circle) => (
        <ThemeSoftCircle
          key={circle.key}
          tone={circle.tone}
          left={circle.left}
          top={circle.top}
          size={circle.size}
          alpha={circle.alpha}
        />
      ))}
    </>
  );
};
