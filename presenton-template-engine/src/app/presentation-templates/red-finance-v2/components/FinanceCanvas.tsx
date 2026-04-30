import React, { type ReactNode } from "react";

import { redFinanceTheme } from "../theme/tokens.js";

type FinanceCanvasProps = {
  children: ReactNode;
};

const FinanceCanvas = ({ children }: FinanceCanvasProps) => {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&family=Roboto:wght@300;400;500;700;900&display=swap"
        rel="stylesheet"
      />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden"
        style={{
          backgroundColor: redFinanceTheme.colors.background,
          color: redFinanceTheme.colors.backgroundText,
          fontFamily: redFinanceTheme.fonts.body,
        }}
      >
        {children}
      </div>
    </>
  );
};

export default FinanceCanvas;
