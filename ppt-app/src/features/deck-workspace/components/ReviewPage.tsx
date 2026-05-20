import {
  AlertTriangle,
  ChevronDown,
  Copy,
  ExternalLink,
  GripVertical,
  LayoutGrid,
  LoaderCircle,
  Maximize2,
  Plus,
  RefreshCw,
  Trash2
} from "lucide-react";
import type { Slide } from "../../../data/mockDeck";
import type { Messages } from "../../../i18n/messages";
import type { DeckReviewRenderState, PreviewMode } from "../types";
import { formatSlideNumber } from "../utils";
import { PageHeader } from "./PageHeader";
import { SlidePreview } from "./SlidePreview";
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
  updateDeckTitle: (index: number, title: string) => void;
  moveSlide: (index: number, direction: -1 | 1) => void;
  deleteSlide: (index: number) => void;
  addSlide: () => void;
  onRefineSlide: (index: number) => void;
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
    updateDeckTitle,
    moveSlide,
    deleteSlide,
    addSlide,
    onRefineSlide
  } = props;
  const selected = deck[currentSlide] ?? deck[0];
  const renderedSlides = reviewRender.result?.slides ?? [];
  const selectedRenderedSlide = renderedSlides[currentSlide] ?? renderedSlides[0];

  return (
    <section className="page active review-page">
      <PageHeader title={t.review.title} onBack={onBack} t={t} />
      <div className="mode-toggle">
        {(["grid", "organize", "present"] as PreviewMode[]).map((mode) => (
          <button
            key={mode}
            className={previewMode === mode ? "active" : ""}
            onClick={() => setPreviewMode(mode)}
          >
            {mode === "grid" ? (
              <LayoutGrid size={14} />
            ) : mode === "organize" ? (
              <GripVertical size={14} />
            ) : (
              <Maximize2 size={14} />
            )}
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
          <div className="deck-html-review-actions">
            {selectedRenderedSlide?.preview_url ? (
              <a
                className="icon-action-btn"
                href={selectedRenderedSlide.preview_url}
                target="_blank"
                rel="noreferrer"
                title={t.review.openHtml}
              >
                <ExternalLink size={14} />
              </a>
            ) : null}
            <button
              className="icon-action-btn"
              onClick={() => void renderDeckHtml()}
              disabled={reviewRender.status === "loading"}
              title={t.review.renderAgain}
            >
              <RefreshCw size={14} />
            </button>
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

        {reviewRender.status === "ready" && !selectedRenderedSlide?.preview_url ? (
          <div className="deck-html-review-state">
            <span>{t.review.renderFailed}</span>
          </div>
        ) : null}
      </section>

      {previewMode === "grid" ? (
        <div className="preview-grid-view">
          {deck.map((slide, index) => (
            <article
              key={`${slide.title}-${index}`}
              className={`grid-card ${index === currentSlide ? "active" : ""}`}
              onClick={() => setCurrentSlide(index)}
            >
              <span>{formatSlideNumber(index)}</span>
              {renderedSlides[index]?.preview_url ? (
                <div className="grid-card-html-frame">
                  <iframe
                    title={renderedSlides[index].title}
                    src={renderedSlides[index].preview_url}
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              ) : null}
              <strong>{slide.title}</strong>
              <p>{slide.subtitle}</p>
              <div className="grid-card-actions">
                <button className="grid-action-btn primary" onClick={() => onRefineSlide(index)}>
                  {t.controls.refineSlide}
                </button>
                <button className="grid-action-btn">
                  <Copy size={12} />
                  {t.controls.duplicate}
                </button>
                <button className="grid-action-btn" onClick={() => deleteSlide(index)}>
                  <Trash2 size={12} />
                  {t.controls.delete}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {previewMode === "organize" ? (
        <div className="preview-organize-view">
          {deck.map((slide, index) => (
            <div key={`${slide.title}-${index}`} className="organize-item">
              <span>{formatSlideNumber(index)}</span>
              <input
                value={slide.title}
                onChange={(event) => updateDeckTitle(index, event.target.value)}
              />
              <div className="organize-actions">
                <button onClick={() => moveSlide(index, -1)}>
                  <ChevronDown className="up" size={14} />
                </button>
                <button onClick={() => moveSlide(index, 1)}>
                  <ChevronDown size={14} />
                </button>
                <button onClick={() => deleteSlide(index)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          <button className="organize-add-btn" onClick={addSlide}>
            <Plus size={14} />
            {t.controls.addSlide}
          </button>
        </div>
      ) : null}

      {previewMode === "present" ? (
        <div className="preview-present-view">
          {selectedRenderedSlide?.preview_url ? (
            <div className="present-html-frame">
              <iframe
                title={selectedRenderedSlide.title}
                src={selectedRenderedSlide.preview_url}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          ) : (
            <SlidePreview slide={selected} index={currentSlide} large />
          )}
          <ThumbnailStrip
            deck={deck}
            currentSlide={currentSlide}
            setCurrentSlide={setCurrentSlide}
            renderedSlides={renderedSlides}
          />
        </div>
      ) : null}
    </section>
  );
}
