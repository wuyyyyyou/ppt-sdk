import SlideCanvas from "../../foundations/SlideCanvas.tsx";
import HorizontalRoadmap from "./HorizontalRoadmap.tsx";

export default function HorizontalRoadmapPreview() {
  return <SlideCanvas style={{ background: "#f4f5f7", fontFamily: "Arial, sans-serif", padding: 70 }}><HorizontalRoadmap phases={[{ label: "1", title: "准备", items: ["明确目标", "确认约束"] }, { label: "2", title: "实施", items: ["小范围验证", "持续调整"], color: "#0f766e" }, { label: "3", title: "扩展", items: ["沉淀方法", "扩大覆盖"], color: "#d97706" }]} /></SlideCanvas>;
}
