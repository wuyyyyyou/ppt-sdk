import SlideCanvas from "../../foundations/SlideCanvas.tsx";
import ComparisonPanel from "./ComparisonPanel.tsx";

export default function ComparisonPanelPreview() {
  return (
    <SlideCanvas style={{ background: "#f4f5f7", fontFamily: "Arial, sans-serif" }}>
      <div style={{ position: "absolute", left: 360, top: 100, width: 560, height: 520 }}>
        <ComparisonPanel title="比较结论" sections={[{ badge: "01", title: "短期选择", description: "优先考虑实施成本和落地速度。" }, { badge: "02", title: "长期选择", description: "重点评估扩展空间和维护成本。", color: "#0f766e" }, { badge: "03", title: "最终判断", description: "根据实际约束组合使用，而不是机械二选一。", color: "#d97706" }]} />
      </div>
    </SlideCanvas>
  );
}
