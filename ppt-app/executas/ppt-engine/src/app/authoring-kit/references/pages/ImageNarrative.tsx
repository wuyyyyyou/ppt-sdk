import React from "react";

import SlideCanvas from "../../foundations/SlideCanvas.tsx";
import NarrativeListItem from "../cards/NarrativeListItem.tsx";
import ImageShowcaseReference from "../media/ImageShowcase.tsx";

export interface ImageNarrativeReferenceProps {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  imageAlt: string;
  imageTitle?: string;
  imageCaption?: string;
  imageSource?: string;
  insights: Array<{ title: string; description: string }>;
  conclusion: string;
}

export default function ImageNarrativeReference({
  title,
  subtitle,
  imageUrl,
  imageAlt,
  imageTitle,
  imageCaption,
  imageSource,
  insights,
  conclusion,
}: ImageNarrativeReferenceProps) {
  return (
    <SlideCanvas style={{ background: "#f8fafc", color: "#172033", fontFamily: "Arial, sans-serif" }}>
      <header style={{ position: "absolute", left: 72, right: 72, top: 48, height: 80, borderBottom: "2px solid #e2e8f0" }}>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.1 }}>{title}</h1>
        {subtitle ? <p style={{ margin: "8px 0 0", fontSize: 15, color: "#64748b" }}>{subtitle}</p> : null}
      </header>
      <main style={{ position: "absolute", left: 72, right: 72, top: 158, bottom: 58, display: "grid", gridTemplateColumns: "1.25fr 0.85fr", gap: 26 }}>
        <ImageShowcaseReference url={imageUrl} alt={imageAlt} title={imageTitle} caption={imageCaption} source={imageSource} />
        <section style={{ display: "flex", minHeight: 0, flexDirection: "column", padding: 22, border: "1px solid #d7dce5", borderRadius: 14, background: "#ffffff" }}>
          <h2 style={{ margin: "0 0 18px", fontSize: 19 }}>视觉解读</h2>
          <div style={{ minHeight: 0, flex: 1 }}>
            {insights.map((item, index) => <NarrativeListItem key={item.title} title={item.title} description={item.description} aside={<strong style={{ color: "#0f766e" }}>{String(index + 1).padStart(2, "0")}</strong>} showDivider={index < insights.length - 1} />)}
          </div>
          <div style={{ marginTop: 14, padding: "14px 16px", borderLeft: "5px solid #0f766e", borderRadius: 8, background: "#ecfdf5", fontSize: 14, lineHeight: 1.45, fontWeight: 700, color: "#14532d" }}>{conclusion}</div>
        </section>
      </main>
    </SlideCanvas>
  );
}
