import React, { type ReactNode } from "react";

import { FinanceIcon, type FinanceIconName } from "./FinanceIcons.js";
import { redFinanceTheme } from "../theme/tokens.js";

type HorizontalFeatureCardTone = "default" | "accent" | "future";

type HorizontalFeatureCardProps = {
  iconName?: FinanceIconName;
  icon?: ReactNode;
  title: ReactNode;
  description: ReactNode;
  tag?: ReactNode;
  density?: "normal" | "compact" | "dense";
  tone?: HorizontalFeatureCardTone;
  minHeight?: number;
  className?: string;
  railColor?: string;
  railSide?: "left" | "right";
  contentAlign?: "left" | "right";
  iconBackgroundColor?: string;
  iconStroke?: string;
  cardBackgroundColor?: string;
  borderColor?: string;
  titleColor?: string;
  descriptionColor?: string;
  shadow?: string;
  tagUppercase?: boolean;
};

const toneDefaults = (tone: HorizontalFeatureCardTone) => {
  switch (tone) {
    case "accent":
      return {
        railColor: redFinanceTheme.colors.primary,
        iconBackgroundColor: redFinanceTheme.colors.paleRed,
        iconStroke: redFinanceTheme.colors.primary,
        tagBorderColor: "#F1CACA",
        tagBackgroundColor: "#FFF4F4",
        tagTextColor: redFinanceTheme.colors.primary,
      };
    case "future":
      return {
        railColor: redFinanceTheme.colors.primary,
        iconBackgroundColor: redFinanceTheme.colors.paleRed,
        iconStroke: redFinanceTheme.colors.primary,
        tagBorderColor: "#F1CACA",
        tagBackgroundColor: "#FFF4F4",
        tagTextColor: redFinanceTheme.colors.primary,
      };
    default:
      return {
        railColor: "#D8DCE2",
        iconBackgroundColor: redFinanceTheme.colors.paleRed,
        iconStroke: redFinanceTheme.colors.primary,
        tagBorderColor: redFinanceTheme.colors.stroke,
        tagBackgroundColor: "#FAFAFA",
        tagTextColor: redFinanceTheme.colors.mutedText,
      };
  }
};

const HorizontalFeatureCard = ({
  iconName,
  icon,
  title,
  description,
  tag,
  density = "normal",
  tone = "default",
  minHeight,
  className,
  railColor,
  railSide = "left",
  contentAlign = "left",
  iconBackgroundColor,
  iconStroke,
  cardBackgroundColor,
  borderColor,
  titleColor,
  descriptionColor,
  shadow,
  tagUppercase = true,
}: HorizontalFeatureCardProps) => {
  const defaults = toneDefaults(tone);
  const isDense = density === "dense";
  const isCompact = density === "compact";
  const isRightAligned = contentAlign === "right";
  const resolvedRailColor = railColor ?? defaults.railColor;
  const resolvedIconBackgroundColor =
    iconBackgroundColor ?? defaults.iconBackgroundColor;
  const resolvedIconStroke = iconStroke ?? defaults.iconStroke;
  const hasIcon = Boolean(icon ?? iconName);
  const iconBoxSize = isDense ? 46 : isCompact ? 48 : 52;
  const iconClassName = isDense ? "h-5 w-5" : "h-6 w-6";
  const outerPaddingX = isDense ? 16 : 18;
  const outerPaddingY = isDense ? 12 : isCompact ? 13 : 14;
  const innerGap = isDense ? 14 : 16;
  const titleFontSize = isDense ? 15 : 16;
  const descriptionFontSize = isDense ? 12 : 13;
  const descriptionLineHeight = isDense ? 1.4 : 1.45;
  const titleGap = isDense ? 10 : 12;
  const titleMarginBottom = isDense ? 5 : 6;

  return (
    <div
      className={["flex overflow-hidden rounded-[8px] border", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        minHeight,
        borderColor: borderColor ?? redFinanceTheme.colors.stroke,
        backgroundColor: cardBackgroundColor ?? redFinanceTheme.colors.background,
        boxShadow: shadow ?? "0 4px 6px rgba(0,0,0,0.02)",
      }}
    >
      {railSide === "left" ? (
        <div
          className="w-[4px] flex-none"
          style={{ backgroundColor: resolvedRailColor }}
        />
      ) : null}
      <div
        className="flex min-w-0 flex-1 items-center"
        style={{
          gap: innerGap,
          paddingLeft: outerPaddingX,
          paddingRight: outerPaddingX,
          paddingTop: outerPaddingY,
          paddingBottom: outerPaddingY,
        }}
      >
        {hasIcon ? (
          <div
            className="flex flex-none items-center justify-center rounded-[10px]"
            style={{
              width: iconBoxSize,
              height: iconBoxSize,
              backgroundColor: resolvedIconBackgroundColor,
            }}
          >
            {icon ?? (iconName ? (
              <FinanceIcon
                name={iconName}
                className={iconClassName}
                stroke={resolvedIconStroke}
              />
            ) : null)}
          </div>
        ) : null}
        <div
          className={[
            "min-w-0 flex-1",
            isRightAligned ? "text-right" : "text-left",
          ].join(" ")}
        >
          <div
            className={[
              "flex items-start",
              isRightAligned ? "flex-row-reverse justify-between" : "justify-between",
            ].join(" ")}
            style={{
              gap: titleGap,
              marginBottom: titleMarginBottom,
            }}
          >
            <div
              className="min-w-0 flex-1 font-bold leading-[1.3]"
              style={{
                fontSize: titleFontSize,
                color: titleColor ?? redFinanceTheme.colors.backgroundText,
              }}
            >
              {title}
            </div>
            {tag ? (
              <div
                className="flex-none whitespace-nowrap rounded-[4px] border px-[6px] py-[2px] text-[10px] font-semibold"
                style={{
                  textTransform: tagUppercase ? "uppercase" : "none",
                  color: defaults.tagTextColor,
                  borderColor: defaults.tagBorderColor,
                  backgroundColor: defaults.tagBackgroundColor,
                }}
              >
                {tag}
              </div>
            ) : null}
          </div>
          <div
            style={{
              fontSize: descriptionFontSize,
              lineHeight: descriptionLineHeight,
              color: descriptionColor ?? redFinanceTheme.colors.mutedText,
            }}
          >
            {description}
          </div>
        </div>
      </div>
      {railSide === "right" ? (
        <div
          className="w-[4px] flex-none"
          style={{ backgroundColor: resolvedRailColor }}
        />
      ) : null}
    </div>
  );
};

export default HorizontalFeatureCard;
