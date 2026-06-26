import React, { type ReactNode } from "react";

import { redBlueComparisonTheme } from "../theme/tokens.ts";

type ThemeCanvasProps = {
  children: ReactNode;
  className?: string;
  showGrid?: boolean;
  backgroundColor?: string;
};

const ThemeCanvas = ({
  children,
  className,
  showGrid = false,
  backgroundColor = redBlueComparisonTheme.colors.background,
}: ThemeCanvasProps) => {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@600;700;800;900&family=Noto+Sans+SC:wght@400;500;700;900&display=swap"
        rel="stylesheet"
      />
      <div
        className={["relative overflow-hidden", className].filter(Boolean).join(" ")}
        style={{
          width: redBlueComparisonTheme.size.slideWidth,
          height: redBlueComparisonTheme.size.slideHeight,
          backgroundColor,
          color: redBlueComparisonTheme.colors.backgroundText,
          fontFamily: redBlueComparisonTheme.fonts.body,
        }}
      >
        {showGrid ? (
          <div
            className="absolute inset-0 z-0 opacity-30"
            style={{
              backgroundImage: `radial-gradient(${redBlueComparisonTheme.colors.softGrid} 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />
        ) : null}
        {children}
      </div>
    </>
  );
};

export default ThemeCanvas;
