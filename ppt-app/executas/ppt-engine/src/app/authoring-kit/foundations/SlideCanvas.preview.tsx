import SlideCanvas from "./SlideCanvas.tsx";

export default function SlideCanvasPreview() {
  return (
    <SlideCanvas
      style={{
        background: "#f4f5f7",
        color: "#172033",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "72px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          border: "2px solid #cbd5e1",
          borderRadius: "24px",
          padding: "48px",
          background: "#ffffff",
          boxSizing: "border-box",
        }}
      >
        <div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#2563eb" }}>
            Foundation Module Preview
          </div>
          <h1 style={{ margin: "20px 0 0", fontSize: "48px", lineHeight: 1.1 }}>
            SlideCanvas
          </h1>
        </div>
        <div style={{ fontSize: "22px", color: "#475569" }}>
          Fixed 1280 × 720 canvas with clipping and predictable box sizing.
        </div>
      </div>
    </SlideCanvas>
  );
}
