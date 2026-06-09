import React, { type ReactNode } from "react";

import { redBlueTheme } from "../theme/tokens.ts";
import RedBlueCanvas from "./RedBlueCanvas.tsx";

type RedBlueContentFrameProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footerText?: string;
  pageNumber?: string;
  contentTop?: number;
  showDecorations?: boolean;
};

const RedBlueContentFrame = ({
  title,
  subtitle,
  children,
  footerText,
  pageNumber,
  contentTop = 150,
  showDecorations = true,
}: RedBlueContentFrameProps) => {
  return (
    <RedBlueCanvas showDecorations={showDecorations}>
      <div className="absolute left-[80px] right-[80px] top-[48px]">
        <div
          className="text-[42px] font-black leading-[50px]"
          style={{
            color: redBlueTheme.colors.backgroundText,
            fontFamily: redBlueTheme.fonts.heading,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            className="mt-[6px] text-[16px] font-semibold"
            style={{ color: redBlueTheme.colors.mutedText }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      <div
        className="absolute left-[80px] right-[80px]"
        style={{ top: contentTop, bottom: 56 }}
      >
        {children}
      </div>
      <div
        className="absolute bottom-0 left-0 flex h-[48px] w-full items-center justify-between px-[60px] text-[12px] font-semibold"
        style={{
          color: redBlueTheme.colors.subtleText,
          borderTop: `1px solid ${redBlueTheme.colors.stroke}`,
          backgroundColor: redBlueTheme.colors.background,
        }}
      >
        <span>{footerText}</span>
        <span style={{ color: redBlueTheme.colors.purple }}>{pageNumber}</span>
      </div>
    </RedBlueCanvas>
  );
};

export default RedBlueContentFrame;
