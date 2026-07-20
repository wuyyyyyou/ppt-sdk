import React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

export interface BarChartSeries {
  label: string;
  values: number[];
  color?: string;
}

export interface BarChartReferenceProps {
  labels: string[];
  series: BarChartSeries[];
  minValue: number;
  maxValue: number;
  ticks: number[];
  width: number;
  height: number;
  tickFormatter?: (value: number) => string;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

export default function BarChartReference({
  labels,
  series,
  minValue,
  maxValue,
  ticks,
  width,
  height,
  tickFormatter = String,
}: BarChartReferenceProps) {
  const colors = ["#2563eb", "#0f766e", "#d97706", "#7c3aed"];
  const data = labels.map((label, index) => {
    const row: Record<string, string | number> = { label };
    for (const entry of series) row[entry.label] = clamp(entry.values[index] ?? minValue, minValue, maxValue);
    return row;
  });
  return (
    <div data-chart-like="true" style={{ width, height }}>
      <BarChart width={width} height={height} data={data} margin={{ top: 10, right: 18, bottom: 0, left: 4 }} barGap={8} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke="#d7dce5" />
        <XAxis dataKey="label" axisLine={{ stroke: "#94a3b8" }} tickLine={false} interval={0} height={32} tick={{ fill: "#475569", fontSize: 12 }} />
        <YAxis width={54} domain={[minValue, maxValue]} ticks={ticks} axisLine={false} tickLine={false} tickFormatter={(value) => tickFormatter(Number(value))} tick={{ fill: "#64748b", fontSize: 11 }} />
        {series.map((entry, index) => <Bar key={entry.label} dataKey={entry.label} fill={entry.color ?? colors[index % colors.length]} radius={[4, 4, 0, 0]} isAnimationActive={false} />)}
      </BarChart>
    </div>
  );
}
