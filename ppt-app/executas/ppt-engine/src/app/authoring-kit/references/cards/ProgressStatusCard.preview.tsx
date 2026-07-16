import SlideCanvas from "../../foundations/SlideCanvas.tsx";
import ProgressStatusCard from "./ProgressStatusCard.tsx";

export default function ProgressStatusCardPreview() {
  return (
    <SlideCanvas style={{ background: "#f4f5f7", fontFamily: "Arial, sans-serif" }}>
      <div style={{ position: "absolute", left: 300, top: 185, width: 680, display: "flex", flexDirection: "column", gap: 22 }}>
        <ProgressStatusCard title="阶段一" status="示意进度" progress={68} color="#2563eb" />
        <ProgressStatusCard title="阶段二" status="示意进度" progress={44} color="#0f766e" />
      </div>
    </SlideCanvas>
  );
}
