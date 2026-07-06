import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { redFinanceTheme } from "../theme/tokens.ts";

export type FinanceBarChartSeries = {
  label: string;
  color?: string;
  values: number[];
};

type FinanceBarChartProps = {
  labels: string[];
  series: FinanceBarChartSeries[];
  minValue: number;
  maxValue: number;
  ticks: number[];
  legend?: React.ReactNode;
  legendReserve?: number;
  labelFontSize?: number;
  yAxisWidth?: number;
  width?: number;
  height?: number;
  tickFormatter?: (value: number) => string;
  barGap?: number;
  barCategoryGap?: number | string;
  maxBarSize?: number;
};

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const defaultTickFormatter = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);
const defaultXAxisReserve = 30;
const chartColors = [
  redFinanceTheme.colors.chart1,
  redFinanceTheme.colors.chart2,
  redFinanceTheme.colors.chart3,
  redFinanceTheme.colors.chart4,
  redFinanceTheme.colors.chart5,
  redFinanceTheme.colors.chart6,
];

const buildBarData = (
  labels: string[],
  series: FinanceBarChartSeries[],
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

const FinanceBarChart = ({
  labels,
  series,
  minValue,
  maxValue,
  ticks,
  legend,
  legendReserve = 52,
  labelFontSize = 11,
  yAxisWidth = 54,
  width,
  height,
  tickFormatter = defaultTickFormatter,
  barGap = 8,
  barCategoryGap = "18%",
  maxBarSize,
}: FinanceBarChartProps) => {
  const data = buildBarData(labels, series, minValue, maxValue);
  const chartWidth = width ?? 0;
  const chartHeight = Math.max(0, (height ?? 0) - (legend ? legendReserve : 0));
  const chartMarginLeft = 3;
  const chartMarginRight = Math.max(12, Math.round(yAxisWidth * 0.35));
  const horizontalGridCoordinatesGenerator = ({
    offset,
  }: {
    offset?: { top?: number; height?: number };
  }) => {
    const domainSpan = maxValue - minValue;
    const plotHeight = Math.max(0, offset?.height ?? 0);
    const plotTop = offset?.top ?? 0;
    const plotBottom = plotTop + plotHeight;

    if (domainSpan <= 0) {
      return [plotBottom];
    }

    return ticks.map((tick) => {
      const clampedTick = clampValue(tick, minValue, maxValue);
      const ratio = (clampedTick - minValue) / domainSpan;
      return plotBottom - ratio * plotHeight;
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none" style={{ width: chartWidth, height: chartHeight }}>
        <BarChart
          width={chartWidth}
          height={chartHeight}
          data={data}
          margin={{ top: 8, right: chartMarginRight, bottom: 0, left: chartMarginLeft }}
          barGap={barGap}
          barCategoryGap={barCategoryGap}
          maxBarSize={maxBarSize}
        >
          <CartesianGrid
            vertical={false}
            horizontalCoordinatesGenerator={horizontalGridCoordinatesGenerator}
            stroke={redFinanceTheme.colors.stroke}
            strokeWidth={1}
          />
          <XAxis
            dataKey="label"
            axisLine={{ stroke: redFinanceTheme.colors.axis, strokeWidth: 1 }}
            tickLine={false}
            tick={{ fill: redFinanceTheme.colors.textMuted, fontSize: labelFontSize }}
            interval={0}
            height={defaultXAxisReserve}
          />
          <YAxis
            width={yAxisWidth}
            domain={[minValue, maxValue]}
            ticks={ticks}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => tickFormatter(Number(value))}
            tick={{ fill: redFinanceTheme.colors.textSubtle, fontSize: 10 }}
          />
          {series.map((entry, index) => (
            <Bar
              key={entry.label}
              dataKey={entry.label}
              fill={entry.color ?? chartColors[index % chartColors.length]}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </div>

      {legend ? (
        <div className="flex-none pt-[6px]" style={{ minHeight: legendReserve }}>
          {legend}
        </div>
      ) : null}
    </div>
  );
};

export default FinanceBarChart;
