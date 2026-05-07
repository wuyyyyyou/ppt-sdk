import React from "react";

import { FinanceIcon, type FinanceIconName } from "./FinanceIcons.js";

type ShortInfoCardProps = {
  icon: FinanceIconName;
  title?: string;
  titleLines?: string[];
  description?: string;
  topAccent?: boolean;
  density?: "normal" | "compact" | "dense";
  descriptionMaxLines?: number;
  align?: "center" | "left";
  accentColor?: string;
  iconBackgroundColor?: string;
};

const ShortInfoCard = ({
  icon,
  title,
  titleLines,
  description,
  topAccent = true,
  density = "normal",
  descriptionMaxLines = 2,
  align = "center",
  accentColor = "var(--primary-color,#B71C1C)",
  iconBackgroundColor = "#FFEBEE",
}: ShortInfoCardProps) => {
  const isCompact = density === "compact";
  const isDense = density === "dense";
  const isLeftAligned = align === "left";
  const cardPaddingX = isDense ? 8 : isCompact ? 10 : 12;
  const cardPaddingTop = isDense ? 10 : isCompact ? 15 : 19;
  const cardPaddingBottom = isDense ? 8 : isCompact ? 12 : 15;
  const iconSize = isDense ? 36 : isCompact ? 44 : 48;
  const iconMarginBottom = isDense ? 5 : isCompact ? 8 : 10;
  const titleFontSize = isDense ? 11 : isCompact ? 13 : 14;
  const titleMarginBottom = isDense ? 2 : isCompact ? 4 : 6;
  const descriptionFontSize = isDense ? 10 : isCompact ? 11 : 12;
  const descriptionLineHeight = isDense ? 1.3 : 1.4;
  const resolvedTitleLines =
    titleLines && titleLines.length > 0 ? titleLines : title ? [title] : [];

  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-[6px] border ${isLeftAligned ? "items-start text-left" : "items-center text-center"}`}
      style={{
        paddingLeft: cardPaddingX,
        paddingRight: cardPaddingX,
        paddingTop: cardPaddingTop,
        paddingBottom: cardPaddingBottom,
        borderColor: "var(--stroke,#E5E7EB)",
        backgroundColor: "var(--background-color,#FFFFFF)",
        boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
      }}
    >
      {topAccent ? (
        <div
          className="absolute left-0 top-0 h-[4px] w-full"
          style={{ backgroundColor: accentColor }}
        />
      ) : null}
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: iconSize,
          height: iconSize,
          marginBottom: iconMarginBottom,
          backgroundColor: iconBackgroundColor,
        }}
      >
        <FinanceIcon
          name={icon}
          className={isDense ? "h-[18px] w-[18px]" : isCompact ? "h-5 w-5" : "h-6 w-6"}
          stroke={accentColor}
        />
      </div>
      {resolvedTitleLines.length > 0 ? (
        <div
          className="flex w-full flex-col"
          style={{ marginBottom: description ? titleMarginBottom : 0 }}
        >
          {resolvedTitleLines.map((line, index) => (
            <p
              key={`${line}-${index}`}
              className="font-bold leading-[1.3]"
              style={{
                fontSize: titleFontSize,
                lineHeight: isDense ? 1.18 : 1.3,
                color: "var(--background-text,#212121)",
              }}
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}
      {description ? (
        <p
          className="leading-[1.4]"
          style={{
            fontSize: descriptionFontSize,
            lineHeight: descriptionLineHeight,
            maxHeight: descriptionMaxLines * descriptionFontSize * descriptionLineHeight,
            overflow: "hidden",
            color: "#616161",
          }}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
};

export default ShortInfoCard;
