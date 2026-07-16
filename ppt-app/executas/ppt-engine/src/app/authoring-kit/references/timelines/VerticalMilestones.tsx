import React, { type ReactNode } from "react";

export interface MilestoneItem { period: string; stage: string; title: string; description: string; icon?: ReactNode; color?: string }

export default function VerticalMilestones({ items }: { items: MilestoneItem[] }) {
  return (
    <div style={{ position: "relative", height: "100%" }}>
      <span style={{ position: "absolute", top: 40, bottom: 40, left: 186, width: 2, borderRadius: 999, background: "#cbd5e1" }} />
      <div style={{ display: "flex", height: "100%", flexDirection: "column", gap: 10 }}>
        {items.map((item) => { const color = item.color ?? "#2563eb"; return <div key={`${item.period}-${item.title}`} style={{ display: "flex", minHeight: 0, flex: 1, alignItems: "center" }}><div style={{ width: 168, paddingRight: 28, textAlign: "right" }}><div style={{ fontSize: 24, fontWeight: 800, color }}>{item.period}</div><div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>{item.stage}</div></div><span style={{ position: "relative", zIndex: 1, width: 16, height: 16, flex: "0 0 auto", border: `3px solid ${color}`, borderRadius: 999, background: "#ffffff", boxShadow: "0 0 0 4px #f8fafc" }} /><span style={{ width: 24, height: 2, margin: "0 14px", background: "#cbd5e1" }} /><div style={{ display: "flex", minWidth: 0, flex: 1, alignItems: "center", gap: 16, padding: "14px 18px", border: "1px solid #d7dce5", borderLeft: `5px solid ${color}`, borderRadius: 10, background: "#ffffff" }}>{item.icon ? <span style={{ display: "flex", width: 42, height: 42, flex: "0 0 auto", alignItems: "center", justifyContent: "center", borderRadius: 10, color, background: "#eff6ff" }}>{item.icon}</span> : null}<div><div style={{ marginBottom: 5, fontSize: 16, fontWeight: 700, color: "#172033" }}>{item.title}</div><div style={{ fontSize: 13, lineHeight: 1.4, color: "#475569" }}>{item.description}</div></div></div></div>; })}
      </div>
    </div>
  );
}
