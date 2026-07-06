import React from "react";
import { Cell, Pie, PieChart } from "recharts";

import { redBlueComparisonTheme } from "../theme/tokens.ts";

export type SectorDonutSegment = {
  label: string;
  value: number;
  color?: string;
};

type SectorDonutChartProps = {
  segments: SectorDonutSegment[];
  centerValue: string;
  centerLabel: string;
  size?: number;
  strokeWidth?: number;
};

const SectorDonutChart = ({
  segments,
  centerValue,
  centerLabel,
  size = 250,
  strokeWidth = 44,
}: SectorDonutChartProps) => {
  const outerRadius = size / 2 - 6;
  const innerRadius = Math.max(24, outerRadius - strokeWidth);
  const chartData = segments.map((segment) => ({
    name: segment.label,
    value: Math.max(0, segment.value),
    color: segment.color ?? redBlueComparisonTheme.colors.chart1,
  }));

  return (
    <div
      className="relative flex h-full min-h-0 w-full items-center justify-center"
      data-pptx-export="screenshot"
      data-chart-like="true"
      data-validation-ignore="true"
    >
      <PieChart width={size} height={size}>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx={size / 2}
          cy={size / 2}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={90}
          endAngle={-270}
          isAnimationActive={false}
          stroke="none"
          paddingAngle={0}
        >
          {chartData.map((segment) => (
            <Cell key={segment.name} fill={segment.color} stroke="none" />
          ))}
        </Pie>
      </PieChart>

      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
        <div
          className="text-[30px] font-black leading-none"
          style={{
            color: redBlueComparisonTheme.colors.textPrimary,
            fontFamily: redBlueComparisonTheme.fonts.heading,
          }}
        >
          {centerValue}
        </div>
        <div className="mt-[5px] text-[11px] font-black uppercase tracking-[0.4px]" style={{ color: redBlueComparisonTheme.colors.textSubtle }}>
          {centerLabel}
        </div>
      </div>
    </div>
  );
};

export default SectorDonutChart;
