import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { PresentationDocument } from "../../../api/types";
import type { Slide } from "../../../data/mockDeck";
import { formatMessage, type Messages } from "../../../i18n/messages";
import { BasicPresentationStage } from "../../presentation-editor/BasicPresentationStage";
import { StructuredRendererBoundary } from "../../presentation-editor/StructuredRendererBoundary";
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
  presentationDocument?: PresentationDocument | null;
  presentationStatus?: "idle" | "loading" | "ready" | "readonly" | "error";
  presentationError?: string;
  presentationImageAssets?: Record<string, string>;
}

export function SlidePreviewNavigator(props: SlidePreviewNavigatorProps) {
  const {
    t,
    deck,
    currentSlide,
    setCurrentSlide,
    reviewRender,
    presentationDocument,
    presentationStatus,
  } = props;
  const [rendererError, setRendererError] = useState("");
  const slideCount = presentationStatus === "ready"
    ? presentationDocument?.slides.length ?? deck.length
    : deck.length;
  const maxSlideIndex = Math.max(0, slideCount - 1);
  const selectedIndex = Math.min(Math.max(currentSlide, 0), maxSlideIndex);
  const slide = deck[selectedIndex] ?? deck[0];
  const renderedSlides = reviewRender.result?.slides ?? [];
  const selectedRenderedSlide = renderedSlides[selectedIndex] ?? renderedSlides[0];
  const structuredLoading = presentationStatus === "idle" || presentationStatus === "loading";
  const structuredReady = presentationStatus === "ready" && !!presentationDocument && !rendererError;
  const structuredEnabled = presentationStatus !== undefined;
  const fallbackReason = rendererError || props.presentationError || t.editor.structuredUnavailable;

  const pngFallback = (
    <>
      <div className="structured-preview-status fallback" role="status">
        <strong>{t.editor.structuredFallback}</strong>
        <span>{fallbackReason}</span>
      </div>
      {selectedRenderedSlide?.screenshot_upload ? (
        <div className="deck-stage-html-frame">
          <RenderedSlideImage slide={selectedRenderedSlide} loading="eager" />
        </div>
      ) : slide ? (
        <SlidePreview slide={slide} index={selectedIndex} large />
      ) : null}
    </>
  );

  return (
    <>
      {!structuredEnabled ? (
        reviewRender.status === "ready" && selectedRenderedSlide?.screenshot_upload ? (
          <div className="deck-stage-html-frame">
            <RenderedSlideImage slide={selectedRenderedSlide} loading="eager" />
          </div>
        ) : reviewRender.status === "loading" ? (
          <div className="deck-stage-loading" role="status" aria-live="polite">
            <LoaderCircle size={28} />
            <span>{t.review.rendering}</span>
          </div>
        ) : slide ? (
          <SlidePreview slide={slide} index={selectedIndex} large />
        ) : null
      ) : structuredReady ? (
        <div className="structured-preview-root">
          <div className="structured-preview-status ready" role="status">
            {t.editor.structuredReady}
          </div>
          <StructuredRendererBoundary
            resetKey={`${presentationDocument.revision}-${selectedIndex}`}
            onError={(error) => setRendererError(error.message)}
            fallback={(error) => (
              <div className="structured-renderer-fallback">
                <div className="structured-preview-status fallback" role="alert">
                  <strong>{t.editor.structuredFallback}</strong>
                  <span>{error.message}</span>
                </div>
                {selectedRenderedSlide?.screenshot_upload ? (
                  <div className="deck-stage-html-frame">
                    <RenderedSlideImage slide={selectedRenderedSlide} loading="eager" />
                  </div>
                ) : slide ? (
                  <SlidePreview slide={slide} index={selectedIndex} large />
                ) : null}
              </div>
            )}
          >
            <BasicPresentationStage
              document={presentationDocument}
              currentSlide={selectedIndex}
              imageAssets={props.presentationImageAssets}
            />
          </StructuredRendererBoundary>
        </div>
      ) : structuredLoading ? (
        <div className="deck-stage-loading" role="status" aria-live="polite">
          <LoaderCircle size={28} />
          <span>{t.editor.structuredLoading}</span>
        </div>
      ) : pngFallback}

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
            total: formatSlideCount(slideCount)
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
        loadingPreviews={structuredEnabled ? structuredLoading : reviewRender.status === "loading"}
        presentationDocument={structuredReady ? presentationDocument : null}
        presentationImageAssets={props.presentationImageAssets}
      />
    </>
  );
}
