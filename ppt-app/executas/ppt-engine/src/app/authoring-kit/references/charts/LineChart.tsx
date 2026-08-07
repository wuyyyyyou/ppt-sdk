import React from "react";
import { CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis } from "recharts";

export interface LineChartSeries {
  label: string;
  values: number[];
  color?: string;
}

export type LineChartLabelMode = "none" | "key" | "all";

export interface LineChartReferenceProps {
  labels: string[];
  series: LineChartSeries[];
  minValue: number;
  maxValue: number;
  ticks: number[];
  width: number;
  height: number;
  tickFormatter?: (value: number) => string;
  labelMode?: LineChartLabelMode;
  unit?: string;
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
  labelMode = "key",
  unit = "",
}: LineChartReferenceProps) {
  const colors = ["#2563eb", "#0f766e", "#d97706", "#7c3aed"];
  const formatValue = (value: number) => `${tickFormatter(value)}${unit ? ` ${unit}` : ""}`;
  const normalizedSeries = series.map((entry) => ({
    ...entry,
    values: entry.values.map((value) => clamp(value, minValue, maxValue)),
  }));
  const keyIndexes = new Map<string, Set<number>>();
  for (const entry of normalizedSeries) {
    const indexes = new Set<number>();
    if (entry.values.length > 0) indexes.add(0);
    if (entry.values.length > 1) indexes.add(entry.values.length - 1);
    if (entry.values.length > 0) {
      indexes.add(entry.values.reduce((best, value, index, values) => value > values[best] ? index : best, 0));
      indexes.add(entry.values.reduce((best, value, index, values) => value < values[best] ? index : best, 0));
    }
    keyIndexes.set(entry.label, indexes);
  }
  const data = labels.map((label, index) => {
    const row: Record<string, string | number> = { label };
    for (const entry of normalizedSeries) {
      const value = entry.values[index] ?? minValue;
      row[entry.label] = value;
      row[`${entry.label}__label`] = labelMode === "all" || (labelMode === "key" && keyIndexes.get(entry.label)?.has(index))
        ? formatValue(value)
        : "";
    }
    return row;
  });
  return (
    <div data-chart-like="true" style={{ width, height }}>
      <LineChart width={width} height={height} data={data} margin={{ top: 12, right: 22, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} stroke="#d7dce5" />
        <XAxis dataKey="label" axisLine={{ stroke: "#94a3b8" }} tickLine={false} interval={0} height={32} padding={{ left: 8, right: 18 }} tick={{ fill: "#475569", fontSize: 12 }} />
        <YAxis width={54} domain={[minValue, maxValue]} ticks={ticks} axisLine={false} tickLine={false} tickFormatter={(value) => tickFormatter(Number(value))} tick={{ fill: "#64748b", fontSize: 11 }} />
        {normalizedSeries.map((entry, index) => {
          const color = entry.color ?? colors[index % colors.length];
          return (
            <Line key={entry.label} type="monotone" dataKey={entry.label} stroke={color} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }} activeDot={{ r: 5 }} isAnimationActive={false}>
              {labelMode !== "none" ? <LabelList dataKey={`${entry.label}__label`} position="top" fill={color} fontSize={11} /> : null}
            </Line>
          );
        })}
      </LineChart>
    </div>
  );
}
