import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import type { Slide } from "../../../data/mockDeck";
import { formatMessage, type Messages } from "../../../i18n/messages";
import type { DeckReviewRenderState } from "../types";
import { formatSlideCount, formatSlideNumber } from "../utils";
import { RenderedSlideImage } from "./RenderedSlideImage";
import { SlidePreview } from "./SlidePreview";
import { ThumbnailStrip } from "./ThumbnailStrip";

interface SlidePreviewNavigatorProps {
  t: Messages;
  deck: Slide[];
  currentSlide: number;
  setCurrentSlide: (index: number) => void;
  reviewRender: DeckReviewRenderState;
}

export function SlidePreviewNavigator(props: SlidePreviewNavigatorProps) {
  const { t, deck, currentSlide, setCurrentSlide, reviewRender } = props;
  const maxSlideIndex = Math.max(0, deck.length - 1);
  const selectedIndex = Math.min(Math.max(currentSlide, 0), maxSlideIndex);
  const slide = deck[selectedIndex] ?? deck[0];
  const renderedSlides = reviewRender.result?.slides ?? [];
  const selectedRenderedSlide = renderedSlides[selectedIndex] ?? renderedSlides[0];
  const showPreviewLoading = reviewRender.status === "loading";

  return (
    <>
      {reviewRender.status === "ready" && selectedRenderedSlide?.screenshot_url ? (
        <div className="deck-stage-html-frame">
          <RenderedSlideImage slide={selectedRenderedSlide} loading="eager" />
        </div>
      ) : showPreviewLoading ? (
        <div className="deck-stage-loading" role="status" aria-live="polite">
          <LoaderCircle size={28} />
          <span>{t.review.rendering}</span>
        </div>
      ) : slide ? (
        <SlidePreview slide={slide} index={selectedIndex} large />
      ) : null}

      <div className="preview-controls">
        <button
          className="nav-arrow"
          disabled={selectedIndex === 0}
          onClick={() => setCurrentSlide(Math.max(0, selectedIndex - 1))}
        >
          <ChevronLeft size={16} />
        </button>
        <div className="slide-counter">
          {formatMessage(t.deck.slideCounter, {
            current: formatSlideNumber(selectedIndex),
            total: formatSlideCount(deck.length)
          })}
        </div>
        <button
          className="nav-arrow"
          disabled={selectedIndex === maxSlideIndex}
          onClick={() => setCurrentSlide(Math.min(maxSlideIndex, selectedIndex + 1))}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <ThumbnailStrip
        deck={deck}
        currentSlide={selectedIndex}
        setCurrentSlide={setCurrentSlide}
        renderedSlides={renderedSlides}
        loadingPreviews={reviewRender.status === "loading"}
      />
    </>
  );
}
