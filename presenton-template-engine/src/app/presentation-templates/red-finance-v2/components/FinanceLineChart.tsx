import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import { redFinanceTheme } from "../theme/tokens.js";

export type FinanceLineChartSeries = {
  label: string;
  color: string;
  values: number[];
};

type FinanceLineChartProps = {
  labels: string[];
  series: FinanceLineChartSeries[];
  minValue: number;
  maxValue: number;
  ticks: number[];
  legend?: React.ReactNode;
  legendReserve?: number;
  yAxisWidth?: number;
  width?: number;
  height?: number;
  tickFormatter?: (value: number) => string;
};

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const defaultTickFormatter = (value: number) => `${value}%`;
const defaultXAxisReserve = 30;

const buildLineData = (
  labels: string[],
  series: FinanceLineChartSeries[],
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

const FinanceLineChart = ({
  labels,
  series,
  minValue,
  maxValue,
  ticks,
  legend,
  legendReserve = 42,
  yAxisWidth = 56,
  width,
  height,
  tickFormatter = defaultTickFormatter,
}: FinanceLineChartProps) => {
  const data = buildLineData(labels, series, minValue, maxValue);
  const chartWidth = width ?? 0;
  const chartHeight = Math.max(0, (height ?? 0) - (legend ? legendReserve : 0));
  const chartMarginLeft = 3;
  const chartMarginRight = Math.max(12, Math.round(yAxisWidth * 0.35));
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
        <LineChart
          width={chartWidth}
          height={chartHeight}
          data={data}
          margin={{ top: 8, right: chartMarginRight, bottom: 0, left: chartMarginLeft }}
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
            tick={{ fill: "#616161", fontSize: 11, fontWeight: 700 }}
            interval={0}
            height={defaultXAxisReserve}
            padding={{ left: 6, right: 18 }}
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
            <Line
              key={entry.label}
              type="monotone"
              dataKey={entry.label}
              stroke={entry.color}
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: "#FFFFFF" }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </div>

      {legend ? (
        <div className="flex-none pt-[4px]" style={{ minHeight: legendReserve }}>
          {legend}
        </div>
      ) : null}
    </div>
  );
};

export default FinanceLineChart;
