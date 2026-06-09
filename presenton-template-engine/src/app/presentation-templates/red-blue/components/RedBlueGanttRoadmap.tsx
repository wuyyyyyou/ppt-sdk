import React from "react";

import { getToneColor, type RedBlueTone, redBlueTheme } from "../theme/tokens.ts";

export type RedBlueRoadmapItem = {
  phase: string;
  owner?: string;
  label: string;
  start: number;
  span: number;
  tone?: RedBlueTone;
};

type RedBlueGanttRoadmapProps = {
  columns: string[];
  rows: RedBlueRoadmapItem[];
};

const RedBlueGanttRoadmap = ({ columns, rows }: RedBlueGanttRoadmapProps) => {
  return (
    <div
      className="overflow-hidden rounded-[18px] bg-white"
      style={{
        border: `1px solid ${redBlueTheme.colors.softStroke}`,
        boxShadow: `0 8px 26px ${redBlueTheme.colors.shadow}`,
      }}
    >
      <div className="grid h-[46px] grid-cols-[210px_1fr] border-b" style={{ borderColor: redBlueTheme.colors.stroke }}>
        <div className="flex items-center px-[20px] text-[13px] font-black uppercase" style={{ color: redBlueTheme.colors.mutedText }}>
          Phase
        </div>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${columns.length},1fr)` }}>
          {columns.map((column) => (
            <div key={column} className="flex items-center justify-center text-[12px] font-black" style={{ color: redBlueTheme.colors.mutedText }}>
              {column}
            </div>
          ))}
        </div>
      </div>
      <div>
        {rows.map((row) => {
          const color = getToneColor(row.tone ?? "purple");
          return (
            <div key={row.phase} className="grid min-h-[64px] grid-cols-[210px_1fr] border-b last:border-b-0" style={{ borderColor: redBlueTheme.colors.softStroke }}>
              <div className="flex flex-col justify-center px-[20px]">
                <div className="text-[15px] font-black" style={{ color: redBlueTheme.colors.backgroundText }}>{row.phase}</div>
                {row.owner ? <div className="mt-[3px] text-[11px] font-bold" style={{ color }}>{row.owner}</div> : null}
              </div>
              <div className="relative grid items-center px-[8px]" style={{ gridTemplateColumns: `repeat(${columns.length},1fr)` }}>
                {columns.map((column) => <div key={column} className="h-full border-l" style={{ borderColor: redBlueTheme.colors.softStroke }} />)}
                <div
                  className="absolute flex h-[28px] items-center rounded-full px-[14px] text-[12px] font-black text-white"
                  style={{
                    left: `calc(${(row.start / columns.length) * 100}% + 8px)`,
                    width: `calc(${(row.span / columns.length) * 100}% - 16px)`,
                    backgroundColor: color,
                  }}
                >
                  {row.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RedBlueGanttRoadmap;
