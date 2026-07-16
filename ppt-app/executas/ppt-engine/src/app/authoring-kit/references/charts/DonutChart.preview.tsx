import SlideCanvas from "../../foundations/SlideCanvas.tsx";
import DonutChartReference from "./DonutChart.tsx";

export default function DonutChartPreview() {
  return (
    <SlideCanvas style={{ background: "#f8fafc", fontFamily: "Arial, sans-serif" }}>
      <div style={{ position: "absolute", left: 150, top: 100, width: 980, height: 520, padding: 30, background: "#fff", border: "1px solid #d7dce5", borderRadius: 18 }}>
        <h2 style={{ margin: 0, fontSize: 28, color: "#172033" }}>结构占比（示意数据）</h2>
        <DonutChartReference
          centerLabel="总体结构"
          width={920}
          height={420}
          segments={[
            { label: "类别 A", value: 42, color: "#2563eb" },
            { label: "类别 B", value: 31, color: "#0f766e" },
            { label: "类别 C", value: 17, color: "#d97706" },
            { label: "其他", value: 10, color: "#94a3b8" },
          ]}
        />
      </div>
    </SlideCanvas>
  );
}
