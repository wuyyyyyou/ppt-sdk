import type { Slide } from "../../../data/mockDeck";
import type { RenderDeckHtmlResult } from "../../../api/types";
import { formatSlideNumber } from "../utils";
import { RenderedSlideImage } from "./RenderedSlideImage";

interface ThumbnailStripProps {
  deck: Slide[];
  currentSlide: number;
  setCurrentSlide: (index: number) => void;
  renderedSlides?: RenderDeckHtmlResult["slides"];
}

export function ThumbnailStrip({
  deck,
  currentSlide,
  setCurrentSlide,
  renderedSlides = []
}: ThumbnailStripProps) {
  return (
    <div className="thumbnail-strip">
      {deck.map((slide, index) => (
        <button
          key={`${slide.title}-${index}`}
          className={`thumb ${index === currentSlide ? "active" : ""}`}
          onClick={() => setCurrentSlide(index)}
        >
          {renderedSlides[index]?.screenshot_url ? (
            <div className="thumb-html-frame">
              <RenderedSlideImage slide={renderedSlides[index]} />
            </div>
          ) : null}
          <span>{formatSlideNumber(index)}</span>
          <strong>{slide.title}</strong>
        </button>
      ))}
    </div>
  );
}
