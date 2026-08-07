import React from "react";

import SlideCanvas from "../../foundations/SlideCanvas.tsx";

export interface FormalCoverReferenceProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  period?: string;
  presenter?: string;
  organization?: string;
  date?: string;
  classification?: string;
}

export default function FormalCoverReference({
  title,
  subtitle,
  eyebrow = "FORMAL REPORT",
  period,
  presenter,
  organization,
  date,
  classification,
}: FormalCoverReferenceProps) {
  const metadata = [
    presenter ? { label: "汇报人", value: presenter } : null,
    organization ? { label: "组织", value: organization } : null,
    date ? { label: "日期", value: date } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <SlideCanvas style={{ background: "#f5f7fb", color: "#172033", fontFamily: "Arial, sans-serif" }}>
      <section style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "0.95fr 1.05fr" }}>
        <div style={{ position: "relative", padding: "72px 64px", background: "#2457c6", color: "#ffffff", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.12, backgroundImage: "linear-gradient(90deg, transparent 0, transparent 49%, #ffffff 50%, transparent 51%), linear-gradient(0deg, transparent 0, transparent 49%, #ffffff 50%, transparent 51%)", backgroundSize: "72px 72px" }} />
          <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 12, letterSpacing: "2.8px", fontWeight: 700, opacity: 0.78 }}>{eyebrow}</div>
            <h1 style={{ maxWidth: 470, margin: "100px 0 0", fontSize: 54, lineHeight: 1.04, letterSpacing: "-1.5px" }}>{title}</h1>
            {period ? <div style={{ marginTop: 28, fontSize: 18, letterSpacing: "1.4px", fontWeight: 700 }}>{period}</div> : null}
            {classification ? <div style={{ marginTop: "auto", fontSize: 12, letterSpacing: "1.6px", opacity: 0.72 }}>{classification}</div> : null}
          </div>
        </div>
        <div style={{ position: "relative", padding: "112px 72px 64px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12, color: "#2457c6", fontWeight: 700, letterSpacing: "2.2px" }}>CORE CONTEXT</div>
            {subtitle ? <p style={{ maxWidth: 510, margin: "24px 0 0", fontSize: 30, lineHeight: 1.22, fontWeight: 700 }}>{subtitle}</p> : null}
            <div style={{ width: 58, height: 4, marginTop: 32, background: "#2457c6" }} />
          </div>
          {metadata.length > 0 ? (
            <dl style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "20px 28px", margin: 0, paddingTop: 28, borderTop: "1px solid #d7dce5" }}>
              {metadata.map((item) => (
                <div key={`${item.label}-${item.value}`}>
                  <dt style={{ marginBottom: 6, fontSize: 11, color: "#718096", letterSpacing: "1.2px" }}>{item.label}</dt>
                  <dd style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </section>
    </SlideCanvas>
  );
}
