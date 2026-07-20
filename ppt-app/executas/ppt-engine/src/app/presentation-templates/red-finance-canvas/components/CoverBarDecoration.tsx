import React from "react";

import { redFinanceTheme } from "../theme/tokens.ts";

const bars = [
  { height: 120, opacity: 0.26 },
  { height: 180, opacity: 0.4 },
  { height: 150, opacity: 0.34 },
  { height: 240, opacity: 0.7 },
  { height: 320, opacity: 1 },
] as const;

const CoverBarDecoration = () => {
  return (
    <div

      aria-hidden="true"
      className="flex h-[360px] w-[280px] items-end gap-[20px]"
    >
      {bars.map((bar, index) => (
        <div
          key={`cover-bar-decoration-${index}`}
          className="w-[40px] rounded-t-[4px]"
          style={{
            height: `${bar.height}px`,
            opacity: bar.opacity,
            backgroundColor: redFinanceTheme.colors.accent,
            boxShadow: redFinanceTheme.shadows.accent,
          }}
        />
      ))}
    </div>
  );
};

export default CoverBarDecoration;
