import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
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
  yAxisWidth?: number;
  tickFormatter?: (value: number) => string;
};

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const defaultTickFormatter = (value: number) => `${value}%`;

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
  yAxisWidth = 56,
  tickFormatter = defaultTickFormatter,
}: FinanceLineChartProps) => {
  const data = buildLineData(labels, series, minValue, maxValue);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 18, bottom: 0, left: 10 }}
          >
            <CartesianGrid
              vertical={false}
              stroke={redFinanceTheme.colors.stroke}
              strokeWidth={1}
            />
            <XAxis
              dataKey="label"
              axisLine={{ stroke: "#D0D0D0", strokeWidth: 1 }}
              tickLine={false}
              tick={{ fill: "#616161", fontSize: 11, fontWeight: 700 }}
              interval={0}
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
        </ResponsiveContainer>
      </div>

      {legend ? <div className="flex-none pt-[4px]">{legend}</div> : null}
    </div>
  );
};

export default FinanceLineChart;
