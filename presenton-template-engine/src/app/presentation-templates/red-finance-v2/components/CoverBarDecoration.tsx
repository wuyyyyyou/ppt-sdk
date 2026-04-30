import React from "react";

import { redFinanceTheme } from "../theme/tokens.js";

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
      data-pptx-export="screenshot"
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
            backgroundColor: redFinanceTheme.colors.primary,
            boxShadow: "4px 4px 10px rgba(0,0,0,0.1)",
          }}
        />
      ))}
    </div>
  );
};

export default CoverBarDecoration;
