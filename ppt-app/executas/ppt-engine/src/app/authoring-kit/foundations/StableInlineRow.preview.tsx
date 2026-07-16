import SlideCanvas from "./SlideCanvas.tsx";
import StableInlineRow from "./StableInlineRow.tsx";

export default function StableInlineRowPreview() {
  return (
    <SlideCanvas style={{ background: "#f4f5f7", fontFamily: "Arial, sans-serif" }}>
      <div
        style={{
          position: "absolute",
          inset: 80,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 36,
        }}
      >
        <StableInlineRow
          height={44}
          gap={14}
          pptxInlineComposition="icon-text"
          style={{ fontSize: 24, fontWeight: 700, color: "#172033" }}
        >
          <span
            data-pptx-inline-role="leading"
            style={{ width: 18, height: 18, borderRadius: 999, background: "#2563eb" }}
          />
          <span data-pptx-inline-role="label">稳定的图标与文本单行组合</span>
        </StableInlineRow>
        <StableInlineRow
          height={38}
          gap={18}
          inline={false}
          style={{ padding: "0 16px", background: "#ffffff", border: "1px solid #d7dce5" }}
        >
          <strong style={{ color: "#2563eb", fontSize: 22 }}>42%</strong>
          <span style={{ color: "#475569", fontSize: 18 }}>示意指标标签</span>
        </StableInlineRow>
      </div>
    </SlideCanvas>
  );
}
