import React from "react";

import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";

export type ProjectionLegendItem = {
  label: string;
  tone: RedBlueTone;
};

type ProjectionLegendProps = {
  items: ProjectionLegendItem[];
  projectionLabel?: string;
};

const ProjectionLegend = ({ items, projectionLabel }: ProjectionLegendProps) => {
  return (
    <div
      className="flex flex-none items-center gap-[14px] rounded-[8px] border px-[12px] py-[7px] text-[11px] font-bold"
      style={{
        borderColor: redBlueComparisonTheme.colors.stroke,
        backgroundColor: "rgba(255,255,255,0.92)",
        color: redBlueComparisonTheme.colors.mutedText,
      }}
    >
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 items-center gap-[6px]">
          <span
            className="h-[3px] w-[18px] flex-none rounded-full"
            style={{ backgroundColor: redBlueComparisonTheme.tone[item.tone].color }}
          />
          <span className="max-w-[130px] break-words">{item.label}</span>
        </div>
      ))}
      {projectionLabel ? (
        <div className="flex min-w-0 items-center gap-[6px]" style={{ color: redBlueComparisonTheme.colors.subtleText }}>
          <span
            className="h-0 w-[22px] flex-none"
            style={{ borderTop: `2px dashed ${redBlueComparisonTheme.colors.subtleText}` }}
          />
          <span className="max-w-[150px] break-words">{projectionLabel}</span>
        </div>
      ) : null}
    </div>
  );
};

export default ProjectionLegend;
