import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { redFinanceTheme } from "../theme/tokens.js";

export type FinanceBarChartSeries = {
  label: string;
  color: string;
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
};

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const defaultTickFormatter = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);
const defaultXAxisReserve = 30;

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
}: FinanceBarChartProps) => {
  const data = buildBarData(labels, series, minValue, maxValue);
  const chartWidth = width ?? 0;
  const chartHeight = Math.max(0, (height ?? 0) - (legend ? legendReserve : 0));
  const chartMarginLeft = 8;
  const horizontalGridCoordinatesGenerator = ({
    offset,
  }: {
    offset: { top: number; height: number };
  }) => {
    const domainSpan = maxValue - minValue;
    const plotHeight = Math.max(0, offset.height);
    const plotTop = offset.top;
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
          margin={{ top: 8, right: yAxisWidth + chartMarginLeft, bottom: 0, left: chartMarginLeft }}
          barGap={10}
          barCategoryGap="26%"
        >
          <CartesianGrid
            vertical={false}
            horizontalCoordinatesGenerator={horizontalGridCoordinatesGenerator}
            stroke={redFinanceTheme.colors.stroke}
            strokeWidth={1}
          />
          <XAxis
            dataKey="label"
            axisLine={{ stroke: "#D0D0D0", strokeWidth: 1 }}
            tickLine={false}
            tick={{ fill: "#616161", fontSize: labelFontSize }}
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
            tick={{ fill: "#9E9E9E", fontSize: 10 }}
          />
          {series.map((entry) => (
            <Bar
              key={entry.label}
              dataKey={entry.label}
              fill={entry.color}
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
