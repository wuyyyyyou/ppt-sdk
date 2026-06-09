import React, { type ReactNode } from "react";

import { getToneColor, type RedBlueTone, redBlueTheme } from "../theme/tokens.ts";

type RedBlueInsightCardProps = {
  title?: string;
  text: string;
  tone?: RedBlueTone;
  icon?: ReactNode;
};

const RedBlueInsightCard = ({
  title,
  text,
  tone = "purple",
  icon,
}: RedBlueInsightCardProps) => {
  const color = getToneColor(tone);
  return (
    <div
      className="flex gap-[16px] rounded-[16px] bg-white p-[20px]"
      style={{
        border: `1px solid ${redBlueTheme.colors.softStroke}`,
        boxShadow: `0 5px 18px ${redBlueTheme.colors.shadow}`,
      }}
    >
      <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px]" style={{ backgroundColor: `${color}16`, color }}>
        {icon ?? "!"}
      </div>
      <div>
        {title ? <div className="text-[17px] font-black" style={{ color: redBlueTheme.colors.backgroundText }}>{title}</div> : null}
        <div className="text-[15px] font-semibold leading-[22px]" style={{ color: redBlueTheme.colors.mutedText }}>
          {text}
        </div>
      </div>
    </div>
  );
};

export default RedBlueInsightCard;
