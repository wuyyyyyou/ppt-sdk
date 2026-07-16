import React, { type ReactNode } from "react";

export interface MatrixColumn { label: string }
export interface MatrixCell { lead: string; support?: string; content?: ReactNode; emphasized?: boolean }
export interface MatrixRow { label: string; cells: MatrixCell[] }

export default function ComparisonMatrix({ rowHeaderLabel, columns, rows }: { rowHeaderLabel: string; columns: MatrixColumn[]; rows: MatrixRow[] }) {
  return (
    <div style={{ display: "flex", height: "100%", flexDirection: "column", overflow: "hidden", border: "1px solid #cbd5e1", borderRadius: 10, background: "#ffffff" }}>
      <div style={{ display: "grid", gridTemplateColumns: `150px repeat(${columns.length}, minmax(0, 1fr))`, background: "#172033", color: "#ffffff" }}>
        <div style={{ padding: "15px 16px", fontWeight: 700 }}>{rowHeaderLabel}</div>
        {columns.map((column) => <div key={column.label} style={{ padding: "15px 16px", textAlign: "center", fontWeight: 700, borderLeft: "1px solid rgba(255,255,255,0.18)" }}>{column.label}</div>)}
      </div>
      {rows.map((row, rowIndex) => (
        <div key={row.label} style={{ display: "grid", minHeight: 0, flex: 1, gridTemplateColumns: `150px repeat(${columns.length}, minmax(0, 1fr))`, borderTop: rowIndex ? "1px solid #e2e8f0" : undefined, background: rowIndex % 2 ? "#ffffff" : "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", fontWeight: 700, color: "#172033", background: "#f1f5f9" }}>{row.label}</div>
          {row.cells.map((cell, index) => (
            <div key={`${row.label}-${index}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 16px", textAlign: "center", background: cell.emphasized ? "#eff6ff" : undefined }}>
              {cell.content ?? <div><div style={{ fontSize: 14, fontWeight: cell.emphasized ? 700 : 500, color: cell.emphasized ? "#1d4ed8" : "#334155" }}>{cell.lead}</div>{cell.support ? <div style={{ marginTop: 4, fontSize: 11, color: "#64748b" }}>{cell.support}</div> : null}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
