import SlideCanvas from "../../foundations/SlideCanvas.tsx";
import DualValueMetricCard from "./DualValueMetricCard.tsx";

export default function DualValueMetricCardPreview() {
  return (
    <SlideCanvas style={{ background: "#f4f5f7", fontFamily: "Arial, sans-serif" }}>
      <div style={{ position: "absolute", left: 300, top: 220, width: 680 }}>
        <DualValueMetricCard title="双主体指标（示意数据）" leftLabel="方案 A" rightLabel="方案 B" leftValue="42" rightValue="36" leftShare={42} rightShare={36} />
      </div>
    </SlideCanvas>
  );
}
