import React from "react";

import {
  FinanceIcon,
  type FinanceIconName,
} from "./FinanceIcons.js";
import StableInlineRow from "./StableInlineRow.js";

export type PillarBulletItem = {
  lead: string;
  body: string;
};

type PillarBulletCardProps = {
  number?: string;
  watermarkText?: string;
  icon: FinanceIconName;
  title: string;
  items: PillarBulletItem[];
  accentColor?: string;
  iconBackgroundColor?: string;
  density?: "normal" | "compact";
  titlePlacement?: "below" | "right";
  showWatermark?: boolean;
  dividerStyle?: "solid" | "dashed";
  headerDensity?: "normal" | "compact" | "tight";
  textScale?: "normal" | "small" | "xsmall";
  dividerThickness?: number;
  dividerDash?: string;
};

const BULLET_ITEM_LINE_HEIGHT = 19;

const PillarBulletCard = ({
  number,
  watermarkText,
  icon,
  title,
  items,
  accentColor = "var(--primary-color,#B71C1C)",
  iconBackgroundColor = "#FFEBEE",
  density = "normal",
  titlePlacement = "below",
  showWatermark = true,
  dividerStyle = "solid",
  headerDensity = "normal",
  textScale = "normal",
  dividerThickness = 1,
  dividerDash = "8 6",
}: PillarBulletCardProps) => {
  const resolvedWatermarkText = watermarkText ?? number;
  const isCompact = density === "compact";
  const isTitleRight = titlePlacement === "right";
  const isHeaderCompact = headerDensity === "compact";
  const isHeaderTight = headerDensity === "tight";
  const isSmallText = textScale === "small";
  const isXSmallText = textScale === "xsmall";
  const cardPaddingX = isCompact ? 18 : 20;
  const cardPaddingTop = isCompact ? 20 : 22;
  const cardPaddingBottom = isCompact ? 16 : 18;
  const iconBoxSize = isHeaderTight ? 40 : isHeaderCompact ? 46 : isCompact ? 52 : 56;
  const iconMarginBottom = isHeaderTight ? 8 : isHeaderCompact ? 10 : isCompact ? 12 : 14;
  const titleFontSizeBase = isHeaderTight ? 14 : isHeaderCompact ? 15 : isCompact ? 17 : 18;
  const titleFontSize = isSmallText
    ? Math.max(13, titleFontSizeBase - 1)
    : isXSmallText
      ? Math.max(12, titleFontSizeBase - 2)
      : titleFontSizeBase;
  const dividerMarginTop = isCompact ? 6 : 8;
  const dividerMarginBottom = isCompact ? 10 : 12;
  const itemGap = isXSmallText ? 5 : isSmallText ? 6 : isCompact ? 8 : 10;
  const leadFontSizeBase = isCompact ? 12 : 13;
  const bodyFontSizeBase = isCompact ? 12 : 13;
  const leadFontSize = isSmallText
    ? `${Math.max(11, leadFontSizeBase - 1)}px`
    : isXSmallText
      ? `${Math.max(10, leadFontSizeBase - 2)}px`
      : `${leadFontSizeBase}px`;
  const bodyFontSizeValue = isSmallText
    ? Math.max(11, bodyFontSizeBase - 1)
    : isXSmallText
      ? Math.max(10, bodyFontSizeBase - 2)
      : bodyFontSizeBase;
  const bodyFontSize = `${bodyFontSizeValue}px`;
  const bodyLineHeight = isXSmallText ? "1.25" : isSmallText ? "1.3" : isCompact ? "1.4" : "1.45";
  const headerGap = isHeaderTight ? 10 : isHeaderCompact ? 12 : isCompact ? 12 : 14;
  const dividerBorderStyle = dividerStyle === "dashed" ? "dashed" : "solid";
  const titleLineHeight = isHeaderTight ? 1.12 : 1.2;
  const bulletSize = isXSmallText ? 5 : 6;
  const bulletLineHeight = isXSmallText ? 17 : isSmallText ? 18 : BULLET_ITEM_LINE_HEIGHT;

  return (
    <div
      className="relative flex h-full min-h-0 flex-col rounded-[8px] border"
      style={{
        paddingLeft: cardPaddingX,
        paddingRight: cardPaddingX,
        paddingTop: cardPaddingTop,
        paddingBottom: cardPaddingBottom,
        borderColor: "var(--stroke,#E5E7EB)",
        backgroundColor: "var(--background-color,#FFFFFF)",
        boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
      }}
    >
      <div
        className="absolute left-0 top-0 h-[6px] w-full"
        style={{ backgroundColor: accentColor }}
      />

      {showWatermark && resolvedWatermarkText ? (
        <div
          className="absolute right-[16px] top-[14px] text-[42px] font-black leading-none"
          style={{ color: "#FDEBEC" }}
        >
          {resolvedWatermarkText}
        </div>
      ) : null}

      <div
        className={`flex ${isTitleRight ? "items-center" : "flex-col"}`}
        style={{
          gap: headerGap,
          marginBottom: isTitleRight ? 0 : iconMarginBottom,
        }}
      >
        <div
          className="flex flex-none items-center justify-center rounded-[12px]"
          style={{
            backgroundColor: iconBackgroundColor,
            width: iconBoxSize,
            height: iconBoxSize,
            marginBottom: isTitleRight ? 0 : undefined,
          }}
        >
          <FinanceIcon
            name={icon}
            className={
              isHeaderTight
                ? "h-[18px] w-[18px]"
                : isHeaderCompact
                  ? "h-5 w-5"
                  : isCompact
                    ? "h-[22px] w-[22px]"
                    : "h-6 w-6"
            }
            stroke={accentColor}
          />
        </div>

        <h2
          className="font-bold"
          style={{
            color: "var(--background-text,#212121)",
            fontSize: titleFontSize,
            lineHeight: titleLineHeight,
          }}
        >
          {title}
        </h2>
      </div>

      <div
        className="w-full"
        style={{
          borderTopWidth: dividerThickness,
          borderTopStyle: dividerBorderStyle,
          borderTopColor: "var(--stroke,#E5E7EB)",
          borderImage: dividerStyle === "dashed" ? `repeating-linear-gradient(to right, var(--stroke,#E5E7EB) 0 ${dividerDash.split(" ")[0]}, transparent ${dividerDash.split(" ")[0]} ${dividerDash}) 1` : undefined,
          marginTop: dividerMarginTop,
          marginBottom: dividerMarginBottom,
        }}
      />

      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ gap: itemGap }}
      >
        {items.map((item, index) => (
          <div
            key={`${title}-${index}`}
            className="flex items-start gap-[12px]"
          >
            <StableInlineRow
              height={bulletLineHeight}
              gap={0}
              inline={false}
              className="w-[6px] flex-none"
            >
              <div
                className="rounded-full"
                style={{
                  width: bulletSize,
                  height: bulletSize,
                  backgroundColor: accentColor,
                }}
              />
            </StableInlineRow>
            <div className="flex min-w-0 flex-1 flex-col">
              <StableInlineRow
                height={bulletLineHeight}
                gap={0}
                style={{
                  fontSize: leadFontSize,
                  fontWeight: 700,
                  color: "var(--background-text,#212121)",
                }}
              >
                <span>{item.lead}：</span>
              </StableInlineRow>
              <div
                className="mt-[1px]"
                style={{
                  fontSize: bodyFontSize,
                  lineHeight: bodyLineHeight,
                  color: "var(--text-muted,#616161)",
                }}
              >
                {item.body}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PillarBulletCard;
