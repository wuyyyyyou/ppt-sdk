import IconText from "./IconText.tsx";
import SlideCanvas from "./SlideCanvas.tsx";

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 4v4M16 4v4M4 10h16" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default function IconTextPreview() {
  return (
    <SlideCanvas style={{ background: "#ffffff", color: "#172033", fontFamily: "Arial, sans-serif" }}>
      <div style={{ position: "absolute", left: 120, top: 210 }}>
        <IconText
          icon={<CalendarIcon />}
          label="2026 年度规划"
          height={42}
          iconSize={24}
          gap={14}
          fontSize={26}
          fontWeight={700}
          color="#2563eb"
        />
      </div>
      <div style={{ position: "absolute", left: 120, top: 300 }}>
        <IconText
          icon={<span style={{ width: 10, height: 10, borderRadius: 999, background: "#16a34a" }} />}
          label="已完成"
          height={30}
          iconSize={10}
          gap={8}
          fontSize={18}
          color="#166534"
        />
      </div>
    </SlideCanvas>
  );
}
