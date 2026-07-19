import { useEffect, useState } from "react";
import type { Slide } from "../../../data/mockDeck";
import { formatMessage, type Messages } from "../../../i18n/messages";
import type { DeckReviewRenderState, LoadingKind, RefineScope } from "../types";
import { PageHeader } from "./PageHeader";
import { RenderedSlideImage } from "./RenderedSlideImage";
import { RefineSteps } from "./RefineSteps";
import { SlidePreview } from "./SlidePreview";
import { SlidePreviewNavigator } from "./SlidePreviewNavigator";

interface RefinePageProps {
  t: Messages;
  deck: Slide[];
  slide: Slide;
  slideIndex: number;
  slideNumber: string;
  refineScope: RefineScope;
  reviewRender: DeckReviewRenderState;
  loading: LoadingKind;
  onBack: () => void;
  onRefineDeck: (instruction: string) => void;
  onRefineSlide: (instruction: string) => void;
}

export function RefinePage(props: RefinePageProps) {
  const {
    t,
    deck,
    slide,
    slideIndex,
    slideNumber,
    refineScope,
    reviewRender,
    loading,
    onBack,
    onRefineDeck,
    onRefineSlide
  } = props;
  const [deckInstruction, setDeckInstruction] = useState("");
  const [slideInstruction, setSlideInstruction] = useState("");
  const [deckPreviewSlide, setDeckPreviewSlide] = useState(slideIndex);
  const renderedSlides = reviewRender.result?.slides ?? [];
  const renderedSlide = renderedSlides[slideIndex] ?? null;
  const showRenderedSlide =
    reviewRender.status === "ready" && Boolean(renderedSlide?.screenshot_upload);

  useEffect(() => {
    if (refineScope === "deck") {
      setDeckPreviewSlide(slideIndex);
    }
  }, [refineScope, slideIndex]);

  return (
    <section className="page active refine-page">
      <PageHeader title={t.refine.title} onBack={onBack} t={t} />

      <div className="refine-content">
        {refineScope === "deck" ? (
          <SlidePreviewNavigator
            t={t}
            deck={deck}
            currentSlide={deckPreviewSlide}
            setCurrentSlide={setDeckPreviewSlide}
            reviewRender={reviewRender}
          />
        ) : showRenderedSlide && renderedSlide ? (
          <div className="deck-stage-html-frame refine-slide-html-frame">
            <RenderedSlideImage slide={renderedSlide} loading="eager" />
          </div>
        ) : (
          <SlidePreview slide={slide} index={slideIndex} />
        )}
        {refineScope === "deck" ? (
          <>
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
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </section>
  );
}
