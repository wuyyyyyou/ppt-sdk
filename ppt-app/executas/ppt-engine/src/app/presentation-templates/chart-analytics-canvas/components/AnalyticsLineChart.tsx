import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { chartAnalyticsTheme } from "../theme/tokens.ts";

export type AnalyticsLineSeries = {
  label: string;
  color?: string;
  values: number[];
};

type AnalyticsLineChartProps = {
  labels: string[];
  series: AnalyticsLineSeries[];
  minValue: number;
  maxValue: number;
  ticks: number[];
  width: number;
  height: number;
  tickSuffix?: string;
  showZeroLine?: boolean;
};

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const buildData = (
  labels: string[],
  series: AnalyticsLineSeries[],
  minValue: number,
  maxValue: number,
) =>
  labels.map((label, index) => {
    const row: Record<string, string | number> = { label };
    series.forEach((entry) => {
      row[entry.label] = clampValue(entry.values[index] ?? 0, minValue, maxValue);
    });
    return row;
  });

const AnalyticsLineChart = ({
  labels,
  series,
  minValue,
  maxValue,
  ticks,
  width,
  height,
  tickSuffix = "",
  showZeroLine = true,
}: AnalyticsLineChartProps) => {
  const data = buildData(labels, series, minValue, maxValue);

  return (
    <div
      data-pptx-export="screenshot"
      data-chart-like="true"
      className="overflow-hidden"
      style={{ width, height }}
    >
      <LineChart
        width={width}
        height={height}
        data={data}
        margin={{ top: 18, right: 18, bottom: 2, left: 0 }}
      >
        <CartesianGrid vertical={false} stroke={chartAnalyticsTheme.colors.grid} strokeWidth={1} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={18}
          height={34}
          tick={{ fill: chartAnalyticsTheme.colors.textSubtle, fontSize: 10, fontWeight: 500 }}
        />
        <YAxis
          width={46}
          domain={[minValue, maxValue]}
          ticks={ticks}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => `${Number(value)}${tickSuffix}`}
          tick={{ fill: chartAnalyticsTheme.colors.textSubtle, fontSize: 10 }}
        />
        {showZeroLine ? (
          <ReferenceLine y={0} stroke={chartAnalyticsTheme.colors.textMuted} strokeDasharray="5 5" strokeWidth={1} />
        ) : null}
        {series.map((entry, index) => (
          <Line
            key={entry.label}
            type="monotone"
            dataKey={entry.label}
            stroke={entry.color ?? chartAnalyticsTheme.palette.chart[index % chartAnalyticsTheme.palette.chart.length]}
            strokeWidth={2.5}
            dot={{ r: 2.5, strokeWidth: 1.5, fill: chartAnalyticsTheme.colors.card }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </div>
  );
};

export default AnalyticsLineChart;
