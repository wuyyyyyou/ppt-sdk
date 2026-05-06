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
  titleSuffix?: ReactNode;
  descriptionMaxLines?: number;
  fillHeight?: boolean;
};

const InfoListItem = ({
  icon,
  title,
  description,
  showDivider = true,
  density = "normal",
  titleSuffix,
  descriptionMaxLines = 2,
  fillHeight = false,
}: InfoListItemProps) => {
  const isCompact = density === "compact";
  const isDense = density === "dense";
  const iconSize = isDense ? 26 : isCompact ? 32 : 40;
  const titleFontSize = isDense ? 14 : isCompact ? 16 : 18;
  const descriptionFontSize = isDense ? 11 : isCompact ? 13 : 15;
  const descriptionLineHeight = isDense ? 14 : isCompact ? 18 : 22;
  const paddingBottom = isDense ? 4 : isCompact ? 7 : 15;
  const dividerLeft = isDense ? 41 : isCompact ? 49 : 55;
  const titleMarginBottom = isDense ? 2 : 4;
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
        style={{ paddingRight: titleSuffix ? 44 : 8 }}
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
