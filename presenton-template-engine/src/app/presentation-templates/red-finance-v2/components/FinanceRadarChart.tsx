import React from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts";
import type { TickItem } from "recharts/types/util/types";

import { redFinanceTheme } from "../theme/tokens.js";

export type FinanceRadarChartSeries = {
  label: string;
  color: string;
  fillColor?: string;
  dashed?: boolean;
  values: number[];
};

type FinanceRadarChartProps = {
  labels: string[];
  series: FinanceRadarChartSeries[];
  minValue: number;
  maxValue: number;
  ticks: number[];
  legend?: React.ReactNode;
  legendReserve?: number;
  width?: number;
  height?: number;
  labelFontSize?: number;
  radiusAxisWidth?: number;
  outerRadius?: number | string;
  tickFormatter?: (value: number) => string;
};

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const defaultTickFormatter = (value: number) => `${value}`;

const buildRadarData = (
  labels: string[],
  series: FinanceRadarChartSeries[],
  minValue: number,
  maxValue: number,
) =>
  labels.map((label, index) => {
    const row: Record<string, string | number> = { label };
    series.forEach((entry) => {
      row[entry.label] = clampValue(entry.values[index] ?? minValue, minValue, maxValue);
    });
    return row;
  });

const FinanceRadarChart = ({
  labels,
  series,
  minValue,
  maxValue,
  ticks,
  legend,
  legendReserve = 42,
  width,
  height,
  labelFontSize = 11,
  radiusAxisWidth = 22,
  outerRadius = "64%",
  tickFormatter = defaultTickFormatter,
}: FinanceRadarChartProps) => {
  const data = buildRadarData(labels, series, minValue, maxValue);
  const chartWidth = width ?? 0;
  const chartHeight = Math.max(0, (height ?? 0) - (legend ? legendReserve : 0));
  const radiusTicks: TickItem[] = ticks.map((value, index) => ({
    value,
    coordinate: value,
    index,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none" style={{ width: chartWidth, height: chartHeight }}>
        <RadarChart
          width={chartWidth}
          height={chartHeight}
          data={data}
          outerRadius={outerRadius}
          margin={{ top: 10, right: 28, bottom: 12, left: 28 }}
        >
          <PolarGrid
            gridType="polygon"
            stroke={redFinanceTheme.colors.stroke}
            radialLines
          />
          <PolarAngleAxis
            dataKey="label"
            tick={{
              fill: redFinanceTheme.colors.mutedText,
              fontSize: labelFontSize,
              fontWeight: 700,
            }}
          />
          <PolarRadiusAxis
            axisLine={false}
            angle={90}
            domain={[minValue, maxValue]}
            tickCount={ticks.length}
            ticks={radiusTicks}
            tick={{
              fill: "#9E9E9E",
              fontSize: 9,
            }}
            tickFormatter={(value) => tickFormatter(Number(value))}
            tickSize={0}
            tickMargin={6}
            width={radiusAxisWidth}
          />
          {series.map((entry) => (
            <Radar
              key={entry.label}
              name={entry.label}
              dataKey={entry.label}
              stroke={entry.color}
              fill={entry.fillColor ?? entry.color}
              fillOpacity={entry.fillColor ? 1 : 0.12}
              strokeWidth={entry.dashed ? 2 : 3}
              strokeDasharray={entry.dashed ? "5 4" : undefined}
              dot={{
                r: 3.5,
                strokeWidth: 2,
                fill: "#FFFFFF",
              }}
              isAnimationActive={false}
            />
          ))}
        </RadarChart>
      </div>

      {legend ? (
        <div className="flex-none pt-[6px]" style={{ minHeight: legendReserve }}>
          {legend}
        </div>
      ) : null}
    </div>
  );
};

export default FinanceRadarChart;
