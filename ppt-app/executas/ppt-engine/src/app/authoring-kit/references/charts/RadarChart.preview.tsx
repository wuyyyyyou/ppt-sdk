import SlideCanvas from "../../foundations/SlideCanvas.tsx";
import RadarChartReference from "./RadarChart.tsx";

export default function RadarChartPreview() {
  return (
    <SlideCanvas style={{ background: "#f8fafc", fontFamily: "Arial, sans-serif" }}>
      <div style={{ position: "absolute", left: 170, top: 70, width: 940, height: 580, background: "#fff", border: "1px solid #d7dce5", borderRadius: 18 }}>
        <h2 style={{ margin: "28px 36px 0", fontSize: 28, color: "#172033" }}>多维能力对比（示意数据）</h2>
        <RadarChartReference
          labels={["效率", "质量", "覆盖", "成本", "灵活性"]}
          series={[
            { label: "方案 A", values: [78, 72, 84, 66, 80], color: "#2563eb" },
            { label: "方案 B", values: [64, 82, 68, 76, 70], color: "#0f766e", dashed: true },
          ]}
          width={920}
          height={500}
        />
      </div>
    </SlideCanvas>
  );
}
