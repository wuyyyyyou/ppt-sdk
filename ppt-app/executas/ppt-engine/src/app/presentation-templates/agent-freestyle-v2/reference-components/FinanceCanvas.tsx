import React, { type ReactNode } from "react";

import { theme } from "../theme.ts";

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
          backgroundColor: theme.colors.canvas,
          color: theme.colors.textPrimary,
          fontFamily: theme.fonts.body,
        }}
      >
        {children}
      </div>
    </>
  );
};

export default FinanceCanvas;
