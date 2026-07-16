import React from "react";

export interface RoadmapPhase { label: string; title: string; items: string[]; color?: string }

export default function HorizontalRoadmap({ phases }: { phases: RoadmapPhase[] }) {
  return (
    <div style={{ position: "relative", display: "flex", height: "100%", gap: 14, padding: "24px 20px", border: "1px solid #d7dce5", borderRadius: 14, background: "#ffffff" }}>
      <span style={{ position: "absolute", left: 70, right: 70, top: 43, height: 2, background: "#cbd5e1" }} />
      {phases.map((phase) => {
        const color = phase.color ?? "#2563eb";
        return <div key={`${phase.label}-${phase.title}`} style={{ position: "relative", zIndex: 1, display: "flex", minWidth: 0, flex: 1, flexDirection: "column", padding: "12px 14px 16px", border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc" }}><div style={{ display: "flex", width: 38, height: 38, alignItems: "center", justifyContent: "center", marginBottom: 14, borderRadius: 999, background: color, color: "#ffffff", fontWeight: 800 }}>{phase.label}</div><div style={{ marginBottom: 10, fontSize: 16, fontWeight: 700, color: "#172033" }}>{phase.title}</div><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{phase.items.map((item) => <div key={item} style={{ display: "flex", gap: 8, fontSize: 12, lineHeight: 1.4, color: "#475569" }}><span style={{ width: 5, height: 5, flex: "0 0 auto", marginTop: 6, borderRadius: 999, background: color }} />{item}</div>)}</div></div>;
      })}
    </div>
  );
}
