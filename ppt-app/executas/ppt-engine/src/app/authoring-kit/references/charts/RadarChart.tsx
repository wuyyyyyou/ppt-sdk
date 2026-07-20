import React from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts";

export interface RadarSeries {
  label: string;
  values: number[];
  color: string;
  dashed?: boolean;
}

export interface RadarChartReferenceProps {
  labels: string[];
  series: RadarSeries[];
  width: number;
  height: number;
  minValue?: number;
  maxValue?: number;
  ticks?: number[];
}

export default function RadarChartReference({
  labels,
  series,
  width,
  height,
  minValue = 0,
  maxValue = 100,
  ticks = [20, 40, 60, 80, 100],
}: RadarChartReferenceProps) {
  const data = labels.map((label, index) => {
    const row: Record<string, string | number> = { label };
    for (const entry of series) {
      const value = entry.values[index] ?? minValue;
      row[entry.label] = Math.max(minValue, Math.min(maxValue, Number.isFinite(value) ? value : minValue));
    }
    return row;
  });

  return (
    <div data-chart-like="true" style={{ width, height }}>
      <RadarChart width={width} height={height} data={data} outerRadius="68%">
        <PolarGrid gridType="polygon" stroke="#cbd5e1" />
        <PolarAngleAxis dataKey="label" tick={{ fill: "#475569", fontSize: 12, fontWeight: 700 }} />
        <PolarRadiusAxis
          axisLine={false}
          angle={90}
          domain={[minValue, maxValue]}
          tickCount={ticks.length}
          tick={{ fill: "#94a3b8", fontSize: 10 }}
        />
        {series.map((entry) => (
          <Radar
            key={entry.label}
            name={entry.label}
            dataKey={entry.label}
            stroke={entry.color}
            fill={entry.color}
            fillOpacity={0.12}
            strokeWidth={3}
            strokeDasharray={entry.dashed ? "6 5" : undefined}
            dot={{ r: 3.5, strokeWidth: 2, fill: "#ffffff" }}
            isAnimationActive={false}
          />
        ))}
      </RadarChart>
    </div>
  );
}
