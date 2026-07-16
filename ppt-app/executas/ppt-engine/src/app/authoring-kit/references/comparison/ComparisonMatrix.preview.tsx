import SlideCanvas from "../../foundations/SlideCanvas.tsx";
import ComparisonMatrix from "./ComparisonMatrix.tsx";

export default function ComparisonMatrixPreview() {
  return (
    <SlideCanvas style={{ background: "#f4f5f7", fontFamily: "Arial, sans-serif", padding: 70 }}>
      <ComparisonMatrix rowHeaderLabel="维度" columns={[{ label: "方案 A" }, { label: "方案 B" }]} rows={[{ label: "适用范围", cells: [{ lead: "广", support: "多场景" }, { lead: "聚焦", support: "特定场景", emphasized: true }] }, { label: "实施复杂度", cells: [{ lead: "中等" }, { lead: "较低", emphasized: true }] }, { label: "扩展能力", cells: [{ lead: "较强", emphasized: true }, { lead: "一般" }] }]} />
    </SlideCanvas>
  );
}
