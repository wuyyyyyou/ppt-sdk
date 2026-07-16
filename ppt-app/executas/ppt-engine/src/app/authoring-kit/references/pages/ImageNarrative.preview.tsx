import ImageNarrativeReference from "./ImageNarrative.tsx";

const image = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560"><rect width="900" height="560" fill="#d1fae5"/><circle cx="660" cy="170" r="120" fill="#6ee7b7"/><path d="M0 470 250 220l170 170 150-120 330 290H0Z" fill="#0f766e" opacity=".75"/></svg>`);

export default function ImageNarrativePreview() {
  return <ImageNarrativeReference title="主图与解释信息" subtitle="图片用于视觉表达，事实仍需来自允许的依据" imageUrl={image} imageAlt="抽象山形示意图" imageTitle="视觉素材示意" imageCaption="说明图片为何适合当前页面，以及它支持哪一部分叙事。" imageSource="来源：Authoring Kit 预览示意" insights={[{ title: "视觉焦点", description: "让主图承担清晰的视觉职责，不把它当作无意义背景。" }, { title: "信息分工", description: "图片、标题和文字解释分别承担不同的信息层级。" }, { title: "事实限制", description: "图片中可见的文字和数字不能自动作为事实依据。" }]} conclusion="图片负责表达和理解，页面文字负责给出经过事实约束的解释。" />;
}
