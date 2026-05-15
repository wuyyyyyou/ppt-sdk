import type { Slide } from "../../../data/mockDeck";
import { formatSlideNumber } from "../utils";

interface ThumbnailStripProps {
  deck: Slide[];
  currentSlide: number;
  setCurrentSlide: (index: number) => void;
}

export function ThumbnailStrip({
  deck,
  currentSlide,
  setCurrentSlide
}: ThumbnailStripProps) {
  return (
    <div className="thumbnail-strip">
      {deck.map((slide, index) => (
        <button
          key={`${slide.title}-${index}`}
          className={`thumb ${index === currentSlide ? "active" : ""}`}
          onClick={() => setCurrentSlide(index)}
        >
          <span>{formatSlideNumber(index)}</span>
          <strong>{slide.title}</strong>
        </button>
      ))}
    </div>
  );
}
