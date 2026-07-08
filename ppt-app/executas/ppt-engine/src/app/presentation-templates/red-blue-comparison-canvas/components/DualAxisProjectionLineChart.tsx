import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  XAxis,
  YAxis,
} from "recharts";

import { redBlueComparisonTheme, type ComparisonTone } from "../theme/tokens.ts";

export type ProjectionAxisConfig = {
  id: "left" | "right";
  label: string;
  min: number;
  max: number;
  ticks: number[];
  tickSuffix?: string;
  tone: ComparisonTone;
  width?: number;
};

export type ProjectionLineSeries = {
  label: string;
  axis: "left" | "right";
  tone: ComparisonTone;
  values: number[];
};

type DualAxisProjectionLineChartProps = {
  labels: string[];
  series: ProjectionLineSeries[];
  leftAxis: ProjectionAxisConfig;
  rightAxis: ProjectionAxisConfig;
  projectionStartIndex?: number;
  width: number;
  height: number;
};

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const buildData = (
  labels: string[],
  series: ProjectionLineSeries[],
  leftAxis: ProjectionAxisConfig,
  rightAxis: ProjectionAxisConfig,
  projectionStartIndex: number,
) =>
  labels.map((label, labelIndex) => {
    const row: Record<string, string | number | null> = { label };

    series.forEach((entry, seriesIndex) => {
      const axis = entry.axis === "right" ? rightAxis : leftAxis;
      const value = clampValue(entry.values[labelIndex] ?? axis.min, axis.min, axis.max);
      const actualKey = `series${seriesIndex}Actual`;
      const projectedKey = `series${seriesIndex}Projected`;

      row[actualKey] = labelIndex <= projectionStartIndex ? value : null;
      row[projectedKey] = labelIndex >= projectionStartIndex ? value : null;
    });

    return row;
  });

const formatTick = (value: number, suffix?: string) =>
  `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix ?? ""}`;

const DualAxisProjectionLineChart = ({
  labels,
  series,
  leftAxis,
  rightAxis,
  projectionStartIndex = Math.max(0, labels.length - 2),
  width,
  height,
}: DualAxisProjectionLineChartProps) => {
  const boundedProjectionIndex = Math.max(0, Math.min(labels.length - 1, projectionStartIndex));
  const data = buildData(labels, series, leftAxis, rightAxis, boundedProjectionIndex);
  const projectionStartLabel = labels[boundedProjectionIndex];
  const projectionEndLabel = labels[labels.length - 1];
  const leftTone = redBlueComparisonTheme.tone[leftAxis.tone];
  const rightTone = redBlueComparisonTheme.tone[rightAxis.tone];

  return (
    <LineChart
      width={width}
      height={height}
      data={data}
      margin={{ top: 8, right: 18, bottom: 2, left: 6 }}
    >
      <CartesianGrid
        vertical={false}
        stroke={redBlueComparisonTheme.colors.grid}
        strokeDasharray="4 6"
        strokeOpacity={0.72}
      />
      <XAxis
        dataKey="label"
        axisLine={{ stroke: redBlueComparisonTheme.colors.stroke, strokeWidth: 1 }}
        tickLine={false}
        tick={{ fill: redBlueComparisonTheme.colors.textMuted, fontSize: 11, fontWeight: 700 }}
        interval={0}
        height={30}
        padding={{ left: 14, right: 14 }}
      />
      <YAxis
        yAxisId="left"
        width={leftAxis.width ?? 56}
        domain={[leftAxis.min, leftAxis.max]}
        ticks={leftAxis.ticks}
        axisLine={false}
        tickLine={false}
        tickFormatter={(value) => formatTick(Number(value), leftAxis.tickSuffix)}
        tick={{ fill: leftTone.color, fontSize: 10, fontWeight: 700 }}
        label={{
          value: leftAxis.label,
          angle: -90,
          position: "insideLeft",
          fill: leftTone.color,
          fontSize: 11,
          fontWeight: 700,
          dy: 0,
        }}
      />
      <YAxis
        yAxisId="right"
        orientation="right"
        width={rightAxis.width ?? 58}
        domain={[rightAxis.min, rightAxis.max]}
        ticks={rightAxis.ticks}
        axisLine={false}
        tickLine={false}
        tickFormatter={(value) => formatTick(Number(value), rightAxis.tickSuffix)}
        tick={{ fill: rightTone.color, fontSize: 10, fontWeight: 700 }}
        label={{
          value: rightAxis.label,
          angle: 90,
          position: "insideRight",
          fill: rightTone.color,
          fontSize: 11,
          fontWeight: 700,
          dy: 0,
        }}
      />
      {projectionStartLabel && projectionEndLabel ? (
        <ReferenceArea
          x1={projectionStartLabel}
          x2={projectionEndLabel}
          yAxisId="left"
          fill={redBlueComparisonTheme.colors.neutralTint}
          fillOpacity={0.52}
          strokeOpacity={0}
        />
      ) : null}
      {series.map((entry, seriesIndex) => {
        const tone = redBlueComparisonTheme.tone[entry.tone];
        const yAxisId = entry.axis === "right" ? "right" : "left";
        const actualKey = `series${seriesIndex}Actual`;
        const projectedKey = `series${seriesIndex}Projected`;

        return (
          <React.Fragment key={`${entry.label}-${seriesIndex}`}>
            <Line
              type="monotone"
              yAxisId={yAxisId}
              dataKey={actualKey}
              stroke={tone.color}
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: redBlueComparisonTheme.colors.card, stroke: tone.color }}
              activeDot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              yAxisId={yAxisId}
              dataKey={projectedKey}
              stroke={tone.color}
              strokeOpacity={0.62}
              strokeWidth={3}
              strokeDasharray="7 7"
              dot={{ r: 4, strokeWidth: 2, fill: redBlueComparisonTheme.colors.card, stroke: tone.color }}
              activeDot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          </React.Fragment>
        );
      })}
    </LineChart>
  );
};

export default DualAxisProjectionLineChart;
