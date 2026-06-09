import type { Slide } from "../../../data/mockDeck";
import { visibleSlideSubtitle } from "../slideDisplay";
import { formatSlideNumber } from "../utils";

interface SlidePreviewProps {
  slide: Slide;
  index: number;
  large?: boolean;
}

export function SlidePreview({ slide, index, large }: SlidePreviewProps) {
  const subtitle = visibleSlideSubtitle(slide);

  return (
    <div className={`slide-preview-card ${large ? "large" : ""}`}>
      <div className="slide-num-tag">{formatSlideNumber(index)}</div>
      <div className="slide-title-large">{slide.title}</div>
      {subtitle ? <div className="slide-subtitle-large">{subtitle}</div> : null}
    </div>
  );
}
