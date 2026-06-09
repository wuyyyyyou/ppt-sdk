import React, { type ReactNode } from "react";

import { redBlueTheme } from "../theme/tokens.ts";

type RedBlueCanvasProps = {
  children: ReactNode;
  showGrid?: boolean;
  showDecorations?: boolean;
};

const RedBlueCanvas = ({
  children,
  showGrid = true,
  showDecorations = true,
}: RedBlueCanvasProps) => {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Montserrat:wght@600;700;800;900&family=Noto+Sans+SC:wght@400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden"
        style={{
          backgroundColor: redBlueTheme.colors.background,
          color: redBlueTheme.colors.backgroundText,
          fontFamily: redBlueTheme.fonts.body,
        }}
      >
        {showGrid ? (
          <div
            className="absolute inset-0 z-0"
            style={{
              backgroundImage: "radial-gradient(#DFE6E9 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              opacity: 0.25,
            }}
          />
        ) : null}
        {showDecorations ? (
          <>
            <div
              className="absolute z-0 rounded-full"
              style={{
                width: 300,
                height: 300,
                right: -70,
                top: -70,
                backgroundColor: redBlueTheme.colors.redTint,
              }}
            />
            <div
              className="absolute z-0 rounded-full"
              style={{
                width: 240,
                height: 240,
                left: -80,
                bottom: 40,
                backgroundColor: redBlueTheme.colors.blueTint,
              }}
            />
            <div
              className="absolute z-0 rounded-full"
              style={{
                width: 120,
                height: 120,
                left: 620,
                top: 120,
                backgroundColor: redBlueTheme.colors.purpleTint,
              }}
            />
          </>
        ) : null}
        <div className="relative z-10 h-full w-full">{children}</div>
      </div>
    </>
  );
};

export default RedBlueCanvas;
