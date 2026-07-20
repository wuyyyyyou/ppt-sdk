import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { redBlueComparisonTheme } from "../theme/tokens.ts";

export type StackedCompositionSegment = {
  key: string;
  label: string;
  color?: string;
  textColor?: string;
};

export type StackedCompositionRow = {
  label: string;
  values: Record<string, number>;
};

type StackedCompositionBarChartProps = {
  rows: StackedCompositionRow[];
  segments: StackedCompositionSegment[];
  unitLabel?: string;
  height?: number;
};

type LabelProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string;
};

const asNumber = (value: number | string | undefined, fallback = 0) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatPercent = (value: number | string | undefined, unitLabel = "%") => {
  const numberValue = asNumber(value);
  const formatted = Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(1);
  return `${formatted}${unitLabel}`;
};

const StackedCompositionBarChart = ({
  rows,
  segments,
  unitLabel = "%",
  height = 338,
}: StackedCompositionBarChartProps) => {
  const renderSegmentLabel =
    (segment: StackedCompositionSegment) =>
    ({ x, y, width, height: labelHeight, value }: LabelProps) => {
      const segmentWidth = asNumber(width);
      if (segmentWidth < 52 || asNumber(value) <= 0) {
        return null;
      }

      return (
        <text
          dominantBaseline="central"
          fill={segment.textColor ?? redBlueComparisonTheme.colors.textInverse}
          fontFamily={redBlueComparisonTheme.fonts.body}
          fontSize={13}
          fontWeight={900}
          textAnchor="middle"
          x={asNumber(x) + segmentWidth / 2}
          y={asNumber(y) + asNumber(labelHeight) / 2}
        >
          {formatPercent(value, unitLabel)}
        </text>
      );
    };

  return (
    <div className="h-full min-h-0 w-full" data-validation-ignore="true">
      <ResponsiveContainer height={height} width="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 20, right: 28, bottom: 14, left: 8 }}
          barCategoryGap="34%"
        >
          <CartesianGrid
            horizontal={false}
            stroke={redBlueComparisonTheme.colors.grid}
            strokeDasharray="3 3"
          />
          <XAxis
            axisLine={false}
            domain={[0, 100]}
            tick={{
              fill: redBlueComparisonTheme.colors.textSubtle,
              fontSize: 11,
              fontWeight: 800,
            }}
            tickFormatter={(value) => `${value}${unitLabel}`}
            tickLine={false}
            ticks={[0, 25, 50, 75, 100]}
            type="number"
          />
          <YAxis
            axisLine={false}
            dataKey="label"
            tick={{
              fill: redBlueComparisonTheme.colors.textPrimary,
              fontSize: 16,
              fontWeight: 900,
            }}
            tickLine={false}
            type="category"
            width={96}
          />
          <Legend
            align="right"
            iconSize={10}
            iconType="square"
            verticalAlign="top"
            wrapperStyle={{
              color: redBlueComparisonTheme.colors.textMuted,
              fontFamily: redBlueComparisonTheme.fonts.body,
              fontSize: 12,
              fontWeight: 800,
              paddingBottom: 12,
            }}
          />
          {segments.map((segment) => (
            <Bar
              key={segment.key}
              dataKey={(row: StackedCompositionRow) => row.values[segment.key] ?? 0}
              fill={segment.color ?? redBlueComparisonTheme.colors.chart1}
              isAnimationActive={false}
              name={segment.label}
              radius={0}
              stackId="composition"
            >
              <LabelList content={renderSegmentLabel(segment)} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StackedCompositionBarChart;
