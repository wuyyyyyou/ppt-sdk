import { ChevronDown, Layers, LayoutTemplate, MessageCircle, RefreshCw, Wand2 } from "lucide-react";
import { useState } from "react";
import type { Slide } from "../../../data/mockDeck";
import type { Messages } from "../../../i18n/messages";
import type { DeckReviewRenderState } from "../types";
import { SlidePreviewNavigator } from "./SlidePreviewNavigator";

interface DeckPageProps {
  t: Messages;
  deck: Slide[];
  currentSlide: number;
  setCurrentSlide: (index: number) => void;
  reviewRender: DeckReviewRenderState;
  loading: string;
  onRefineDeck: () => void;
  onRefineSlide: () => void;
  onRewriteSlide: () => void;
  onChangeSlideLayout: (mode: SlideLayoutMode) => void;
  onRefreshPreview: () => void;
  onPreview: () => void;
  onExport: () => void;
}

export type SlideLayoutMode = "simpler" | "visual" | "comparison" | "process" | "report";

export function DeckPage(props: DeckPageProps) {
  const {
    t,
    deck,
    currentSlide,
    setCurrentSlide,
    reviewRender,
    loading,
    onRefineDeck,
    onRefineSlide,
    onRewriteSlide,
    onChangeSlideLayout,
    onRefreshPreview,
    onPreview,
    onExport
  } = props;
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const localAiDisabled = loading === "refineSlide" || loading === "refineDeck" || loading === "deck";
  const refreshDisabled = reviewRender.status === "loading" || loading === "review";
  const layoutOptions: Array<{ mode: SlideLayoutMode; label: string }> = [
    { mode: "simpler", label: t.controls.layoutSimpler },
    { mode: "visual", label: t.controls.layoutVisual },
    { mode: "comparison", label: t.controls.layoutComparison },
    { mode: "process", label: t.controls.layoutProcess },
    { mode: "report", label: t.controls.layoutReport },
  ];
  return (
    <section className="page active deck-page">
      <div className="deck-top-actions">
        <div className="slide-ai-actions">
          <button className="secondary-btn compact" onClick={onRefineDeck} disabled={localAiDisabled}>
            <Layers size={14} />
            {t.controls.refineDeck}
          </button>
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
          <button
            className="secondary-btn compact"
            onClick={onRefreshPreview}
            disabled={refreshDisabled}
            title={t.review.renderAgain}
          >
            <RefreshCw size={14} />
            {t.review.renderAgain}
          </button>
        </div>
      </div>

      <SlidePreviewNavigator
        t={t}
        deck={deck}
        currentSlide={currentSlide}
        setCurrentSlide={setCurrentSlide}
        reviewRender={reviewRender}
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
