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
}: PillarBulletCardProps) => {
  const resolvedWatermarkText = watermarkText ?? number;
  const isCompact = density === "compact";
  const cardPaddingX = isCompact ? 18 : 20;
  const cardPaddingTop = isCompact ? 20 : 22;
  const cardPaddingBottom = isCompact ? 16 : 18;
  const iconBoxSize = isCompact ? 52 : 56;
  const iconMarginBottom = isCompact ? 12 : 14;
  const titleFontSize = isCompact ? 17 : 18;
  const dividerMarginTop = isCompact ? 6 : 8;
  const dividerMarginBottom = isCompact ? 10 : 12;
  const itemGap = isCompact ? 8 : 10;
  const leadFontSize = isCompact ? "12px" : "13px";
  const bodyFontSize = isCompact ? "12px" : "13px";
  const bodyLineHeight = isCompact ? "1.4" : "1.45";

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[8px] border"
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

      {resolvedWatermarkText ? (
        <div
          className="absolute right-[16px] top-[14px] text-[42px] font-black leading-none"
          style={{ color: "#FDEBEC" }}
        >
          {resolvedWatermarkText}
        </div>
      ) : null}

      <div
        className="flex items-center justify-center rounded-[12px]"
        style={{
          backgroundColor: iconBackgroundColor,
          width: iconBoxSize,
          height: iconBoxSize,
          marginBottom: iconMarginBottom,
        }}
      >
        <FinanceIcon
          name={icon}
          className={isCompact ? "h-[22px] w-[22px]" : "h-6 w-6"}
          stroke={accentColor}
        />
      </div>

      <h2
        className="font-bold leading-[1.2]"
        style={{
          color: "var(--background-text,#212121)",
          fontSize: titleFontSize,
        }}
      >
        {title}
      </h2>

      <div
        className="h-px w-full"
        style={{
          backgroundColor: "var(--stroke,#E5E7EB)",
          marginTop: dividerMarginTop,
          marginBottom: dividerMarginBottom,
        }}
      />

      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{ gap: itemGap }}
      >
        {items.map((item, index) => (
          <div
            key={`${title}-${index}`}
            className="flex items-start gap-[12px]"
          >
            <StableInlineRow
              height={BULLET_ITEM_LINE_HEIGHT}
              gap={0}
              inline={false}
              className="w-[6px] flex-none"
            >
              <div
                className="h-[6px] w-[6px] rounded-full"
                style={{ backgroundColor: accentColor }}
              />
            </StableInlineRow>
            <div className="flex min-w-0 flex-1 flex-col">
              <StableInlineRow
                height={BULLET_ITEM_LINE_HEIGHT}
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
