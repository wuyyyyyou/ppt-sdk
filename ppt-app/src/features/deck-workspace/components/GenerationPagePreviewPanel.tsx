import { AlertCircle, LoaderCircle } from "lucide-react";
import { useMemo } from "react";
import { formatMessage, type Messages } from "../../../i18n/messages";
import {
  orderGenerationPagePreviews,
  resolveGenerationPreviewSelection,
  type GenerationPagePreviewEntry,
  type GenerationPagePreviews,
} from "../generationPagePreviews";

interface GenerationPagePreviewPanelProps {
  t: Messages;
  previews: GenerationPagePreviews;
  pinnedPageId: string | null;
  onSelectPage: (pageId: string | null) => void;
  activePageIndex?: number | null;
}

export function GenerationPagePreviewPanel(props: GenerationPagePreviewPanelProps) {
  const { t, previews, pinnedPageId, onSelectPage, activePageIndex } = props;
  const entries = useMemo(() => orderGenerationPagePreviews(previews), [previews]);
  const selected = resolveGenerationPreviewSelection({ entries, pinnedPageId, activePageIndex });
  const latest = entries[entries.length - 1] ?? null;
  const followingLatest = !pinnedPageId || pinnedPageId === latest?.pageId;

  return (
    <section className="generation-preview-panel" aria-label={t.generating.preview.title}>
      <div className="generation-preview-header">
        <div>
          <div className="section-label">{t.generating.preview.title}</div>
          {/* No page yet: the stage below already carries the loading status, so
              leaving the heading empty keeps that message on screen only once. */}
          <strong>{selected ? pageHeading(t, selected) : null}</strong>
        </div>
        {entries.length > 0 ? (
          followingLatest ? (
            <span className="generation-preview-follow-hint">{t.generating.preview.followingLatest}</span>
          ) : (
            <button
              className="generation-preview-follow-btn"
              type="button"
              onClick={() => onSelectPage(null)}
            >
              {t.generating.preview.backToLatest}
            </button>
          )
        ) : null}
      </div>

      <div className="generation-preview-stage">
        {selected?.status === "ready" && selected.imageUpload?.url ? (
          <img src={selected.imageUpload.url} alt={pageHeading(t, selected)} />
        ) : selected?.status === "error" ? (
          <div className="generation-preview-placeholder">
            <AlertCircle size={20} aria-hidden="true" />
            <span>{t.generating.preview.failed}</span>
          </div>
        ) : selected ? (
          <div className="generation-preview-placeholder" role="status" aria-live="polite">
            <LoaderCircle className="generation-running-icon" size={20} aria-hidden="true" />
            <span>{t.generating.preview.loading}</span>
          </div>
        ) : (
          <div className="generation-preview-placeholder" role="status" aria-live="polite">
            <LoaderCircle className="generation-running-icon" size={20} aria-hidden="true" />
            <span>{t.generating.preview.loading}</span>
          </div>
        )}
      </div>

      {entries.length > 0 ? (
        <div
          className="generation-preview-thumbnails"
          role="tablist"
          aria-label={t.generating.preview.thumbnails}
        >
          {entries.map((entry) => {
            const active = entry.pageId === selected?.pageId;
            return (
              <button
                key={entry.pageId}
                className={`generation-preview-thumbnail ${entry.status} ${active ? "active" : ""}`}
                type="button"
                role="tab"
                aria-selected={active}
                title={pageHeading(t, entry)}
                aria-label={formatMessage(t.generating.preview.selectPage, {
                  page: entry.pageIndex + 1,
                })}
                onClick={() => onSelectPage(entry.pageId)}
              >
                <span className="generation-preview-thumbnail-frame">
                  {entry.status === "ready" && entry.imageUpload?.url ? (
                    <img src={entry.imageUpload.url} alt="" loading="lazy" />
                  ) : entry.status === "error" ? (
                    <AlertCircle size={14} aria-hidden="true" />
                  ) : (
                    <LoaderCircle className="generation-running-icon" size={14} aria-hidden="true" />
                  )}
                </span>
                <span className="generation-preview-thumbnail-index">{entry.pageIndex + 1}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function pageHeading(t: Messages, entry: GenerationPagePreviewEntry) {
  const title = entry.title.trim() || t.generating.preview.untitledPage;
  return `${entry.pageIndex + 1}. ${title}`;
}
