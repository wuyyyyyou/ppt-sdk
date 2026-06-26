import React, { type ReactNode } from "react";

import { redBlueComparisonTheme } from "../theme/tokens.ts";

type ComparisonCanvasProps = {
  children: ReactNode;
};

const ComparisonCanvas = ({ children }: ComparisonCanvasProps) => {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@600;700;800;900&family=Noto+Sans+SC:wght@400;500;700;900&display=swap"
        rel="stylesheet"
      />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden"
        style={{
          backgroundColor: redBlueComparisonTheme.colors.background,
          color: redBlueComparisonTheme.colors.backgroundText,
          fontFamily: redBlueComparisonTheme.fonts.body,
        }}
      >
        {children}
      </div>
    </>
  );
};

export default ComparisonCanvas;
