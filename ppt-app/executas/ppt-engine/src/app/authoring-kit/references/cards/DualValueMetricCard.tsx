import React from "react";

export interface DualValueMetricCardProps {
  title: string;
  leftLabel: string;
  rightLabel: string;
  leftValue: string;
  rightValue: string;
  leftShare: number;
  rightShare: number;
  leftColor?: string;
  rightColor?: string;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

export default function DualValueMetricCard({
  title,
  leftLabel,
  rightLabel,
  leftValue,
  rightValue,
  leftShare,
  rightShare,
  leftColor = "#2563eb",
  rightColor = "#0f766e",
}: DualValueMetricCardProps) {
  const left = clampPercent(leftShare);
  const right = clampPercent(rightShare);
  const total = Math.max(1, left + right);
  return (
    <div style={{ padding: 18, border: "1px solid #d7dce5", borderRadius: 10, background: "#ffffff", boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)" }}>
      <div style={{ marginBottom: 14, fontSize: 14, fontWeight: 700, color: "#475569" }}>{title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong style={{ fontSize: 24, color: leftColor }}>{leftValue}</strong>
        <strong style={{ fontSize: 24, color: rightColor }}>{rightValue}</strong>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 12, color: "#64748b" }}>
        <span>{leftLabel}</span><span>{rightLabel}</span>
      </div>
      <div style={{ position: "relative", height: 7, overflow: "hidden", borderRadius: 999, background: "#e2e8f0" }}>
        <span style={{ position: "absolute", inset: "0 auto 0 0", width: `${(left / total) * 100}%`, background: leftColor }} />
        <span style={{ position: "absolute", inset: "0 0 0 auto", width: `${(right / total) * 100}%`, background: rightColor }} />
      </div>
    </div>
  );
}
