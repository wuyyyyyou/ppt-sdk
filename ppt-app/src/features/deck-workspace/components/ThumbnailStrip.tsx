import type { Slide } from "../../../data/mockDeck";
import type { PresentationDocument, RenderDeckHtmlResult } from "../../../api/types";
import { formatSlideNumber } from "../utils";
import { RenderedSlideImage } from "./RenderedSlideImage";
import { SlidePreviewLoading } from "./SlidePreviewLoading";
import { PresentationRenderer } from "../../presentation-editor/PresentationRenderer";

interface ThumbnailStripProps {
  deck: Slide[];
  currentSlide: number;
  setCurrentSlide: (index: number) => void;
  renderedSlides?: RenderDeckHtmlResult["slides"];
  loadingPreviews?: boolean;
  presentationDocument?: PresentationDocument | null;
  presentationImageAssets?: Record<string, string>;
}

export function ThumbnailStrip({
  deck,
  currentSlide,
  setCurrentSlide,
  renderedSlides = [],
  loadingPreviews = false,
  presentationDocument = null,
  presentationImageAssets,
}: ThumbnailStripProps) {
  const items = presentationDocument?.slides ?? deck;
  return (
    <div className="thumbnail-strip">
      {items.map((item, index) => {
        const structuredSlide = presentationDocument?.slides[index];
        const slide = structuredSlide
          ? deck[structuredSlide.metadata.sourceSlideIndex] ?? deck[index]
          : item as Slide;
        const renderedSlide = renderedSlides[index];
        return (
          <button
            key={structuredSlide?.id ?? `${slide?.title ?? "slide"}-${index}`}
            className={`thumb ${index === currentSlide ? "active" : ""}`}
            onClick={() => setCurrentSlide(index)}
          >
          {structuredSlide ? (
            <div className="thumb-html-frame">
              <PresentationRenderer
                slide={structuredSlide}
                width={presentationDocument?.width}
                height={presentationDocument?.height}
                mode="thumbnail"
                imageAssets={presentationImageAssets}
              />
            </div>
          ) : renderedSlide?.screenshot_upload ? (
            <div className="thumb-html-frame">
              <RenderedSlideImage slide={renderedSlide} />
            </div>
          ) : loadingPreviews ? (
            <div className="thumb-html-frame">
              <SlidePreviewLoading compact />
            </div>
          ) : null}
          <span>{formatSlideNumber(index)}</span>
          <strong>{slide?.title ?? structuredSlide?.id}</strong>
          </button>
        );
      })}
    </div>
  );
}
