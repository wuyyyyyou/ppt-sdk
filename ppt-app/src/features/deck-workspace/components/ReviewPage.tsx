import { AlertTriangle, Edit3, LayoutGrid, LoaderCircle, Maximize2, RefreshCw } from "lucide-react";
import type { Slide } from "../../../data/mockDeck";
import type { Messages } from "../../../i18n/messages";
import type { DeckReviewRenderState, PreviewMode } from "../types";
import { formatSlideNumber } from "../utils";
import { PageHeader } from "./PageHeader";
import { RenderedSlideImage } from "./RenderedSlideImage";
import { ThumbnailStrip } from "./ThumbnailStrip";

interface ReviewPageProps {
  t: Messages;
  deck: Slide[];
  currentSlide: number;
  setCurrentSlide: (index: number) => void;
  previewMode: PreviewMode;
  setPreviewMode: (mode: PreviewMode) => void;
  reviewRender: DeckReviewRenderState;
  renderDeckHtml: () => Promise<void>;
  refreshPageImage: (pageId: string) => Promise<void>;
  onBack: () => void;
  onEdit: () => void;
}

export function ReviewPage(props: ReviewPageProps) {
  const renderedSlides = props.reviewRender.result?.slides ?? [];
  const selectedRenderedSlide = renderedSlides[props.currentSlide] ?? renderedSlides[0];
  const renderWaiting = props.reviewRender.status === "loading";
  const mode = props.previewMode === "present" ? "present" : "grid";
  return (
    <section className="page active review-page">
      <PageHeader
        title={props.t.review.title}
        onBack={props.onBack}
        t={props.t}
        actions={
          <>
            <button
              data-performance-id="review.manual-edit"
              className="icon-action-btn"
              onClick={props.onEdit}
              title={props.t.controls.edit}
              aria-label={props.t.controls.edit}
            >
              <Edit3 size={14} aria-hidden="true" />
            </button>
            <button
              data-performance-id="review.render-again"
              className="icon-action-btn"
              onClick={() => void props.renderDeckHtml()}
              disabled={renderWaiting}
              title={props.t.review.renderAgain}
              aria-label={props.t.review.renderAgain}
            >
              <RefreshCw size={14} aria-hidden="true" />
            </button>
          </>
        }
      />
      <div className="mode-toggle">
        <button
          data-performance-id="review.mode.grid"
          className={mode === "grid" ? "active" : ""}
          aria-pressed={mode === "grid"}
          onClick={() => props.setPreviewMode("grid")}
        >
          <LayoutGrid size={14} aria-hidden="true" />{props.t.review.grid}
        </button>
        <button
          data-performance-id="review.mode.present"
          className={mode === "present" ? "active" : ""}
          aria-pressed={mode === "present"}
          onClick={() => props.setPreviewMode("present")}
        >
          <Maximize2 size={14} aria-hidden="true" />{props.t.review.present}
        </button>
      </div>
      {props.reviewRender.status === "loading" ? <PreviewLoadingFrame label={props.t.review.rendering} /> : null}
      {props.reviewRender.status === "error" ? (
        <div className="deck-html-review-error"><AlertTriangle size={18} aria-hidden="true" /><pre>{props.reviewRender.error}</pre></div>
      ) : null}
      {mode === "grid" ? (
        <div className="preview-grid-view">
          {props.deck.map((slide, index) => (
            <article key={`${slide.title}-${index}`} className={`grid-card ${index === props.currentSlide ? "active" : ""}`} onClick={() => props.setCurrentSlide(index)}>
              <span>{formatSlideNumber(index)}</span>
              {renderedSlides[index]?.screenshot_upload ? (
                <div className="grid-card-html-frame">
                  <RenderedSlideImage
                    slide={renderedSlides[index]}
                    onLoadError={(pageId) => void props.refreshPageImage(pageId)}
                  />
                </div>
              ) : renderWaiting ? (
                <PreviewLoadingFrame compact label={props.t.review.rendering} />
              ) : null}
              <strong>{slide.title}</strong>
            </article>
          ))}
        </div>
      ) : (
        <div className="preview-present-view">
          {selectedRenderedSlide?.screenshot_upload
            ? (
              <div className="present-html-frame">
                <RenderedSlideImage
                  slide={selectedRenderedSlide}
                  loading="eager"
                  onLoadError={(pageId) => void props.refreshPageImage(pageId)}
                />
              </div>
            )
            : <PreviewLoadingFrame label={props.t.review.rendering} />}
          <ThumbnailStrip
            deck={props.deck}
            currentSlide={props.currentSlide}
            setCurrentSlide={props.setCurrentSlide}
            renderedSlides={renderedSlides}
            loadingPreviews={renderWaiting}
          />
        </div>
      )}
    </section>
  );
}

function PreviewLoadingFrame({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`preview-loading-frame ${compact ? "compact" : ""}`} role="status" aria-live="polite">
      <LoaderCircle size={compact ? 18 : 28} />
      <span>{label}</span>
    </div>
  );
}
