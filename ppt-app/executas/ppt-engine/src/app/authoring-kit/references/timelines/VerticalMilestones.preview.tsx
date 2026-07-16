import SlideCanvas from "../../foundations/SlideCanvas.tsx";
import VerticalMilestones from "./VerticalMilestones.tsx";

export default function VerticalMilestonesPreview() {
  return <SlideCanvas style={{ background: "#f8fafc", fontFamily: "Arial, sans-serif", padding: 70 }}><VerticalMilestones items={[{ period: "阶段一", stage: "准备", title: "建立共同理解", description: "明确目标、角色和验收标准。" }, { period: "阶段二", stage: "验证", title: "完成小范围试运行", description: "根据真实结果调整实现。", color: "#0f766e" }, { period: "阶段三", stage: "扩展", title: "推广稳定做法", description: "保留页面级变化空间。", color: "#d97706" }]} /></SlideCanvas>;
}
