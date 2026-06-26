import React, { type ReactNode } from "react";

import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";
import ThemeCanvas from "./ThemeCanvas.tsx";
import ThemeTitleBlock from "./ThemeTitleBlock.tsx";

type ThemeContentFrameProps = {
  title?: ReactNode;
  titlePrefix?: ReactNode;
  titleHighlight?: ReactNode;
  children: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  footerText?: ReactNode;
  pageNumber?: ReactNode;
  tone?: RedBlueTone;
  showGrid?: boolean;
  showHeaderDivider?: boolean;
  showFooter?: boolean;
  contentTop?: number;
  contentHeight?: number;
  contentClassName?: string;
};

const ThemeContentFrame = ({
  title,
  titlePrefix,
  titleHighlight,
  children,
  subtitle,
  eyebrow,
  meta,
  footerText,
  pageNumber,
  tone = "purple",
  showGrid = false,
  showHeaderDivider = true,
  showFooter = true,
  contentTop = redBlueComparisonTheme.size.contentTop,
  contentHeight,
  contentClassName,
}: ThemeContentFrameProps) => {
  const footerHeight = showFooter ? redBlueComparisonTheme.size.footerHeight : 0;

  return (
    <ThemeCanvas showGrid={showGrid}>
      <div
        className="absolute z-10 flex items-start justify-between gap-[24px]"
        style={{
          left: redBlueComparisonTheme.size.contentLeft,
          right: redBlueComparisonTheme.size.contentRight,
          top: redBlueComparisonTheme.size.headerTop,
        }}
      >
        <ThemeTitleBlock
          title={title}
          titlePrefix={titlePrefix}
          titleHighlight={titleHighlight}
          subtitle={subtitle}
          eyebrow={eyebrow}
          tone={tone}
          titleFontSize={40}
          titleMaxWidth={meta ? 780 : 980}
        />
        {meta ? <div className="flex flex-none justify-end pt-[8px]">{meta}</div> : null}
      </div>

      {showHeaderDivider ? (
        <div
          className="absolute z-10 h-px"
          style={{
            left: redBlueComparisonTheme.size.contentLeft,
            right: redBlueComparisonTheme.size.contentRight,
            top: 132,
            backgroundColor: redBlueComparisonTheme.colors.stroke,
          }}
        />
      ) : null}

      <div
        className={["absolute z-10 box-border min-h-0", contentClassName].filter(Boolean).join(" ")}
        style={{
          left: redBlueComparisonTheme.size.contentLeft,
          top: contentTop,
          width: redBlueComparisonTheme.size.contentWidth,
          height: contentHeight,
          bottom: contentHeight === undefined ? footerHeight + 18 : undefined,
        }}
      >
        {children}
      </div>

      {showFooter ? (
        <div
          className="absolute bottom-0 left-0 z-20 flex w-full items-center justify-between px-[60px] text-[12px]"
          style={{
            height: redBlueComparisonTheme.size.footerHeight,
            color: redBlueComparisonTheme.colors.subtleText,
            backgroundColor: redBlueComparisonTheme.colors.background,
            borderTop: redBlueComparisonTheme.border.hairline,
          }}
        >
          <div className="min-w-0 truncate">{footerText}</div>
          <div className="flex-none font-black" style={{ color: redBlueComparisonTheme.tone[tone].color }}>
            {pageNumber}
          </div>
        </div>
      ) : null}
    </ThemeCanvas>
  );
};

export default ThemeContentFrame;
