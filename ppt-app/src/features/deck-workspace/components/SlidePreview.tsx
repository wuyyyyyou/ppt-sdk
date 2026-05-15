import type { Slide } from "../../../data/mockDeck";
import { formatSlideNumber } from "../utils";

interface SlidePreviewProps {
  slide: Slide;
  index: number;
  large?: boolean;
}

export function SlidePreview({ slide, index, large }: SlidePreviewProps) {
  return (
    <div className={`slide-preview-card ${large ? "large" : ""}`}>
      <div className="slide-num-tag">{formatSlideNumber(index)}</div>
      <div className="slide-title-large">{slide.title}</div>
      <div className="slide-subtitle-large">{slide.subtitle}</div>
    </div>
  );
}
