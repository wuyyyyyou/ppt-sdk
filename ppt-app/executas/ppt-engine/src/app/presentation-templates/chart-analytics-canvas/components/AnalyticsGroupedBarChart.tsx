import React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { chartAnalyticsTheme } from "../theme/tokens.ts";

export type AnalyticsBarSeries = {
  label: string;
  color?: string;
  values: number[];
};

type AnalyticsGroupedBarChartProps = {
  labels: string[];
  series: AnalyticsBarSeries[];
  minValue: number;
  maxValue: number;
  ticks: number[];
  width: number;
  height: number;
  tickSuffix?: string;
};

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const buildData = (labels: string[], series: AnalyticsBarSeries[], minValue: number, maxValue: number) =>
  labels.map((label, index) => {
    const row: Record<string, string | number> = { label };
    series.forEach((entry) => {
      row[entry.label] = clampValue(entry.values[index] ?? 0, minValue, maxValue);
    });
    return row;
  });

const AnalyticsGroupedBarChart = ({
  labels,
  series,
  minValue,
  maxValue,
  ticks,
  width,
  height,
  tickSuffix = "",
}: AnalyticsGroupedBarChartProps) => {
  const data = buildData(labels, series, minValue, maxValue);

  return (
    <div

      data-chart-like="true"
      className="overflow-hidden"
      style={{ width, height }}
    >
      <BarChart width={width} height={height} data={data} margin={{ top: 10, right: 18, bottom: 0, left: 0 }} barGap={8} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={chartAnalyticsTheme.colors.grid} strokeWidth={1} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          interval={0}
          height={42}
          tick={{ fill: chartAnalyticsTheme.colors.textSubtle, fontSize: 11, fontWeight: 500 }}
        />
        <YAxis
          width={40}
          domain={[minValue, maxValue]}
          ticks={ticks}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => `${Number(value)}${tickSuffix}`}
          tick={{ fill: chartAnalyticsTheme.colors.textMuted, fontSize: 10 }}
        />
        {series.map((entry, index) => (
          <Bar
            key={entry.label}
            dataKey={entry.label}
            fill={entry.color ?? chartAnalyticsTheme.palette.chart[index % chartAnalyticsTheme.palette.chart.length]}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </div>
  );
};

export default AnalyticsGroupedBarChart;
