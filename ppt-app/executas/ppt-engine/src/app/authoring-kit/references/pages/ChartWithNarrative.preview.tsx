import ChartWithNarrativeReference from "./ChartWithNarrative.tsx";

export default function ChartWithNarrativePreview() {
  return <ChartWithNarrativeReference title="趋势与关键解读" subtitle="页面组合参考，数据仅用于布局示意" chartTitle="阶段变化" labels={["阶段一", "阶段二", "阶段三", "阶段四"]} series={[{ label: "指标 A", values: [18, 27, 34, 46], color: "#2563eb" }, { label: "指标 B", values: [15, 21, 30, 36], color: "#0f766e" }]} minValue={0} maxValue={50} ticks={[0, 10, 20, 30, 40, 50]} insights={[{ title: "变化方向", description: "整体趋势持续向上，但不同序列的变化速度存在差异。" }, { title: "关键阶段", description: "第三阶段以后差距扩大，需要结合真实原因解释。" }, { title: "后续关注", description: "继续验证变化是否稳定，并补充来源和限制。" }]} conclusion="先表达图表支持的结论，再说明限制；不要为了视觉完整性补造数字。" />;
}
