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

const resolveRadarOuterRadius = (
  outerRadius: number | string,
  maxRadius: number,
) => {
  if (typeof outerRadius === "number") {
    return Math.max(0, Math.min(outerRadius, maxRadius));
  }

  const percentMatch = outerRadius.trim().match(/^(\d+(?:\.\d+)?)%$/);
  if (percentMatch) {
    return Math.max(0, (Number(percentMatch[1]) / 100) * maxRadius);
  }

  const numeric = Number(outerRadius);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(numeric, maxRadius)) : maxRadius;
};

const scaleRadiusTicks = (ticks: number[], minValue: number, maxValue: number, outerRadius: number) => {
  const range = maxValue - minValue;
  if (range <= 0 || outerRadius <= 0) {
    return [];
  }

  return ticks.map((value) => ((value - minValue) / range) * outerRadius);
};

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
  const maxRadius = Math.max(0, Math.min(chartWidth, chartHeight) / 2 - 24);
  const radarOuterRadius = resolveRadarOuterRadius(outerRadius, maxRadius);
  const radiusTicks: TickItem[] = ticks.map((value, index) => ({
    value,
    coordinate: value,
    index,
  }));
  const polarRadius = scaleRadiusTicks(ticks, minValue, maxValue, radarOuterRadius);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none" style={{ width: chartWidth, height: chartHeight }}>
        <RadarChart
          width={chartWidth}
          height={chartHeight}
          data={data}
          outerRadius={radarOuterRadius}
          margin={{ top: 2, right: 12, bottom: 2, left: 12 }}
        >
          <PolarGrid
            gridType="polygon"
            stroke="#D6D6D6"
            radialLines
            polarRadius={polarRadius}
          />
          <PolarAngleAxis
            dataKey="label"
            tick={{
              fill: redFinanceTheme.colors.mutedText,
              fontSize: labelFontSize,
              fontWeight: 700,
            }}
            tickLine={false}
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
