import React from "react";

export interface ComparisonSection {
  badge: string;
  title: string;
  description: string;
  color?: string;
}

export default function ComparisonPanel({ title, sections }: { title?: string; sections: ComparisonSection[] }) {
  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column", overflow: "hidden", border: "1px solid #d7dce5", borderRadius: 12, background: "#ffffff" }}>
      {title ? <div style={{ padding: "14px 18px", fontSize: 17, fontWeight: 700, color: "#172033", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>{title}</div> : null}
      <div style={{ display: "flex", minHeight: 0, flex: 1, flexDirection: "column", padding: "8px 18px" }}>
        {sections.map((section, index) => (
          <div key={`${section.badge}-${section.title}`} style={{ display: "flex", minHeight: 0, flex: 1, alignItems: "center", gap: 12, borderTop: index ? "1px solid #e2e8f0" : undefined }}>
            <span style={{ display: "flex", width: 30, height: 20, flex: "0 0 auto", alignItems: "center", justifyContent: "center", borderRadius: 4, background: section.color ?? "#2563eb", color: "#ffffff", fontSize: 11, fontWeight: 700 }}>{section.badge}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ marginBottom: 3, fontSize: 14, fontWeight: 700, color: "#172033" }}>{section.title}</div>
              <div style={{ fontSize: 12, lineHeight: 1.4, color: "#475569" }}>{section.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
