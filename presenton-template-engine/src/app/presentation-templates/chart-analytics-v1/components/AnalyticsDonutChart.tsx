import React from "react";
import { Cell, Pie, PieChart } from "recharts";

export type AnalyticsDonutSegment = {
  label: string;
  value: number;
  color: string;
};

type AnalyticsDonutChartProps = {
  segments: AnalyticsDonutSegment[];
  centerLabel: string;
  centerValue: string;
  size?: number;
  strokeWidth?: number;
};

const AnalyticsDonutChart = ({
  segments,
  centerLabel,
  centerValue,
  size = 250,
  strokeWidth = 58,
}: AnalyticsDonutChartProps) => {
  const outerRadius = size / 2 - 8;
  const innerRadius = Math.max(34, outerRadius - strokeWidth);
  const chartData = segments.map((segment) => ({
    name: segment.label,
    value: Math.max(0, segment.value),
    color: segment.color,
  }));

  return (
    <div className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden">
      <div data-pptx-export="screenshot" data-chart-like="true">
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
      </div>

      <div className="absolute left-1/2 top-1/2 flex w-[120px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
        <div className="text-[10px] font-bold uppercase leading-[1.1]" style={{ color: "#94A3B8" }}>
          {centerLabel}
        </div>
        <div className="mt-[5px] text-[40px] font-black leading-none" style={{ color: "#334155" }}>
          {centerValue}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDonutChart;
