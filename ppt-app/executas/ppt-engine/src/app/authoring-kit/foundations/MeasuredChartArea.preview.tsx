import SlideCanvas from "./SlideCanvas.tsx";
import MeasuredChartArea from "./MeasuredChartArea.tsx";

export default function MeasuredChartAreaPreview() {
  return (
    <SlideCanvas style={{ background: "#f4f5f7", fontFamily: "Arial, sans-serif" }}>
      <div
        style={{
          position: "absolute",
          left: 140,
          top: 120,
          width: 1000,
          height: 480,
          display: "flex",
          flexDirection: "column",
          padding: 28,
          background: "#ffffff",
          border: "1px solid #d7dce5",
          borderRadius: 18,
        }}
      >
        <div style={{ marginBottom: 18, fontSize: 24, fontWeight: 700, color: "#172033" }}>
          实际容器尺寸
        </div>
        <MeasuredChartArea>
          {({ width, height }) => (
            <div
              style={{
                width,
                height,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#eff6ff",
                color: "#1d4ed8",
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {Math.round(width)} × {Math.round(height)}
            </div>
          )}
        </MeasuredChartArea>
      </div>
    </SlideCanvas>
  );
}
