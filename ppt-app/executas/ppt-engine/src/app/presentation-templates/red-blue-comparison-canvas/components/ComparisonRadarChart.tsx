import React from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts";

import { redBlueComparisonTheme, type ComparisonTone } from "../theme/tokens.ts";

export type ComparisonRadarSeries = {
  label: string;
  tone?: ComparisonTone;
  color?: string;
  fillColor?: string;
  values: number[];
};

type ComparisonRadarChartProps = {
  labels: string[];
  series: ComparisonRadarSeries[];
  minValue?: number;
  maxValue?: number;
  ticks?: number[];
  width?: number;
  height?: number;
  labelFontSize?: number;
  outerRadius?: number | string;
};

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const resolveColor = (entry: ComparisonRadarSeries, index: number) => {
  if (entry.color) {
    return entry.color;
  }

  if (entry.tone) {
    return redBlueComparisonTheme.tone[entry.tone].color;
  }

  return index === 0
    ? redBlueComparisonTheme.colors.sideA
    : redBlueComparisonTheme.colors.sideB;
};

const buildRadarData = (
  labels: string[],
  series: ComparisonRadarSeries[],
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

const ComparisonRadarChart = ({
  labels,
  series,
  minValue = 0,
  maxValue = 100,
  ticks = [20, 40, 60, 80, 100],
  width = 610,
  height = 350,
  labelFontSize = 12,
  outerRadius = "66%",
}: ComparisonRadarChartProps) => {
  const data = buildRadarData(labels, series, minValue, maxValue);
  const coloredSeries = series.map((entry, index) => ({
    ...entry,
    color: resolveColor(entry, index),
  }));

  return (
    <div
      className="h-full min-h-0 w-full"
      data-chart-like="true"
      data-validation-ignore="true"

    >
      <RadarChart
        width={width}
        height={height}
        data={data}
        outerRadius={outerRadius}
        margin={{ top: 14, right: 36, bottom: 14, left: 36 }}
      >
        <PolarGrid
          gridType="polygon"
          stroke={redBlueComparisonTheme.colors.grid}
          radialLines
        />
        <PolarAngleAxis
          dataKey="label"
          tick={{
            fill: redBlueComparisonTheme.colors.textMuted,
            fontSize: labelFontSize,
            fontWeight: 800,
          }}
          tickLine={false}
        />
        <PolarRadiusAxis
          axisLine={false}
          domain={[minValue, maxValue]}
          tickCount={ticks.length}
          tick={false}
          tickLine={false}
        />
        {coloredSeries.map((entry) => (
          <Radar
            key={entry.label}
            name={entry.label}
            dataKey={entry.label}
            stroke={entry.color}
            fill={entry.fillColor ?? entry.color}
            fillOpacity={entry.fillColor ? 1 : 0.18}
            strokeWidth={2.5}
            dot={{
              r: 3.5,
              strokeWidth: 2,
              fill: redBlueComparisonTheme.colors.card,
            }}
            isAnimationActive={false}
          />
        ))}
      </RadarChart>
    </div>
  );
};

export default ComparisonRadarChart;
