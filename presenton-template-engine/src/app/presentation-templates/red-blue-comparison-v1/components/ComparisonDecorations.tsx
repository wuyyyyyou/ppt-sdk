import React from "react";

import { redBlueComparisonTheme } from "../theme/tokens.ts";
import ThemeSoftCircle from "./ThemeSoftCircle.tsx";

const coverCircles = [
  { key: "red-large", tone: "red", left: 0, top: 0, size: 300, alpha: 0.08 },
  { key: "red-small", tone: "red", left: 92, top: 438, size: 170, alpha: 0.14 },
  { key: "blue-large", tone: "blue", left: 990, top: 450, size: 260, alpha: 0.08 },
  { key: "blue-small", tone: "blue", left: 984, top: 86, size: 166, alpha: 0.14 },
] as const;

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
