import React from "react";

import { FinanceIcon, type FinanceIconName } from "./FinanceIcons.js";

type ShortInfoCardProps = {
  icon: FinanceIconName;
  title: string;
  description: string;
  topAccent?: boolean;
  density?: "normal" | "compact" | "dense";
  descriptionMaxLines?: number;
};

const ShortInfoCard = ({
  icon,
  title,
  description,
  topAccent = true,
  density = "normal",
  descriptionMaxLines = 2,
}: ShortInfoCardProps) => {
  const isCompact = density === "compact";
  const isDense = density === "dense";
  const cardPaddingX = isDense ? 8 : isCompact ? 10 : 12;
  const cardPaddingTop = isDense ? 12 : isCompact ? 15 : 19;
  const cardPaddingBottom = isDense ? 10 : isCompact ? 12 : 15;
  const iconSize = isDense ? 40 : isCompact ? 44 : 48;
  const iconMarginBottom = isDense ? 6 : isCompact ? 8 : 10;
  const titleFontSize = isDense ? 12 : isCompact ? 13 : 14;
  const titleMarginBottom = isDense ? 3 : isCompact ? 4 : 6;
  const descriptionFontSize = isDense ? 10 : isCompact ? 11 : 12;
  const descriptionLineHeight = isDense ? 1.3 : 1.4;

  return (
    <div
      className="relative flex h-full flex-col items-center overflow-hidden rounded-[6px] border text-center"
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
          style={{ backgroundColor: "var(--primary-color,#B71C1C)" }}
        />
      ) : null}
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: iconSize,
          height: iconSize,
          marginBottom: iconMarginBottom,
          backgroundColor: "#FFEBEE",
        }}
      >
        <FinanceIcon
          name={icon}
          className={isDense ? "h-[18px] w-[18px]" : isCompact ? "h-5 w-5" : "h-6 w-6"}
        />
      </div>
      <p
        className="font-bold leading-[1.3]"
        style={{
          marginBottom: titleMarginBottom,
          fontSize: titleFontSize,
          color: "var(--background-text,#212121)",
        }}
      >
        {title}
      </p>
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
    </div>
  );
};

export default ShortInfoCard;
