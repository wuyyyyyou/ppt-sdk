import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
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
  labelFontSize?: number;
  yAxisWidth?: number;
  tickFormatter?: (value: number) => string;
};

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const defaultTickFormatter = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

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
  labelFontSize = 11,
  yAxisWidth = 54,
  tickFormatter = defaultTickFormatter,
}: FinanceBarChartProps) => {
  const data = buildBarData(labels, series, minValue, maxValue);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 18, bottom: 0, left: 8 }}
            barGap={10}
            barCategoryGap="26%"
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
              tick={{ fill: "#616161", fontSize: labelFontSize }}
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
              <Bar
                key={entry.label}
                dataKey={entry.label}
                fill={entry.color}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {legend ? <div className="flex-none pt-[6px]">{legend}</div> : null}
    </div>
  );
};

export default FinanceBarChart;
