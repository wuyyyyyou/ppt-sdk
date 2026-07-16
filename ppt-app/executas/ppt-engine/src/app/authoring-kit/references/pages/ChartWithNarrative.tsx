import React from "react";

import MeasuredChartArea from "../../foundations/MeasuredChartArea.tsx";
import SlideCanvas from "../../foundations/SlideCanvas.tsx";
import NarrativeListItem from "../cards/NarrativeListItem.tsx";
import LineChartReference, { type LineChartSeries } from "../charts/LineChart.tsx";

export interface ChartNarrativeItem {
  title: string;
  description: string;
}

export interface ChartWithNarrativeReferenceProps {
  title: string;
  subtitle?: string;
  chartTitle: string;
  labels: string[];
  series: LineChartSeries[];
  minValue: number;
  maxValue: number;
  ticks: number[];
  insights: ChartNarrativeItem[];
  conclusion: string;
}

export default function ChartWithNarrativeReference({
  title,
  subtitle,
  chartTitle,
  labels,
  series,
  minValue,
  maxValue,
  ticks,
  insights,
  conclusion,
}: ChartWithNarrativeReferenceProps) {
  return (
    <SlideCanvas style={{ background: "#f8fafc", color: "#172033", fontFamily: "Arial, sans-serif" }}>
      <header style={{ position: "absolute", left: 72, right: 72, top: 48, height: 80, borderBottom: "2px solid #e2e8f0" }}>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.1 }}>{title}</h1>
        {subtitle ? <p style={{ margin: "8px 0 0", fontSize: 15, color: "#64748b" }}>{subtitle}</p> : null}
      </header>
      <main style={{ position: "absolute", left: 72, right: 72, top: 158, bottom: 58, display: "grid", gridTemplateColumns: "1.55fr 0.85fr", gap: 26 }}>
        <section style={{ display: "flex", minHeight: 0, flexDirection: "column", padding: 22, border: "1px solid #d7dce5", borderRadius: 14, background: "#ffffff" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 19 }}>{chartTitle}</h2>
          <MeasuredChartArea minHeight={300}>
            {({ width, height }) => <LineChartReference labels={labels} series={series} minValue={minValue} maxValue={maxValue} ticks={ticks} width={width} height={height} />}
          </MeasuredChartArea>
        </section>
        <section style={{ display: "flex", minHeight: 0, flexDirection: "column", padding: 22, border: "1px solid #d7dce5", borderRadius: 14, background: "#ffffff" }}>
          <h2 style={{ margin: "0 0 18px", fontSize: 19 }}>关键解读</h2>
          <div style={{ minHeight: 0, flex: 1 }}>
            {insights.map((item, index) => <NarrativeListItem key={item.title} title={item.title} description={item.description} aside={<strong style={{ color: "#2563eb" }}>{String(index + 1).padStart(2, "0")}</strong>} showDivider={index < insights.length - 1} />)}
          </div>
          <div style={{ marginTop: 14, padding: "14px 16px", borderLeft: "5px solid #2563eb", borderRadius: 8, background: "#eff6ff", fontSize: 14, lineHeight: 1.45, fontWeight: 700, color: "#1e3a8a" }}>{conclusion}</div>
        </section>
      </main>
    </SlideCanvas>
  );
}
