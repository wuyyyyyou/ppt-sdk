import React from "react";

import { getToneColor, type RedBlueTone, redBlueTheme } from "../theme/tokens.ts";

type LegendItem = {
  label: string;
  tone: RedBlueTone;
};

type RedBlueLegendProps = {
  items: LegendItem[];
};

const RedBlueLegend = ({ items }: RedBlueLegendProps) => {
  return (
    <div
      className="inline-flex items-center gap-[34px] rounded-full px-[38px] py-[16px]"
      style={{
        backgroundColor: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(0,0,0,0.05)",
        boxShadow: `0 10px 25px ${redBlueTheme.colors.shadow}`,
      }}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-[12px]">
          <span
            className="h-[16px] w-[16px] rounded-full"
            style={{ backgroundColor: getToneColor(item.tone) }}
          />
          <span
            className="text-[16px] font-extrabold uppercase"
            style={{
              color: redBlueTheme.colors.backgroundText,
              fontFamily: redBlueTheme.fonts.heading,
            }}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
};

export default RedBlueLegend;
