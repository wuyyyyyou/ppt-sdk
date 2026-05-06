import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { redFinanceTheme } from "../theme/tokens.js";
import ChartPanelCard from "./ChartPanelCard.js";

export type TrendLineSeries = {
  label: string;
  color: string;
  values: number[];
};

export type TrendBarSeries = {
  label: string;
  color: string;
  values: number[];
};

type TrendChartsPanelProps = {
  aiChartTitle: string;
  aiChartTag?: string;
  aiChartLabels: string[];
  aiChartSeries: TrendLineSeries[];
  incomeChartTitle: string;
  incomeChartTag?: string;
  incomeChartLabels: string[];
  incomeChartSeries: TrendBarSeries[];
};

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const buildLineData = (labels: string[], series: TrendLineSeries[]) =>
  labels.map((label, index) => {
    const row: Record<string, string | number> = { label };
    series.forEach((entry) => {
      row[entry.label] = clampValue(entry.values[index] ?? 0, 0, 100);
    });
    return row;
  });

const buildBarData = (labels: string[], series: TrendBarSeries[]) =>
  labels.map((label, index) => {
    const row: Record<string, string | number> = { label };
    series.forEach((entry) => {
      row[entry.label] = clampValue(entry.values[index] ?? 0, 0, 100);
    });
    return row;
  });

const LineLegend = ({ series }: { series: TrendLineSeries[] }) => (
  <div className="flex items-center justify-center gap-[20px] text-[11px]">
    {series.map((entry) => (
      <div
        key={entry.label}
        className="flex items-center gap-[8px] whitespace-nowrap"
        style={{ color: redFinanceTheme.colors.mutedText }}
      >
        <div className="relative h-[10px] w-[28px]">
          <div
            className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <div
            className="absolute left-1/2 top-1/2 h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2px] bg-white"
            style={{ borderColor: entry.color }}
          />
        </div>
        <span>{entry.label}</span>
      </div>
    ))}
  </div>
);

const BarLegend = ({ series }: { series: TrendBarSeries[] }) => (
  <div className="flex items-center justify-center gap-[28px] text-[12px]">
    {series.map((entry) => (
      <div
        key={entry.label}
        className="flex items-center gap-[8px] whitespace-nowrap"
        style={{ color: redFinanceTheme.colors.mutedText }}
      >
        <div
          className="h-[14px] w-[14px] rounded-[2px]"
          style={{ backgroundColor: entry.color }}
        />
        <span>{entry.label}</span>
      </div>
    ))}
  </div>
);

const TrendChartsPanel = ({
  aiChartTitle,
  aiChartTag,
  aiChartLabels,
  aiChartSeries,
  incomeChartTitle,
  incomeChartTag,
  incomeChartLabels,
  incomeChartSeries,
}: TrendChartsPanelProps) => {
  const lineData = buildLineData(aiChartLabels, aiChartSeries);
  const barData = buildBarData(incomeChartLabels, incomeChartSeries);

  return (
    <div className="flex h-full gap-[30px]">
      <div className="flex-1">
        <ChartPanelCard title={aiChartTitle} tag={aiChartTag}>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={lineData}
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
                    width={56}
                    domain={[0, 100]}
                    ticks={[0, 20, 40, 60, 80, 100]}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fill: "#9E9E9E", fontSize: 10 }}
                  />
                  {aiChartSeries.map((entry) => (
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
            <div className="flex-none pt-[4px]">
              <LineLegend series={aiChartSeries} />
            </div>
          </div>
        </ChartPanelCard>
      </div>

      <div className="flex-1">
        <ChartPanelCard title={incomeChartTitle} tag={incomeChartTag}>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
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
                    tick={{ fill: "#616161", fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis
                    width={54}
                    domain={[0, 60]}
                    ticks={[0, 10, 20, 30, 40, 50, 60]}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fill: "#9E9E9E", fontSize: 10 }}
                  />
                  {incomeChartSeries.map((entry) => (
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
            <div className="flex-none pt-[6px]">
              <BarLegend series={incomeChartSeries} />
            </div>
          </div>
        </ChartPanelCard>
      </div>
    </div>
  );
};

export default TrendChartsPanel;
