import SlideCanvas from "../../foundations/SlideCanvas.tsx";
import NumberedAgendaCard from "./NumberedAgendaCard.tsx";

const icon = <span style={{ width: 12, height: 12, borderRadius: 999, background: "currentColor" }} />;

export default function NumberedAgendaCardPreview() {
  return (
    <SlideCanvas style={{ background: "#f4f5f7", fontFamily: "Arial, sans-serif" }}>
      <div style={{ position: "absolute", left: 190, top: 190, width: 900, display: "flex", flexDirection: "column", gap: 18 }}>
        <NumberedAgendaCard number="01" title="现状与目标" icon={icon} highlighted />
        <NumberedAgendaCard number="02" title="关键路径" icon={icon} />
        <NumberedAgendaCard number="03" title="实施计划" icon={icon} />
      </div>
    </SlideCanvas>
  );
}
