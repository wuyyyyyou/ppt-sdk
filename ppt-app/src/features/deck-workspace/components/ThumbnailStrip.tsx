import type { Slide } from "../../../data/mockDeck";
import type { RenderDeckHtmlResult } from "../../../api/types";
import { formatSlideNumber } from "../utils";
import { RenderedSlideImage } from "./RenderedSlideImage";
import { SlidePreviewLoading } from "./SlidePreviewLoading";

interface ThumbnailStripProps {
  deck: Slide[];
  currentSlide: number;
  setCurrentSlide: (index: number) => void;
  renderedSlides?: RenderDeckHtmlResult["slides"];
  loadingPreviews?: boolean;
}

export function ThumbnailStrip({
  deck,
  currentSlide,
  setCurrentSlide,
  renderedSlides = [],
  loadingPreviews = false
}: ThumbnailStripProps) {
  return (
    <div className="thumbnail-strip">
      {deck.map((slide, index) => {
        const renderedSlide = renderedSlides[index];
        return (
          <button
            key={`${slide.title}-${index}`}
            className={`thumb ${index === currentSlide ? "active" : ""}`}
            onClick={() => setCurrentSlide(index)}
          >
          {renderedSlide?.screenshot_url ? (
            <div className="thumb-html-frame">
              <RenderedSlideImage slide={renderedSlide} />
            </div>
          ) : loadingPreviews ? (
            <div className="thumb-html-frame">
              <SlidePreviewLoading compact />
            </div>
          ) : null}
          <span>{formatSlideNumber(index)}</span>
          <strong>{slide.title}</strong>
          </button>
        );
      })}
    </div>
  );
}
