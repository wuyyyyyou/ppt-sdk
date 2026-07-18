import { AlertTriangle, LayoutGrid, LoaderCircle, Maximize2, RefreshCw } from "lucide-react";
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
  onBack: () => void;
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
          <button className="icon-action-btn" onClick={() => void props.renderDeckHtml()} disabled={renderWaiting} title={props.t.review.renderAgain}>
            <RefreshCw size={14} />
          </button>
        }
      />
      <div className="mode-toggle">
        <button className={mode === "grid" ? "active" : ""} onClick={() => props.setPreviewMode("grid")}>
          <LayoutGrid size={14} />{props.t.review.grid}
        </button>
        <button className={mode === "present" ? "active" : ""} onClick={() => props.setPreviewMode("present")}>
          <Maximize2 size={14} />{props.t.review.present}
        </button>
      </div>
      {props.reviewRender.status === "loading" ? <PreviewLoadingFrame label={props.t.review.rendering} /> : null}
      {props.reviewRender.status === "error" ? (
        <div className="deck-html-review-error"><AlertTriangle size={18} /><pre>{props.reviewRender.error}</pre></div>
      ) : null}
      {mode === "grid" ? (
        <div className="preview-grid-view">
          {props.deck.map((slide, index) => (
            <article key={`${slide.title}-${index}`} className={`grid-card ${index === props.currentSlide ? "active" : ""}`} onClick={() => props.setCurrentSlide(index)}>
              <span>{formatSlideNumber(index)}</span>
              {renderedSlides[index]?.screenshot_upload ? (
                <div className="grid-card-html-frame">
                  <RenderedSlideImage slide={renderedSlides[index]} />
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
                <RenderedSlideImage slide={selectedRenderedSlide} loading="eager" />
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
