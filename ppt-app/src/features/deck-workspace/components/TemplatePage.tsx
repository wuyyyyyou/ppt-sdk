import { CheckCircle2, ImageIcon, Layers, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import type { TemplateSummary } from "../../../api/types";
import type { Messages } from "../../../i18n/messages";
import type { LoadingKind } from "../types";
import { TemplatePreviewModal } from "./TemplatePreviewModal";

interface TemplatePageProps {
  t: Messages;
  templates: TemplateSummary[];
  selectedTemplateGroupId: string | null;
  loading: LoadingKind;
  selectTemplate: (groupId: string) => Promise<void>;
}

export function TemplatePage(props: TemplatePageProps) {
  const {
    t,
    templates,
    selectedTemplateGroupId,
    loading,
    selectTemplate,
  } = props;

  const [previewGroupId, setPreviewGroupId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  const previewTemplate = previewGroupId
    ? templates.find((template) => template.group_id === previewGroupId) ?? null
    : null;

  function openPreview(groupId: string, index = 0) {
    setPreviewGroupId(groupId);
    setPreviewIndex(index);
  }

  function closePreview() {
    setPreviewGroupId(null);
  }

  return (
    <section className="page active template-page">
      <div className="template-page-heading">
        <div>
          <h1 className="prompt-label">{t.template.title}</h1>
          <p>{t.template.helper}</p>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="template-empty">{loading === "template" ? t.template.loading : t.template.empty}</div>
      ) : (
        <div className="template-grid">
          {templates.map((template) => (
            <TemplateCard
              key={template.group_id}
              t={t}
              template={template}
              selected={selectedTemplateGroupId === template.group_id}
              busy={loading === "template" && selectedTemplateGroupId !== template.group_id}
              onSelect={() => selectTemplate(template.group_id)}
              onOpenPreview={() => openPreview(template.group_id, 0)}
            />
          ))}
        </div>
      )}

      {previewTemplate && previewTemplate.previews.length > 0 ? (
        <TemplatePreviewModal
          t={t}
          template={previewTemplate}
          previews={previewTemplate.previews}
          initialIndex={previewIndex}
          selected={selectedTemplateGroupId === previewTemplate.group_id}
          busy={loading === "template"}
          onClose={closePreview}
          onSelect={() => {
            void selectTemplate(previewTemplate.group_id).then(closePreview);
          }}
        />
      ) : null}
    </section>
  );
}

function TemplateCard(props: {
  t: Messages;
  template: TemplateSummary;
  selected: boolean;
  busy: boolean;
  onSelect: () => Promise<void>;
  onOpenPreview: () => void;
}) {
  const { t, template, selected, busy, onSelect, onOpenPreview } = props;
  const previewUrl = template.preview?.url;
  const previewCount = template.previews?.length ?? 0;
  const canOpenPreview = previewCount > 0;

  return (
    <article className={`template-card ${selected ? "active" : ""}`}>
      <button
        type="button"
        className="template-preview template-preview-button"
        onClick={onOpenPreview}
        disabled={!canOpenPreview}
        aria-label={t.template.viewAll}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" loading="lazy" />
        ) : (
          <div className="template-preview-placeholder">
            <ImageIcon size={22} />
          </div>
        )}
        {selected ? (
          <div className="template-selected-badge">
            <CheckCircle2 size={14} />
          </div>
        ) : null}
        {canOpenPreview ? (
          <div className="template-preview-overlay">
            <span className="template-preview-overlay-chip">
              <Search size={13} />
              {t.template.viewAll}
              <em>{previewCount}</em>
            </span>
          </div>
        ) : null}
      </button>
      <div className="template-card-body">
        <div className="template-card-title-row">
          <h2>{template.group_name}</h2>
          <span>
            <Layers size={13} />
            {template.layout_count} {t.template.layouts}
          </span>
        </div>
        <p>{template.group_brief || template.group_description}</p>
        <div className="template-tags">
          {(template.style_tags ?? template.use_cases ?? []).slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <button className="template-use-btn" disabled={busy} onClick={() => void onSelect()}>
          {busy ? <span className="spinner small" /> : <Sparkles size={14} />}
          {t.controls.useTemplate}
        </button>
      </div>
    </article>
  );
}
