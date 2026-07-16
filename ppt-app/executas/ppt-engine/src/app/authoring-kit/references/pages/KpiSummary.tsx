import React from "react";

import SlideCanvas from "../../foundations/SlideCanvas.tsx";
import DualValueMetricCard from "../cards/DualValueMetricCard.tsx";
import ProgressStatusCard from "../cards/ProgressStatusCard.tsx";

export interface KpiSummaryReferenceProps {
  title: string;
  subtitle?: string;
  comparison: { title: string; leftLabel: string; rightLabel: string; leftValue: string; rightValue: string; leftShare: number; rightShare: number };
  statuses: Array<{ title: string; status: string; progress: number; color?: string }>;
  notes: string[];
}

export default function KpiSummaryReference({ title, subtitle, comparison, statuses, notes }: KpiSummaryReferenceProps) {
  return (
    <SlideCanvas style={{ background: "#f8fafc", color: "#172033", fontFamily: "Arial, sans-serif" }}>
      <header style={{ position: "absolute", left: 72, right: 72, top: 48, height: 80, borderBottom: "2px solid #e2e8f0" }}>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.1 }}>{title}</h1>
        {subtitle ? <p style={{ margin: "8px 0 0", fontSize: 15, color: "#64748b" }}>{subtitle}</p> : null}
      </header>
      <main style={{ position: "absolute", left: 72, right: 72, top: 166, bottom: 62, display: "grid", gridTemplateColumns: "0.95fr 1.35fr", gap: 26 }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <DualValueMetricCard {...comparison} />
          <div style={{ flex: 1, padding: 22, border: "1px solid #d7dce5", borderRadius: 14, background: "#ffffff" }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 18 }}>使用说明</h2>
            {notes.map((note) => <div key={note} style={{ display: "flex", gap: 10, marginBottom: 13, fontSize: 14, lineHeight: 1.45, color: "#475569" }}><span style={{ width: 6, height: 6, flex: "0 0 auto", marginTop: 7, borderRadius: 999, background: "#2563eb" }} />{note}</div>)}
          </div>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignContent: "start" }}>
          {statuses.map((status) => <ProgressStatusCard key={status.title} {...status} />)}
        </section>
      </main>
    </SlideCanvas>
  );
}
