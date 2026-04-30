import React, { type ReactNode } from "react";

import { redFinanceTheme } from "../theme/tokens.js";
import FinanceCanvas from "./FinanceCanvas.js";
import IconText from "./IconText.js";

type TitleAccent = "none" | "left" | "bottom";

type FinanceContentFrameProps = {
  title: string;
  children: ReactNode;
  metaIcon?: ReactNode;
  metaText?: string;
  footerText?: string;
  pageNumber?: string;
  titleAccent?: TitleAccent;
  showHeaderDivider?: boolean;
  showFooter?: boolean;
  showFooterDivider?: boolean;
  contentTop?: number;
  contentHeight?: number;
  contentClassName?: string;
};

const titleLeft = 80;
const titleTop = 52;
const titleHeight = 58;
const headerDividerTop = 126;
const contentLeft = 80;
const contentWidth = 1120;
const footerHeight = 50;

const FinanceContentFrame = ({
  title,
  children,
  metaIcon,
  metaText,
  footerText,
  pageNumber,
  titleAccent = "left",
  showHeaderDivider = true,
  showFooter = true,
  showFooterDivider = true,
  contentTop = 178,
  contentHeight,
  contentClassName,
}: FinanceContentFrameProps) => {
  const titleOffset = titleAccent === "left" ? 24 : 0;

  return (
    <div className="relative h-[720px] w-[1280px]">
      <FinanceCanvas>
        {titleAccent === "left" ? (
          <div
            className="absolute z-10 h-[42px] w-[8px] rounded-[3px]"
            style={{
              left: titleLeft,
              top: titleTop + (titleHeight - 42) / 2,
              backgroundColor: redFinanceTheme.colors.primary,
            }}
          />
        ) : null}

        <div
          className="absolute z-10 flex items-end justify-between"
          style={{
            left: titleLeft + titleOffset,
            right: 80,
            top: titleTop,
          }}
        >
          <div
            className="flex h-[58px] items-center whitespace-nowrap text-[48px] font-black leading-[58px]"
            style={{ color: redFinanceTheme.colors.backgroundText }}
          >
            {title}
          </div>
          {metaIcon && metaText ? (
            <IconText
              icon={metaIcon}
              label={metaText}
              height={28}
              iconSize={22}
              gap={10}
              fontSize={16}
              fontWeight={700}
              textColor={redFinanceTheme.colors.mutedText}
            />
          ) : null}
        </div>

        {showHeaderDivider ? (
          <div
            className="absolute z-10 h-[2px]"
            style={{
              left: contentLeft,
              top: headerDividerTop,
              width: contentWidth,
              backgroundColor: redFinanceTheme.colors.stroke,
            }}
          />
        ) : null}

        {titleAccent === "bottom" ? (
          <div
            className="absolute z-10 h-[6px] w-[120px]"
            style={{
              left: titleLeft,
              top: headerDividerTop - 6,
              backgroundColor: redFinanceTheme.colors.primary,
            }}
          />
        ) : null}

        <div
          className={contentClassName}
          style={{
            position: "absolute",
            left: contentLeft,
            top: contentTop,
            width: contentWidth,
            height: contentHeight,
            zIndex: 10,
          }}
        >
          {children}
        </div>

        {showFooter ? (
          <div
            className="absolute bottom-0 left-0 z-20 flex w-full items-center justify-between px-[60px] text-[12px]"
            style={{
              height: footerHeight,
              borderTop: showFooterDivider ? "1px solid #F5F5F5" : undefined,
              color: "#9E9E9E",
              backgroundColor: redFinanceTheme.colors.background,
            }}
          >
            <div className="flex h-[16px] items-center whitespace-nowrap leading-[16px]">
              {footerText}
            </div>
            <div
              className="flex h-[16px] items-center whitespace-nowrap font-bold leading-[16px]"
              style={{ color: redFinanceTheme.colors.primary }}
            >
              {pageNumber}
            </div>
          </div>
        ) : null}
      </FinanceCanvas>
    </div>
  );
};

export default FinanceContentFrame;
