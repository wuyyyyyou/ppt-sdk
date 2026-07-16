import React, { type ReactNode } from "react";

export interface NumberedAgendaCardProps {
  number: string;
  title: string;
  icon?: ReactNode;
  highlighted?: boolean;
}

export default function NumberedAgendaCard({
  number,
  title,
  icon,
  highlighted = false,
}: NumberedAgendaCardProps) {
  const accent = "#2563eb";
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        height: 72,
        padding: "0 24px",
        overflow: "hidden",
        border: "1px solid #d7dce5",
        borderRadius: 8,
        background: highlighted ? "#eff6ff" : "#ffffff",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
      }}
    >
      {highlighted ? (
        <span style={{ position: "absolute", inset: "0 auto 0 0", width: 5, background: accent }} />
      ) : null}
      <strong style={{ width: 48, textAlign: "right", fontSize: 24, color: accent }}>
        {number}
      </strong>
      <span style={{ flex: 1, marginLeft: 22, fontSize: 20, fontWeight: 700, color: "#172033" }}>
        {title}
      </span>
      {icon ? (
        <span style={{ width: 26, height: 26, color: highlighted ? accent : "#64748b" }}>
          {icon}
        </span>
      ) : null}
    </div>
  );
}
