import React from "react";

import { chartAnalyticsTheme } from "../theme/tokens.ts";

export type StructureLegendItem = {
  label: string;
  color: string;
};

type StructureLegendBarProps = {
  items: StructureLegendItem[];
};

const StructureLegendBar = ({ items }: StructureLegendBarProps) => (
  <div className="flex justify-center">
    <div
      className="flex max-w-[840px] items-center justify-center gap-[30px] rounded-full border bg-white px-[32px] py-[10px]"
      style={{
        borderColor: chartAnalyticsTheme.colors.stroke,
        boxShadow: "0 2px 7px rgba(15,23,42,0.05)",
      }}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-[8px] text-[14px] font-bold leading-none" style={{ color: "#475569" }}>
          <span className="h-[12px] w-[12px] rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  </div>
);

export default StructureLegendBar;
