import React, { type ReactNode } from "react";

import { redFinanceTheme } from "../theme/tokens.js";
import { FinanceIcon, type FinanceIconName } from "./FinanceIcons.js";

type IconTextCardProps = {
  icon?: FinanceIconName;
  iconNode?: ReactNode;
  title?: ReactNode;
  titleLines?: ReactNode[];
  description?: ReactNode;
  topAccent?: boolean;
  density?: "normal" | "compact" | "dense";
  descriptionMaxLines?: number;
  align?: "center" | "left";
  accentColor?: string;
  iconBackgroundColor?: string;
  variant?: "compact" | "summary";
  className?: string;
  cardPaddingX?: number;
  cardPaddingTop?: number;
  cardPaddingBottom?: number;
  iconSize?: number;
  iconShape?: "circle" | "rounded";
  titleFontSize?: number;
  descriptionFontSize?: number;
  minHeight?: number;
  shadow?: string;
  cardBackgroundColor?: string;
  cardBorderColor?: string;
  borderRadius?: number;
  topAccentThickness?: number;
};

const IconTextCard = ({
  icon,
  iconNode,
  title,
  titleLines,
  description,
  topAccent = true,
  density = "normal",
  descriptionMaxLines = 2,
  align = "center",
  accentColor = "var(--primary-color,#B71C1C)",
  iconBackgroundColor = "#FFEBEE",
  variant = "compact",
  className,
  cardPaddingX,
  cardPaddingTop,
  cardPaddingBottom,
  iconSize,
  iconShape = "circle",
  titleFontSize,
  descriptionFontSize,
  minHeight,
  shadow,
  cardBackgroundColor,
  cardBorderColor,
  borderRadius,
  topAccentThickness,
}: IconTextCardProps) => {
  const isCompact = density === "compact";
  const isDense = density === "dense";
  const isLeftAligned = align === "left";
  const isSummary = variant === "summary";
  const resolvedCardPaddingX =
    cardPaddingX ?? (isSummary ? 22 : isDense ? 8 : isCompact ? 10 : 12);
  const resolvedCardPaddingTop =
    cardPaddingTop ?? (isSummary ? 22 : isDense ? 10 : isCompact ? 15 : 19);
  const resolvedCardPaddingBottom =
    cardPaddingBottom ?? (isSummary ? 18 : isDense ? 8 : isCompact ? 12 : 15);
  const resolvedIconSize =
    iconSize ?? (isSummary ? 46 : isDense ? 36 : isCompact ? 44 : 48);
  const iconMarginBottom = isDense ? 5 : isCompact ? 8 : 10;
  const resolvedTitleFontSize =
    titleFontSize ?? (isSummary ? 18 : isDense ? 11 : isCompact ? 13 : 14);
  const titleMarginBottom = isDense ? 2 : isCompact ? 4 : 6;
  const resolvedDescriptionFontSize =
    descriptionFontSize ?? (isSummary ? 13 : isDense ? 10 : isCompact ? 11 : 12);
  const descriptionLineHeight = isSummary ? 1.52 : isDense ? 1.3 : 1.4;
  const resolvedShadow =
    shadow ?? (isSummary ? "0 4px 10px rgba(0,0,0,0.03)" : "0 2px 4px rgba(0,0,0,0.03)");
  const iconRadius = iconShape === "rounded" ? 12 : 9999;
  const resolvedBorderRadius = borderRadius ?? 6;
  const resolvedTitleLines =
    titleLines && titleLines.length > 0 ? titleLines : title ? [title] : [];
  const hasIcon = Boolean(iconNode ?? icon);

  return (
    <div
      className={[
        "relative flex h-full flex-col overflow-hidden border",
        isLeftAligned ? "items-start text-left" : "items-center text-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        paddingLeft: resolvedCardPaddingX,
        paddingRight: resolvedCardPaddingX,
        paddingTop: resolvedCardPaddingTop,
        paddingBottom: resolvedCardPaddingBottom,
        borderColor: cardBorderColor ?? redFinanceTheme.colors.stroke,
        backgroundColor: cardBackgroundColor ?? redFinanceTheme.colors.background,
        boxShadow: resolvedShadow,
        minHeight,
        borderRadius: resolvedBorderRadius,
      }}
    >
      {topAccent ? (
        <div
          className="absolute left-0 top-0 w-full"
          style={{
            backgroundColor: accentColor,
            height: topAccentThickness ?? (isSummary ? 5 : 4),
          }}
        />
      ) : null}
      {hasIcon ? (
        <div
          className="flex items-center justify-center"
          style={{
            width: resolvedIconSize,
            height: resolvedIconSize,
            marginBottom: isSummary ? 14 : iconMarginBottom,
            backgroundColor: iconBackgroundColor,
            borderRadius: iconRadius,
          }}
        >
          {iconNode ?? (icon ? (
            <FinanceIcon
              name={icon}
              className={
                isSummary
                  ? "h-[22px] w-[22px]"
                  : isDense
                    ? "h-[18px] w-[18px]"
                    : isCompact
                      ? "h-5 w-5"
                      : "h-6 w-6"
              }
              stroke={accentColor}
            />
          ) : null)}
        </div>
      ) : null}
      {resolvedTitleLines.length > 0 ? (
        <div
          className="flex w-full flex-col"
          style={{ marginBottom: description ? titleMarginBottom : 0 }}
        >
          {resolvedTitleLines.map((line, index) => (
            <p
              key={index}
              className="font-bold leading-[1.3]"
              style={{
                fontSize: resolvedTitleFontSize,
                lineHeight: isSummary ? 1.2 : isDense ? 1.18 : 1.3,
                color: redFinanceTheme.colors.backgroundText,
              }}
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}
      {description ? (
        <div
          className="leading-[1.4]"
          style={{
            fontSize: resolvedDescriptionFontSize,
            lineHeight: descriptionLineHeight,
            maxHeight: descriptionMaxLines * resolvedDescriptionFontSize * descriptionLineHeight,
            overflow: "hidden",
            color: redFinanceTheme.colors.mutedText,
          }}
        >
          {description}
        </div>
      ) : null}
    </div>
  );
};

export default IconTextCard;
