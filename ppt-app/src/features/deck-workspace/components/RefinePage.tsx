import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import type { Slide } from "../../../data/mockDeck";
import { formatMessage, type Messages } from "../../../i18n/messages";
import type { DeckReviewRenderState, LoadingKind, RefineScope } from "../types";
import { deckReadyStatus } from "../utils";
import { PageHeader } from "./PageHeader";
import { RefineSteps } from "./RefineSteps";
import { SlidePreview } from "./SlidePreview";

interface RefinePageProps {
  t: Messages;
  scope: RefineScope;
  setScope: (scope: RefineScope) => void;
  slide: Slide;
  slideIndex: number;
  slideNumber: string;
  deckCount: number;
  reviewRender: DeckReviewRenderState;
  loading: LoadingKind;
  onBack: () => void;
  onRefineDeck: (instruction: string) => void;
  onRefineSlide: (instruction: string) => void;
}

export function RefinePage(props: RefinePageProps) {
  const {
    t,
    scope,
    setScope,
    slide,
    slideIndex,
    slideNumber,
    deckCount,
    reviewRender,
    loading,
    onBack,
    onRefineDeck,
    onRefineSlide
  } = props;
  const [deckInstruction, setDeckInstruction] = useState("");
  const [slideInstruction, setSlideInstruction] = useState("");
  const renderedSlides = reviewRender.result?.slides ?? [];
  const renderedSlide = renderedSlides[slideIndex] ?? null;
  const showRenderedSlide =
    reviewRender.status === "ready" && Boolean(renderedSlide?.preview_url);

  return (
    <section className="page active refine-page">
      <PageHeader title={t.refine.title} onBack={onBack} t={t} />
      <div className="scope-toggle">
        <button className={scope === "deck" ? "active" : ""} onClick={() => setScope("deck")}>
          {t.refine.deckScope}
        </button>
        <button className={scope === "slide" ? "active" : ""} onClick={() => setScope("slide")}>
          {t.refine.slideScope}
        </button>
      </div>

      {scope === "deck" ? (
        <div className="refine-content">
          <div className="refine-summary">
            <CheckCircle2 size={18} />
            <div>
              <strong>{deckReadyStatus(t, deckCount)}</strong>
              <span>Changes will apply across the whole deck.</span>
            </div>
          </div>
          <label className="refine-label">
            {t.refine.deckPrompt}
            <textarea
              id="deck-refine-prompt"
              name="deck-refine-prompt"
              className="refine-input"
              placeholder={t.refine.deckPlaceholder}
              value={deckInstruction}
              onChange={(event) => setDeckInstruction(event.target.value)}
            />
          </label>
          {loading === "refineDeck" ? <RefineSteps steps={t.refine.deckSteps} /> : null}
          <button
            className="primary-btn full"
            onClick={() => onRefineDeck(deckInstruction)}
            disabled={loading === "refineDeck" || !deckInstruction.trim()}
          >
            {loading === "refineDeck" ? <span className="spinner small" /> : null}
            {t.controls.applyToDeck}
          </button>
        </div>
      ) : (
        <div className="refine-content">
          {showRenderedSlide && renderedSlide ? (
            <div className="deck-stage-html-frame refine-slide-html-frame">
              <iframe
                title={renderedSlide.title}
                src={renderedSlide.preview_url}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          ) : (
            <SlidePreview slide={slide} index={slideIndex} />
          )}
          <p>
            {formatMessage(t.refine.slideHelper, {
              number: slideNumber
            })}
          </p>
          <label className="refine-label">
            {t.refine.slidePrompt}
            <textarea
              id="slide-refine-prompt"
              name="slide-refine-prompt"
              className="refine-input"
              placeholder={t.refine.slidePlaceholder}
              value={slideInstruction}
              onChange={(event) => setSlideInstruction(event.target.value)}
            />
          </label>
          {loading === "refineSlide" ? <RefineSteps steps={t.refine.slideSteps} /> : null}
          <button
            className="primary-btn full"
            onClick={() => onRefineSlide(slideInstruction)}
            disabled={loading === "refineSlide" || !slideInstruction.trim()}
          >
            {loading === "refineSlide" ? <span className="spinner small" /> : null}
            {t.controls.applyToSlide}
          </button>
        </div>
      )}
    </section>
  );
}
