import React, { type ReactNode } from "react";

import { getToneColor, type RedBlueTone, redBlueTheme } from "../theme/tokens.ts";

type RedBlueTopicCardProps = {
  number?: string;
  title: string;
  description: string;
  icon?: ReactNode;
  tone?: RedBlueTone;
  density?: "normal" | "compact";
};

const RedBlueTopicCard = ({
  number,
  title,
  description,
  icon,
  tone = "purple",
  density = "normal",
}: RedBlueTopicCardProps) => {
  const color = getToneColor(tone);
  const compact = density === "compact";
  return (
    <div
      className="relative flex flex-col justify-between overflow-hidden rounded-[18px] bg-white"
      style={{
        minHeight: compact ? 104 : 146,
        padding: compact ? 14 : 22,
        border: `1px solid ${redBlueTheme.colors.softStroke}`,
        boxShadow: `0 8px 24px ${redBlueTheme.colors.shadow}`,
      }}
    >
      <div
        className="pointer-events-none absolute right-[-34px] top-[-34px] z-0 rounded-full"
        style={{
          width: compact ? 72 : 96,
          height: compact ? 72 : 96,
          backgroundColor: `${color}18`,
        }}
      />
      <div className="relative z-[1] flex items-start justify-between gap-[16px]">
        <div
          className="flex items-center justify-center rounded-[14px] font-black"
          style={{
            width: compact ? 34 : 44,
            height: compact ? 34 : 44,
            backgroundColor: `${color}18`,
            color,
            fontSize: compact ? 13 : 16,
          }}
        >
          {icon ?? number}
        </div>
        {number ? (
          <div
            className="text-[38px] font-black leading-none"
            style={{
              color,
              fontFamily: redBlueTheme.fonts.heading,
              fontSize: compact ? 28 : 38,
              opacity: 0.18,
            }}
          >
            {number}
          </div>
        ) : null}
      </div>
      <div className="relative z-[1]">
        <div
          className="mt-[20px] text-[20px] font-extrabold leading-[24px]"
          style={{
            color: redBlueTheme.colors.backgroundText,
            fontSize: compact ? 15 : 20,
            lineHeight: compact ? "18px" : "24px",
            marginTop: compact ? 10 : 20,
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </div>
        <div
          className="mt-[8px] text-[14px] font-medium leading-[20px]"
          style={{
            color: redBlueTheme.colors.mutedText,
            fontSize: compact ? 11 : 14,
            lineHeight: compact ? "15px" : "20px",
            marginTop: compact ? 5 : 8,
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
};

export default RedBlueTopicCard;
