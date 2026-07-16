import React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

export interface LineChartSeries {
  label: string;
  values: number[];
  color?: string;
}

export interface LineChartReferenceProps {
  labels: string[];
  series: LineChartSeries[];
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

export default function LineChartReference({
  labels,
  series,
  minValue,
  maxValue,
  ticks,
  width,
  height,
  tickFormatter = String,
}: LineChartReferenceProps) {
  const colors = ["#2563eb", "#0f766e", "#d97706", "#7c3aed"];
  const data = labels.map((label, index) => {
    const row: Record<string, string | number> = { label };
    for (const entry of series) row[entry.label] = clamp(entry.values[index] ?? minValue, minValue, maxValue);
    return row;
  });
  return (
    <div data-pptx-export="screenshot" data-chart-like="true" style={{ width, height }}>
      <LineChart width={width} height={height} data={data} margin={{ top: 12, right: 22, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} stroke="#d7dce5" />
        <XAxis dataKey="label" axisLine={{ stroke: "#94a3b8" }} tickLine={false} interval={0} height={32} padding={{ left: 8, right: 18 }} tick={{ fill: "#475569", fontSize: 12 }} />
        <YAxis width={54} domain={[minValue, maxValue]} ticks={ticks} axisLine={false} tickLine={false} tickFormatter={(value) => tickFormatter(Number(value))} tick={{ fill: "#64748b", fontSize: 11 }} />
        {series.map((entry, index) => {
          const color = entry.color ?? colors[index % colors.length];
          return <Line key={entry.label} type="monotone" dataKey={entry.label} stroke={color} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }} activeDot={{ r: 5 }} isAnimationActive={false} />;
        })}
      </LineChart>
    </div>
  );
}
