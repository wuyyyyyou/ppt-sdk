import { ChevronLeft, ChevronRight, Edit3, MessageCircle } from "lucide-react";
import type { Slide } from "../../../data/mockDeck";
import { formatMessage, type Messages } from "../../../i18n/messages";
import type { DeckReviewRenderState } from "../types";
import { formatSlideCount, formatSlideNumber } from "../utils";
import { RenderedSlideImage } from "./RenderedSlideImage";
import { SlidePreview } from "./SlidePreview";
import { ThumbnailStrip } from "./ThumbnailStrip";

interface DeckPageProps {
  t: Messages;
  deckTitle: string;
  setDeckTitle: (value: string) => void;
  deck: Slide[];
  currentSlide: number;
  setCurrentSlide: (index: number) => void;
  reviewRender: DeckReviewRenderState;
  onRefineDeck: () => void;
  onRefineSlide: () => void;
  onPreview: () => void;
  onExport: () => void;
}

export function DeckPage(props: DeckPageProps) {
  const {
    t,
    deckTitle,
    setDeckTitle,
    deck,
    currentSlide,
    setCurrentSlide,
    reviewRender,
    onRefineDeck,
    onRefineSlide,
    onPreview,
    onExport
  } = props;
  const slide = deck[currentSlide] ?? deck[0];
  const renderedSlides = reviewRender.result?.slides ?? [];
  const selectedRenderedSlide = renderedSlides[currentSlide] ?? renderedSlides[0];

  return (
    <section className="page active deck-page">
      <div className="deck-top-actions">
        <button className="secondary-btn" onClick={onRefineDeck}>
          {t.controls.refineDeck}
        </button>
      </div>

      {reviewRender.status === "ready" && selectedRenderedSlide?.screenshot_url ? (
        <div className="deck-stage-html-frame">
          <RenderedSlideImage slide={selectedRenderedSlide} loading="eager" />
        </div>
      ) : (
        <SlidePreview slide={slide} index={currentSlide} large />
      )}

      <div className="preview-controls">
        <label className="deck-title-editor">
          <input
            value={deckTitle}
            onChange={(event) => setDeckTitle(event.target.value)}
            aria-label="Deck title"
          />
          <Edit3 size={14} />
        </label>
        <button
          className="nav-arrow"
          disabled={currentSlide === 0}
          onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
        >
          <ChevronLeft size={16} />
        </button>
        <div className="slide-counter">
          {formatMessage(t.deck.slideCounter, {
            current: formatSlideNumber(currentSlide),
            total: formatSlideCount(deck.length)
          })}
        </div>
        <button
          className="nav-arrow"
          disabled={currentSlide === deck.length - 1}
          onClick={() => setCurrentSlide(Math.min(deck.length - 1, currentSlide + 1))}
        >
          <ChevronRight size={16} />
        </button>
        <button className="secondary-btn refine-slide-btn" onClick={onRefineSlide}>
          <MessageCircle size={14} />
          {t.controls.refineSlide}
        </button>
      </div>

      <ThumbnailStrip
        deck={deck}
        currentSlide={currentSlide}
        setCurrentSlide={setCurrentSlide}
        renderedSlides={renderedSlides}
      />

      <div className="action-bar">
        <button className="secondary-btn" onClick={onPreview}>
          {t.controls.preview}
        </button>
        <button className="secondary-btn" onClick={onExport}>
          {t.controls.export}
        </button>
      </div>
    </section>
  );
}
