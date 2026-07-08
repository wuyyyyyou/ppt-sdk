import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";

export type StructureLegendItem = {
  label: string;
  color?: string;
};

type StructureLegendBarProps = {
  items: StructureLegendItem[];
};

const StructureLegendBar = ({ items }: StructureLegendBarProps) => (
  <div className="flex justify-center">
    <div
      className="flex max-w-[840px] items-center justify-center gap-[30px] rounded-full border px-[32px] py-[10px]"
      style={{
        backgroundColor: chartAnalyticsTheme.colors.card,
        borderColor: chartAnalyticsTheme.colors.stroke,
        boxShadow: chartAnalyticsTheme.shadows.soft,
      }}
    >
      {items.map((item, index) => (
        <div key={item.label} className="flex items-center gap-[8px] text-[14px] font-bold leading-none" style={{ color: chartAnalyticsTheme.colors.signalNeutral }}>
          <span
            className="h-[12px] w-[12px] rounded-full"
            style={{ backgroundColor: item.color ?? chartAnalyticsTheme.palette.structure[index % chartAnalyticsTheme.palette.structure.length] }}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  </div>
);

export default StructureLegendBar;
