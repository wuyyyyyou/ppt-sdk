import {
  AlertTriangle,
  LayoutGrid,
  LoaderCircle,
  Maximize2,
  RefreshCw
} from "lucide-react";
import type { PresentationDocument } from "../../../api/types";
import type { Slide } from "../../../data/mockDeck";
import type { Messages } from "../../../i18n/messages";
import { visibleSlideSubtitle } from "../slideDisplay";
import type { DeckReviewRenderState, PreviewMode } from "../types";
import { formatSlideNumber } from "../utils";
import { PageHeader } from "./PageHeader";
import { RenderedSlideImage } from "./RenderedSlideImage";
import { ThumbnailStrip } from "./ThumbnailStrip";
import { PresentationRenderer } from "../../presentation-editor/PresentationRenderer";

interface ReviewPageProps {
  t: Messages;
  deck: Slide[];
  currentSlide: number;
  setCurrentSlide: (index: number) => void;
  previewMode: PreviewMode;
  setPreviewMode: (mode: PreviewMode) => void;
  reviewRender: DeckReviewRenderState;
  renderDeckHtml: () => Promise<void>;
  onBack: () => void;
  onRefineSlide: (index: number) => void;
  presentationDocument: PresentationDocument | null;
  presentationStatus: "idle" | "loading" | "ready" | "readonly" | "error";
  presentationError: string;
  presentationImageAssets?: Record<string, string>;
  onAdvancedEdit: () => void;
}

export function ReviewPage(props: ReviewPageProps) {
  const {
    t,
    deck,
    currentSlide,
    setCurrentSlide,
    previewMode,
    setPreviewMode,
    reviewRender,
    renderDeckHtml,
    onBack,
    onRefineSlide,
    presentationDocument,
    presentationStatus,
    presentationError,
    onAdvancedEdit
  } = props;
  const selected = deck[currentSlide] ?? deck[0];
  const renderedSlides = reviewRender.result?.slides ?? [];
  const selectedRenderedSlide = renderedSlides[currentSlide] ?? renderedSlides[0];
  const renderWaiting = reviewRender.status === "loading";
  const orderedPresentationDocument = presentationDocument
    ? {
        ...presentationDocument,
        slides: [...presentationDocument.slides].sort((left, right) => left.order - right.order),
      }
    : null;
  const structuredSlide = orderedPresentationDocument?.slides[currentSlide] ?? null;
  const structuredReady = presentationStatus === "ready" && orderedPresentationDocument !== null;

  return (
    <section className="page active review-page">
      <PageHeader
        title={t.review.title}
        onBack={onBack}
        t={t}
        actions={
          <>
            <button className="grid-action-btn primary" onClick={onAdvancedEdit}>
              <Maximize2 size={14} />
              {t.editor.advanced}
            </button>
            <button
              className="icon-action-btn"
              onClick={() => void renderDeckHtml()}
              disabled={reviewRender.status === "loading"}
              title={t.review.renderAgain}
            >
              <RefreshCw size={14} />
            </button>
          </>
        }
      />
      <div className="mode-toggle">
        {(["grid", "present"] as PreviewMode[]).map((mode) => (
          <button
            key={mode}
            className={previewMode === mode ? "active" : ""}
            onClick={() => setPreviewMode(mode)}
          >
            {mode === "grid" ? <LayoutGrid size={14} /> : <Maximize2 size={14} />}
            {t.review[mode]}
          </button>
        ))}
      </div>
      <p className="review-gate">{t.review.htmlGate}</p>

      <section className={`deck-html-review ${reviewRender.status}`}>
        <header className="deck-html-review-header">
          <div>
            <strong>{reviewRender.result?.title ?? t.review.title}</strong>
            {reviewRender.result ? (
              <span>
                {reviewRender.result.slide_count} slides · {reviewRender.result.output_dir}
              </span>
            ) : null}
          </div>
        </header>

        {reviewRender.status === "loading" ? (
          <div className="deck-html-review-state">
            <LoaderCircle size={18} />
            <span>{t.review.rendering}</span>
          </div>
        ) : null}

        {reviewRender.status === "error" ? (
          <div className="deck-html-review-error">
            <AlertTriangle size={18} />
            <div>
              <strong>{t.review.renderFailed}</strong>
              <pre>{reviewRender.error}</pre>
            </div>
          </div>
        ) : null}

        {presentationStatus === "readonly" || presentationStatus === "error" ? (
          <div className="deck-html-review-error">
            <AlertTriangle size={18} />
            <div>
              <strong>{t.editor.structuredUnavailable}</strong>
              {presentationError ? <pre>{presentationError}</pre> : null}
            </div>
          </div>
        ) : null}

        {reviewRender.status === "ready" && !selectedRenderedSlide?.screenshot_upload ? (
          <div className="deck-html-review-state">
            <span>{t.review.renderFailed}</span>
          </div>
        ) : null}
      </section>

      {previewMode === "grid" ? (
        <div className="preview-grid-view">
          {(structuredReady ? orderedPresentationDocument.slides : deck).map((item, index) => {
            const structured = structuredReady ? orderedPresentationDocument.slides[index] : null;
            const slide = structured
              ? deck[structured.metadata.sourceSlideIndex] ?? deck[index]
              : item as Slide;
            const renderedSlide = renderedSlides[index];
            const subtitle = slide ? visibleSlideSubtitle(slide) : "";
            return (
              <article
                key={structured?.id ?? `${slide?.title ?? "slide"}-${index}`}
                className={`grid-card ${index === currentSlide ? "active" : ""}`}
                onClick={() => setCurrentSlide(index)}
              >
              <span>{formatSlideNumber(index)}</span>
              {presentationStatus === "ready" && orderedPresentationDocument?.slides[index] ? (
                <div className="grid-card-html-frame">
                  <PresentationRenderer
                    slide={orderedPresentationDocument.slides[index]!}
                    width={orderedPresentationDocument.width}
                    height={orderedPresentationDocument.height}
                    mode="thumbnail"
                    imageAssets={props.presentationImageAssets}
                  />
                </div>
              ) : renderedSlide?.screenshot_upload ? (
                <div className="grid-card-html-frame">
                  <RenderedSlideImage slide={renderedSlide} />
                </div>
              ) : renderWaiting ? (
                <PreviewLoadingFrame compact label={t.review.rendering} />
              ) : null}
              <strong>{slide?.title ?? structured?.id}</strong>
              {subtitle ? <p>{subtitle}</p> : null}
              {!structuredReady ? (
                <div className="grid-card-actions">
                  <button
                    className="grid-action-btn primary"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRefineSlide(index);
                    }}
                  >
                    {t.controls.refineSlide}
                  </button>
                </div>
              ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {previewMode === "present" ? (
        <div className="preview-present-view">
          {presentationStatus === "ready" && structuredSlide && orderedPresentationDocument ? (
            <div className="present-html-frame structured-preview-frame">
              <PresentationRenderer
                slide={structuredSlide}
                width={orderedPresentationDocument.width}
                height={orderedPresentationDocument.height}
                mode="preview"
                imageAssets={props.presentationImageAssets}
              />
            </div>
          ) : selectedRenderedSlide?.screenshot_upload ? (
            <div className="present-html-frame">
              <RenderedSlideImage slide={selectedRenderedSlide} loading="eager" />
            </div>
          ) : renderWaiting ? (
            <PreviewLoadingFrame label={t.review.rendering} />
          ) : (
            <PreviewLoadingFrame label={selected?.title ?? t.review.rendering} />
          )}
          <ThumbnailStrip
            deck={deck}
            currentSlide={currentSlide}
            setCurrentSlide={setCurrentSlide}
            renderedSlides={renderedSlides}
            loadingPreviews={renderWaiting}
            presentationDocument={presentationStatus === "ready" ? orderedPresentationDocument : null}
          />
        </div>
      ) : null}
    </section>
  );
}

function PreviewLoadingFrame(props: { label: string; compact?: boolean }) {
  return (
    <div className={`preview-loading-frame ${props.compact ? "compact" : ""}`} role="status" aria-live="polite">
      <LoaderCircle size={props.compact ? 18 : 28} />
      <span>{props.label}</span>
    </div>
  );
}
