import SlideCanvas from "../../foundations/SlideCanvas.tsx";
import LineChartReference from "./LineChart.tsx";

export default function LineChartPreview() {
  return (
    <SlideCanvas style={{ background: "#f4f5f7", fontFamily: "Arial, sans-serif" }}>
      <div style={{ position: "absolute", left: 150, top: 90, width: 980, height: 540, padding: 28, background: "#fff", borderRadius: 16 }}>
        <h2 style={{ margin: "0 0 20px", fontSize: 28 }}>趋势折线图（示意数据）</h2>
        <LineChartReference labels={["阶段一", "阶段二", "阶段三", "阶段四"]} series={[{ label: "方案 A", values: [18, 26, 34, 42] }, { label: "方案 B", values: [14, 22, 29, 38] }]} minValue={0} maxValue={50} ticks={[0, 10, 20, 30, 40, 50]} width={920} height={440} />
      </div>
    </SlideCanvas>
  );
}
