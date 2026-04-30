import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { redFinanceTheme } from "../theme/tokens.js";

export type BarChartCardBar = {
  label: string;
  value: number;
};

type BarChartCardProps = {
  title: string;
  subtitle: string;
  bars: BarChartCardBar[];
  minValue: number;
  maxValue: number;
  ticks: number[];
};

const chartWidth = 430;
const chartHeight = 320;

const normalizeValue = (value: number) =>
  Number.isFinite(value) ? value : 0;

const formatAxisValue = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

const formatBarLabel = (label: string, maxLength: number) =>
  label.length > maxLength ? `${label.slice(0, maxLength - 1)}...` : label;

const BarChartCard = ({
  title,
  subtitle,
  bars,
  minValue,
  maxValue,
  ticks,
}: BarChartCardProps) => {
  const values = bars.map((bar) => normalizeValue(bar.value));
  const tickValues = ticks
    .map(normalizeValue)
    .filter((tick) => Number.isFinite(tick));
  const dataMin = Math.min(...values, ...tickValues, minValue);
  const dataMax = Math.max(...values, ...tickValues, maxValue);
  const chartMin = Math.min(minValue, maxValue, dataMin);
  const chartMax = Math.max(minValue, maxValue, dataMax, chartMin + 1);
  const visibleTicks = tickValues
    .filter((tick) => tick >= chartMin && tick <= chartMax)
    .slice(0, 10);
  const barCount = bars.length;
  const barWidth = barCount > 6 ? 34 : barCount > 4 ? 52 : 64;
  const labelFontSize = barCount > 6 ? 10 : 12;
  const maxLabelLength = barCount > 6 ? 7 : 10;
  const chartData = bars.map((bar) => ({
    label: bar.label,
    value: normalizeValue(bar.value),
  }));

  return (
    <div
      data-pptx-export="screenshot"
      data-chart-like="true"
      className="flex h-[442px] w-full flex-col rounded-[8px] border px-[20px] py-[20px]"
      style={{
        backgroundColor: "#FAFAFA",
        borderColor: redFinanceTheme.colors.stroke,
        boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
      }}
    >
      <div className="mb-[15px] text-center">
        <div
          className="text-[18px] font-bold"
          style={{ color: redFinanceTheme.colors.backgroundText }}
        >
          {title}
        </div>
        <div
          className="text-[12px]"
          style={{ color: redFinanceTheme.colors.mutedText }}
        >
          {subtitle}
        </div>
      </div>

      <div className="flex flex-1 items-center" data-validation-ignore="true">
        <div className="flex h-[320px] w-full justify-center">
          <BarChart
            width={chartWidth}
            height={chartHeight}
            data={chartData}
            margin={{ top: 6, right: 10, bottom: 0, left: -8 }}
            barSize={barWidth}
          >
            <CartesianGrid
              vertical={false}
              stroke={redFinanceTheme.colors.stroke}
              strokeWidth={1}
            />
            <XAxis
              dataKey="label"
              height={34}
              axisLine={{ stroke: "#D0D0D0", strokeWidth: 1 }}
              tickLine={false}
              interval={0}
              tick={{
                fill: "#424242",
                fontSize: labelFontSize,
                fontWeight: 700,
              }}
              tickFormatter={(value) =>
                formatBarLabel(String(value), maxLabelLength)
              }
            />
            <YAxis
              width={44}
              domain={[chartMin, chartMax]}
              ticks={visibleTicks.length > 0 ? visibleTicks : undefined}
              axisLine={false}
              tickLine={false}
              tick={{
                fill: redFinanceTheme.colors.subtleText,
                fontSize: 11,
              }}
              tickFormatter={(value) => formatAxisValue(Number(value))}
            />
            <Bar
              dataKey="value"
              fill={redFinanceTheme.colors.primary}
              radius={[4, 4, 0, 0]}
              minPointSize={24}
              isAnimationActive={false}
            />
          </BarChart>
        </div>
      </div>
    </div>
  );
};

export default BarChartCard;
