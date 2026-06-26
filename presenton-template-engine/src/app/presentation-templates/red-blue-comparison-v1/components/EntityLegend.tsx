import React from "react";

import { redBlueComparisonTheme } from "../theme/tokens.ts";

export type EntityLegendItem = {
  label: string;
  color?: string;
};

type EntityLegendProps = {
  items: EntityLegendItem[];
};

const defaultColors = [
  redBlueComparisonTheme.colors.chinaRed,
  redBlueComparisonTheme.colors.japanBlue,
  redBlueComparisonTheme.colors.koreaRed,
];

const EntityLegend = ({ items }: EntityLegendProps) => {
  return (
    <div
      className="flex items-center justify-center gap-[34px] rounded-full px-[40px] py-[16px]"
      style={{
        backgroundColor: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(45,52,54,0.06)",
        boxShadow: `0 12px 30px ${redBlueComparisonTheme.colors.shadowSoft}`,
      }}
    >
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex items-center gap-[12px]">
          <div
            className="h-[16px] w-[16px] flex-none rounded-full"
            style={{ backgroundColor: item.color ?? defaultColors[index % defaultColors.length] }}
          />
          <div
            className="whitespace-nowrap text-[16px] font-black uppercase leading-none"
            style={{
              color: redBlueComparisonTheme.colors.backgroundText,
              fontFamily: redBlueComparisonTheme.fonts.heading,
            }}
          >
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
};

export default EntityLegend;
