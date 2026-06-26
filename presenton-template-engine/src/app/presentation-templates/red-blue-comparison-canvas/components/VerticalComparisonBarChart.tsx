import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";

import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";

export type VerticalComparisonBarDatum = {
  label: string;
  value: number;
  displayValue: string;
  tone: RedBlueTone;
};

type VerticalComparisonBarChartProps = {
  data: VerticalComparisonBarDatum[];
  maxValue?: number;
  unitLabel?: string;
  yTicks?: number[];
  width?: number;
  height?: number;
};

type RechartsBarLabelProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: string | number;
  index?: number;
};

const formatTick = (value: number, unitLabel?: string) => {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return unitLabel ? `${formatted}${unitLabel}` : formatted;
};

const asNumber = (value: number | string | undefined, fallback = 0) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const VerticalComparisonBarChart = ({
  data,
  maxValue,
  unitLabel,
  yTicks,
  width = 620,
  height = 340,
}: VerticalComparisonBarChartProps) => {
  const safeMax = Math.max(maxValue ?? Math.max(...data.map((item) => item.value), 1) * 1.18, 1);
  const ticks = yTicks ?? [0, safeMax / 2, safeMax];
  const chartData = data.map((item) => ({
    ...item,
    color: redBlueComparisonTheme.tone[item.tone].color,
  }));

  const renderValueLabel = (props: RechartsBarLabelProps) => {
    const item = chartData[props.index ?? 0];
    const x = asNumber(props.x);
    const y = asNumber(props.y);
    const barWidth = asNumber(props.width);

    return (
      <text
        x={x + barWidth / 2}
        y={Math.max(18, y - 12)}
        textAnchor="middle"
        fontSize={15}
        fontWeight={900}
        fill={item?.color ?? redBlueComparisonTheme.colors.backgroundText}
        fontFamily={redBlueComparisonTheme.fonts.body}
      >
        {item?.displayValue ?? props.value}
      </text>
    );
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex h-[26px] flex-none items-center justify-end gap-[18px] pr-[12px]">
        {chartData.map((item) => (
          <div key={item.label} className="flex items-center gap-[7px] text-[12px] font-bold" style={{ color: redBlueComparisonTheme.colors.mutedText }}>
            <div className="h-[9px] w-[9px] rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        <BarChart
          width={width}
          height={height}
          data={chartData}
          margin={{ top: 34, right: 20, bottom: 22, left: 18 }}
          barCategoryGap="34%"
          maxBarSize={86}
        >
          <CartesianGrid
            vertical={false}
            stroke="rgba(45,52,54,0.08)"
            strokeWidth={1}
          />
          <XAxis
            dataKey="label"
            axisLine={{ stroke: redBlueComparisonTheme.colors.stroke, strokeWidth: 1 }}
            tickLine={false}
            tick={{
              fill: redBlueComparisonTheme.colors.backgroundText,
              fontSize: 14,
              fontWeight: 800,
            }}
            interval={0}
          />
          <YAxis
            width={54}
            domain={[0, safeMax]}
            ticks={ticks}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => formatTick(Number(value), unitLabel)}
            tick={{
              fill: redBlueComparisonTheme.colors.subtleText,
              fontSize: 12,
              fontWeight: 700,
            }}
          />
          <Bar dataKey="value" radius={[14, 14, 0, 0]} isAnimationActive={false}>
            {chartData.map((item) => (
              <Cell key={item.label} fill={item.color} stroke={item.color} strokeWidth={1} />
            ))}
            <LabelList dataKey="displayValue" content={renderValueLabel} />
          </Bar>
        </BarChart>
      </div>
    </div>
  );
};

export default VerticalComparisonBarChart;
