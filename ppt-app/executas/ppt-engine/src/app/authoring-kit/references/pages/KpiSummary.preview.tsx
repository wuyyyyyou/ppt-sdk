import KpiSummaryReference from "./KpiSummary.tsx";

export default function KpiSummaryPreview() {
  return <KpiSummaryReference title="指标摘要（示意数据）" subtitle="没有事实数据时应使用 TBD / 待补充，而不是复制预览数字" comparison={{ title: "双主体指标", leftLabel: "方案 A", rightLabel: "方案 B", leftValue: "42", rightValue: "36", leftShare: 42, rightShare: 36 }} statuses={[{ title: "维度一", status: "示意状态", progress: 72 }, { title: "维度二", status: "示意状态", progress: 54, color: "#0f766e" }, { title: "维度三", status: "示意状态", progress: 38, color: "#d97706" }, { title: "维度四", status: "示意状态", progress: 61, color: "#7c3aed" }]} notes={["指标必须来自允许的事实来源。", "进度值与可见状态文字应保持一致。", "指标过多时拆页，不继续缩小字号。"]} />;
}
