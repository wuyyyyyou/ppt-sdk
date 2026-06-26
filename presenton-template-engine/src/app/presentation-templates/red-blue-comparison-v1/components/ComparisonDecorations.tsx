import React from "react";

import { redBlueComparisonTheme } from "../theme/tokens.ts";

type Tone = "red" | "blue" | "purple";

type CircleSpec = {
  key: string;
  tone: Tone;
  className: string;
  opacity: number;
};

const toneColor: Record<Tone, string> = {
  red: redBlueComparisonTheme.colors.chinaRed,
  blue: redBlueComparisonTheme.colors.japanBlue,
  purple: redBlueComparisonTheme.colors.primary,
};

const coverCircles: CircleSpec[] = [
  { key: "red-large", tone: "red", className: "left-[-112px] top-[-104px] h-[410px] w-[410px]", opacity: 0.08 },
  { key: "red-small", tone: "red", className: "bottom-[92px] left-[80px] h-[190px] w-[190px]", opacity: 0.14 },
  { key: "blue-large", tone: "blue", className: "bottom-[-150px] right-[-108px] h-[460px] w-[460px]", opacity: 0.08 },
  { key: "blue-small", tone: "blue", className: "right-[120px] top-[78px] h-[180px] w-[180px]", opacity: 0.14 },
  { key: "purple-mid", tone: "purple", className: "left-[560px] top-[112px] h-[120px] w-[120px]", opacity: 0.08 },
];

export const CoverComparisonDecorations = () => {
  return (
    <>
      <div
        className="absolute inset-0 z-0 opacity-30"
        style={{
          backgroundImage: "radial-gradient(#DFE6E9 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 z-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
        style={{ borderColor: "rgba(80,56,166,0.12)" }}
      />
      {coverCircles.map((circle) => (
        <div
          key={circle.key}
          className={`absolute z-[1] rounded-full ${circle.className}`}
          style={{ backgroundColor: toneColor[circle.tone], opacity: circle.opacity }}
        />
      ))}
    </>
  );
};
