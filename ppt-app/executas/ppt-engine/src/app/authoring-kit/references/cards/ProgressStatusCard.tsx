import React, { type ReactNode } from "react";

export interface ProgressStatusCardProps {
  title: string;
  status: string;
  progress: number;
  marker?: ReactNode;
  color?: string;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

export default function ProgressStatusCard({
  title,
  status,
  progress,
  marker,
  color = "#2563eb",
}: ProgressStatusCardProps) {
  return (
    <div style={{ padding: "16px 18px", border: "1px solid #d7dce5", borderRadius: 10, background: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <strong style={{ fontSize: 15, color: "#172033" }}>{title}</strong>
        {marker}
      </div>
      <div style={{ height: 7, overflow: "hidden", borderRadius: 999, background: "#e2e8f0" }}>
        <div style={{ width: `${clampPercent(progress)}%`, height: "100%", borderRadius: 999, background: color }} />
      </div>
      <div style={{ marginTop: 10, textAlign: "right", fontSize: 12, color: "#64748b" }}>{status}</div>
    </div>
  );
}
