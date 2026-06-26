import React, { type ReactNode } from "react";

import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";
import ThemePill from "./ThemePill.tsx";

type ThemeTitleBlockProps = {
  title?: ReactNode;
  titlePrefix?: ReactNode;
  titleHighlight?: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  tone?: RedBlueTone;
  align?: "left" | "center";
  titleMaxWidth?: number;
  subtitleMaxWidth?: number;
  titleFontSize?: number;
  className?: string;
};

const ThemeTitleBlock = ({
  title,
  titlePrefix,
  titleHighlight,
  subtitle,
  eyebrow,
  tone = "purple",
  align = "left",
  titleMaxWidth = 860,
  subtitleMaxWidth = 900,
  titleFontSize = 42,
  className,
}: ThemeTitleBlockProps) => {
  const toneValue = redBlueComparisonTheme.tone[tone];
  const isCentered = align === "center";
  const hasSegmentedTitle = titlePrefix !== undefined || titleHighlight !== undefined;

  return (
    <div
      className={["flex min-w-0 flex-col", isCentered ? "items-center text-center" : "items-start text-left", className]
        .filter(Boolean)
        .join(" ")}
    >
      {eyebrow ? (
        <ThemePill tone={tone} height={26}>
          {eyebrow}
        </ThemePill>
      ) : null}
      <div
        className="mt-[10px] min-w-0 overflow-hidden font-black leading-[1.08]"
        style={{
          maxWidth: titleMaxWidth,
          fontFamily: redBlueComparisonTheme.fonts.heading,
          fontSize: titleFontSize,
          color: redBlueComparisonTheme.colors.backgroundText,
        }}
      >
        {hasSegmentedTitle ? (
          <>
            {titlePrefix !== undefined ? (
              <span className="inline-block align-baseline" style={{ color: redBlueComparisonTheme.colors.backgroundText }}>
                {titlePrefix}
              </span>
            ) : null}
            {titlePrefix !== undefined && titleHighlight !== undefined ? " " : null}
            {titleHighlight !== undefined ? (
              <span className="inline-block align-baseline" style={{ color: toneValue.color }}>
                {titleHighlight}
              </span>
            ) : null}
          </>
        ) : (
          title
        )}
      </div>
      <div
        className="mt-[12px] h-[5px] rounded-full"
        style={{
          width: isCentered ? 88 : 96,
          backgroundColor: toneValue.color,
        }}
      />
      {subtitle ? (
        <div
          className="mt-[14px] overflow-hidden text-[16px] font-medium leading-[1.45]"
          style={{
            maxWidth: subtitleMaxWidth,
            maxHeight: 47,
            color: redBlueComparisonTheme.colors.mutedText,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
};

export default ThemeTitleBlock;
