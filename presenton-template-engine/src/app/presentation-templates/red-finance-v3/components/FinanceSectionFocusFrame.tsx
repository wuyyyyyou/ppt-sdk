import React, { type ReactNode } from "react";

import { redFinanceTheme } from "../theme/tokens.js";
import FinanceCanvas from "./FinanceCanvas.js";

type FinanceSectionFocusFrameProps = {
  leftContent: ReactNode;
  rightContent: ReactNode;
  footerText?: string;
  pageNumber?: string;
  backgroundDecoration?: ReactNode;
  topBarColor?: string;
  leftWidth?: number;
  contentTop?: number;
  contentBottom?: number;
  contentLeft?: number;
  contentRight?: number;
  columnGap?: number;
};

const FinanceSectionFocusFrame = ({
  leftContent,
  rightContent,
  footerText,
  pageNumber,
  backgroundDecoration,
  topBarColor = redFinanceTheme.colors.primary,
  leftWidth = 596,
  contentTop = 82,
  contentBottom = 58,
  contentLeft = 96,
  contentRight = 96,
  columnGap = 62,
}: FinanceSectionFocusFrameProps) => {
  const footerHeight = 50;

  return (
    <div className="relative h-[720px] w-[1280px]">
      <FinanceCanvas>
        <div
          className="absolute left-0 top-0 z-20 h-[12px] w-full"
          style={{ backgroundColor: topBarColor }}
        />

        {backgroundDecoration ? (
          <div className="absolute inset-0 z-0 overflow-hidden">{backgroundDecoration}</div>
        ) : null}

        <div
          className="relative z-10 flex"
          style={{
            height: 720 - contentTop - footerHeight - contentBottom,
            paddingTop: contentTop,
            paddingLeft: contentLeft,
            paddingRight: contentRight,
            boxSizing: "border-box",
            gap: columnGap,
          }}
        >
          <div className="flex-none" style={{ width: leftWidth }}>
            {leftContent}
          </div>
          <div className="min-w-0 flex-1">{rightContent}</div>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 z-20 h-[50px]"
          style={{ backgroundColor: redFinanceTheme.colors.background }}
        >
          <div
            className="absolute left-[60px] right-[60px] top-0 h-px"
            style={{ backgroundColor: "#EEEEEE" }}
          />
          <div className="flex h-full items-center justify-between px-[60px]">
            <div
              className="whitespace-nowrap text-[12px] font-medium tracking-[0.08em]"
              style={{ color: "#9E9E9E" }}
            >
              {footerText}
            </div>
            <div
              className="whitespace-nowrap text-[14px] font-black leading-none"
              style={{ color: redFinanceTheme.colors.primary }}
            >
              {pageNumber}
            </div>
          </div>
        </div>
      </FinanceCanvas>
    </div>
  );
};

export default FinanceSectionFocusFrame;
