import SlideCanvas from "../../foundations/SlideCanvas.tsx";
import NarrativeListItem from "./NarrativeListItem.tsx";

function Dot({ color }: { color: string }) {
  return <span style={{ width: 12, height: 12, borderRadius: 999, background: color }} />;
}

export default function NarrativeListItemPreview() {
  return (
    <SlideCanvas style={{ background: "#f4f5f7", fontFamily: "Arial, sans-serif" }}>
      <div style={{ position: "absolute", left: 210, top: 120, width: 860, padding: 34, borderRadius: 16, background: "#ffffff" }}>
        <NarrativeListItem icon={<Dot color="#2563eb" />} title="明确优先级" description="用一个清晰结论统领页面，并让支持信息围绕该结论组织。" aside={<strong style={{ color: "#2563eb" }}>01</strong>} />
        <NarrativeListItem icon={<Dot color="#0f766e" />} title="控制信息密度" description="说明文字保持简短，超出容量时调整页面结构。" aside={<strong style={{ color: "#0f766e" }}>02</strong>} />
        <NarrativeListItem icon={<Dot color="#d97706" />} title="保留视觉焦点" description="不要让所有信息拥有相同的视觉权重。" aside={<strong style={{ color: "#d97706" }}>03</strong>} showDivider={false} />
      </div>
    </SlideCanvas>
  );
}
