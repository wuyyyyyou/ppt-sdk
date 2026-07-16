import SlideCanvas from "../../foundations/SlideCanvas.tsx";
import ImageShowcaseReference from "./ImageShowcase.tsx";

const previewImage = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520">
    <rect width="900" height="520" fill="#dbeafe"/>
    <circle cx="650" cy="170" r="120" fill="#93c5fd"/>
    <path d="M0 430 230 230l170 150 130-110 370 250H0Z" fill="#2563eb" opacity=".72"/>
  </svg>
`);

export default function ImageShowcasePreview() {
  return (
    <SlideCanvas style={{ background: "#f4f5f7", fontFamily: "Arial, sans-serif" }}>
      <div style={{ position: "absolute", left: 170, top: 70, width: 940, height: 580 }}>
        <ImageShowcaseReference
          url={previewImage}
          alt="抽象山形示意图"
          title="单张主图与解释信息"
          caption="图片区域保持独立，标题、说明和来源继续使用可编辑文本。"
          source="来源：Authoring Kit 预览示意"
        />
      </div>
    </SlideCanvas>
  );
}
