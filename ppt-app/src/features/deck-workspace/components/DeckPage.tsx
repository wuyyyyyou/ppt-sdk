import { ChevronDown, ChevronLeft, ChevronRight, Edit3, LayoutTemplate, LoaderCircle, MessageCircle, Wand2 } from "lucide-react";
import { useState } from "react";
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
  onSaveDeckTitle: (value: string) => Promise<void>;
  deck: Slide[];
  currentSlide: number;
  setCurrentSlide: (index: number) => void;
  reviewRender: DeckReviewRenderState;
  loading: string;
  onRefineDeck: () => void;
  onRefineSlide: () => void;
  onRewriteSlide: () => void;
  onChangeSlideLayout: (mode: SlideLayoutMode) => void;
  onPreview: () => void;
  onExport: () => void;
}

export type SlideLayoutMode = "simpler" | "visual" | "comparison" | "process" | "report";

export function DeckPage(props: DeckPageProps) {
  const {
    t,
    deckTitle,
    setDeckTitle,
    onSaveDeckTitle,
    deck,
    currentSlide,
    setCurrentSlide,
    reviewRender,
    loading,
    onRefineDeck,
    onRefineSlide,
    onRewriteSlide,
    onChangeSlideLayout,
    onPreview,
    onExport
  } = props;
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const slide = deck[currentSlide] ?? deck[0];
  const renderedSlides = reviewRender.result?.slides ?? [];
  const selectedRenderedSlide = renderedSlides[currentSlide] ?? renderedSlides[0];
  const localAiDisabled = loading === "refineSlide" || loading === "refineDeck" || loading === "deck";
  const showPreviewLoading = reviewRender.status === "loading";
  const layoutOptions: Array<{ mode: SlideLayoutMode; label: string }> = [
    { mode: "simpler", label: t.controls.layoutSimpler },
    { mode: "visual", label: t.controls.layoutVisual },
    { mode: "comparison", label: t.controls.layoutComparison },
    { mode: "process", label: t.controls.layoutProcess },
    { mode: "report", label: t.controls.layoutReport },
  ];
  const saveDeckTitle = () => {
    const title = deckTitle.trim();
    if (!title) return;
    if (title !== deckTitle) {
      setDeckTitle(title);
    }
    void onSaveDeckTitle(title);
  };

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
      ) : showPreviewLoading ? (
        <div className="deck-stage-loading" role="status" aria-live="polite">
          <LoaderCircle size={28} />
          <span>{t.review.rendering}</span>
        </div>
      ) : (
        <SlidePreview slide={slide} index={currentSlide} large />
      )}

      <div className="preview-controls">
        <label className="deck-title-editor">
          <input
            value={deckTitle}
            onChange={(event) => setDeckTitle(event.target.value)}
            onBlur={saveDeckTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
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
        <div className="slide-ai-actions">
          <button className="secondary-btn compact" onClick={onRefineSlide} disabled={localAiDisabled}>
            <MessageCircle size={14} />
            {t.controls.refineSlide}
          </button>
          <button className="secondary-btn compact" onClick={onRewriteSlide} disabled={localAiDisabled}>
            <Wand2 size={14} />
            {t.controls.rewriteSlide}
          </button>
          <div className="layout-switcher">
            <button
              className="secondary-btn compact"
              onClick={() => setLayoutMenuOpen((open) => !open)}
              disabled={localAiDisabled}
              aria-haspopup="menu"
              aria-expanded={layoutMenuOpen}
            >
              <LayoutTemplate size={14} />
              {t.controls.changeLayout}
              <ChevronDown size={13} />
            </button>
            {layoutMenuOpen ? (
              <div className="layout-switcher-menu" role="menu">
                {layoutOptions.map((option) => (
                  <button
                    key={option.mode}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setLayoutMenuOpen(false);
                      onChangeSlideLayout(option.mode);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
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
