import React from "react";
import { type ReactNode } from "react";

import { redFinanceTheme } from "../theme/tokens.js";
import { FinanceIcon, type FinanceIconName } from "./FinanceIcons.js";

type InfoListItemProps = {
  icon: FinanceIconName;
  title: string;
  description: string;
  showDivider?: boolean;
  density?: "normal" | "compact" | "dense";
  textScale?: "normal" | "small";
  titleSuffix?: ReactNode;
  titleSuffixReservedWidth?: number;
  descriptionMaxLines?: number;
  fillHeight?: boolean;
};

const InfoListItem = ({
  icon,
  title,
  description,
  showDivider = true,
  density = "normal",
  textScale = "normal",
  titleSuffix,
  titleSuffixReservedWidth = 44,
  descriptionMaxLines = 2,
  fillHeight = false,
}: InfoListItemProps) => {
  const isCompact = density === "compact";
  const isDense = density === "dense";
  const isSmallText = textScale === "small";
  const iconSize = isDense ? 26 : isCompact ? 32 : 40;
  const titleFontSizeBase = isDense ? 14 : isCompact ? 16 : 18;
  const descriptionFontSizeBase = isDense ? 11 : isCompact ? 13 : 15;
  const descriptionLineHeightBase = isDense ? 14 : isCompact ? 18 : 22;
  const titleFontSize = isSmallText
    ? Math.max(12, titleFontSizeBase - (isDense ? 1 : 2))
    : titleFontSizeBase;
  const descriptionFontSize = isSmallText
    ? Math.max(10, descriptionFontSizeBase - 1)
    : descriptionFontSizeBase;
  const descriptionLineHeight = isSmallText
    ? Math.max(descriptionFontSize + 2, descriptionLineHeightBase - 2)
    : descriptionLineHeightBase;
  const paddingBottom = isDense ? 4 : isCompact ? 7 : 15;
  const dividerLeft = isDense ? 41 : isCompact ? 49 : 55;
  const titleMarginBottom = isSmallText ? 2 : isDense ? 2 : 4;
  const gap = isDense ? 12 : 15;
  const iconClassName = isDense
    ? "h-[14px] w-[14px]"
    : isCompact
      ? "h-[16px] w-[16px]"
      : "h-[18px] w-[18px]";

  return (
    <div
      className="relative flex items-start"
      style={{
        gap,
        paddingBottom,
        height: fillHeight ? "100%" : undefined,
        minHeight: fillHeight ? undefined : isDense ? 46 : isCompact ? 52 : 68,
      }}
    >
      <div
        className="flex flex-none items-center justify-center rounded-full"
        style={{
          width: iconSize,
          height: iconSize,
          backgroundColor: redFinanceTheme.colors.paleRed,
        }}
      >
        <FinanceIcon name={icon} className={iconClassName} />
      </div>
      <div
        className="min-w-0"
        style={{ paddingRight: titleSuffix ? titleSuffixReservedWidth : 8 }}
      >
        <div
          className="font-bold"
          style={{
            fontSize: titleFontSize,
            marginBottom: titleMarginBottom,
            color: redFinanceTheme.colors.backgroundText,
          }}
        >
          <div className="min-w-0 truncate leading-[1.15]">
            {title}
          </div>
          {titleSuffix ? (
            <div className="absolute right-0 top-[1px]">
              {titleSuffix}
            </div>
          ) : null}
        </div>
        <div
          data-validation-role="multi-line-body-text"
          style={{
            color: redFinanceTheme.colors.mutedText,
            fontSize: descriptionFontSize,
            lineHeight: `${descriptionLineHeight}px`,
            maxHeight: descriptionLineHeight * descriptionMaxLines,
            overflow: "hidden",
          }}
        >
          {description}
        </div>
      </div>
      {showDivider ? (
        <div
          className="absolute bottom-0 left-[55px] right-0 h-px"
          style={{
            left: dividerLeft,
            backgroundColor: redFinanceTheme.colors.stroke,
          }}
        />
      ) : null}
    </div>
  );
};

export default InfoListItem;
