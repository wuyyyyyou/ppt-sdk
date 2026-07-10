import { AlertTriangle, Check, CheckCircle2, ChevronDown, File, HelpCircle, ImageIcon, Search, Sparkles, Upload, X } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import type {
  GetStyleProfilePreviewResult,
  StyleProfileIndexEntry,
  TemplateSummary,
  UploadedSourceMaterial,
  WorkspaceStyleProfileSelection,
} from "../../../api/types";
import type { Messages } from "../../../i18n/messages";
import type { ContextRow, LoadingKind, StyleProfileDetailState } from "../types";
import { TemplatePreviewModal } from "./TemplatePreviewModal";
import { StyleProfileBriefSelection } from "./StyleProfilePage";
import { isStrictReviewModeEnabled, type PageReviewSettings } from "../reviewSettings";
import type { ResearchSearchControlSettings } from "../researchSearchControl";
import { filterSelectableTemplates } from "../templateSelectionPolicy";
import { ResearchSearchControlSwitches } from "./ResearchSearchControlSwitches";

const SLIDE_COUNT_OPTIONS = ["auto", ...Array.from({ length: 20 }, (_, index) => String(index + 1))];

interface BriefPageProps {
  t: Messages;
  prompt: string;
  setPrompt: (value: string) => void;
  templates: TemplateSummary[];
  selectedTemplateGroupId: string | null;
  styleProfiles: StyleProfileIndexEntry[];
  styleProfilePreviews: Record<string, GetStyleProfilePreviewResult | undefined>;
  selectedStyleProfile: WorkspaceStyleProfileSelection | null;
  styleProfileLibraryLoading: boolean;
  styleProfileLibraryError: string;
  styleProfileDetail: StyleProfileDetailState;
  loading: LoadingKind;
  selectTemplate: (groupId: string) => Promise<void>;
  refreshStyleProfiles: () => Promise<void>;
  loadStyleProfilePreview: (styleProfileId: string) => Promise<void>;
  openStyleProfileDetail: (styleProfileId: string) => Promise<void>;
  closeStyleProfileDetail: () => void;
  selectStyleProfile: (styleProfileId: string) => Promise<void>;
  clearStyleProfile: () => Promise<void>;
  reviewOutlineFirst: boolean;
  setReviewOutlineFirst: (value: boolean) => Promise<void>;
  pageReviewSettings: PageReviewSettings;
  setStrictReviewMode: (enabled: boolean) => Promise<void>;
  researchSearchControlSettings: ResearchSearchControlSettings;
  workspaceSettingsSaving: boolean;
  setResearchSearchControlSettings: (settings: ResearchSearchControlSettings) => Promise<void>;
  contextRows: ContextRow[];
  uploadedSources: UploadedSourceMaterial[];
  addContextRow: (row: ContextRow) => void;
  updateContextRow: (id: string, value: string) => void;
  removeContextRow: (id: string) => void;
  uploadUploadedSource: (file: File) => Promise<void>;
  removeUploadedSource: (uploadedSourceId: string) => Promise<void>;
  addStyleRow: () => void;
  suggestContextFromPrompt: () => Promise<void>;
  generateDeck: () => Promise<void>;
}

export function BriefPage(props: BriefPageProps) {
  const {
    t,
    prompt,
    setPrompt,
    templates,
    selectedTemplateGroupId,
    styleProfiles,
    styleProfilePreviews,
    selectedStyleProfile,
    styleProfileLibraryLoading,
    styleProfileLibraryError,
    styleProfileDetail,
    loading,
    selectTemplate,
    refreshStyleProfiles,
    loadStyleProfilePreview,
    openStyleProfileDetail,
    closeStyleProfileDetail,
    selectStyleProfile,
    clearStyleProfile,
    reviewOutlineFirst,
    setReviewOutlineFirst,
    pageReviewSettings,
    setStrictReviewMode,
    researchSearchControlSettings,
    workspaceSettingsSaving,
    setResearchSearchControlSettings,
    contextRows,
    uploadedSources,
    addContextRow,
    updateContextRow,
    removeContextRow,
    uploadUploadedSource,
    removeUploadedSource,
    addStyleRow,
    suggestContextFromPrompt,
    generateDeck,
  } = props;
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [styleProfilePickerOpen, setStyleProfilePickerOpen] = useState(false);
  const [strictReviewConfirmOpen, setStrictReviewConfirmOpen] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const isCreating =
    loading === "deck" ||
    loading === "outline" ||
    loading === "review" ||
    loading === "theme" ||
    loading === "uploadedSourceAnalysis";
  const isSuggestingContext = loading === "context";
  const isCreateButtonLoading = isCreating || isSuggestingContext;
  const strictReviewMode = isStrictReviewModeEnabled(pageReviewSettings);

  function toggleStrictReviewMode() {
    if (strictReviewMode) {
      void setStrictReviewMode(false);
      return;
    }

    setStrictReviewConfirmOpen(true);
  }

  function confirmStrictReviewMode() {
    setStrictReviewConfirmOpen(false);
    void setStrictReviewMode(true);
  }

  function openUploadPicker() {
    uploadInputRef.current?.click();
  }

  async function uploadSelectedFiles(files: File[]) {
    for (const file of files) {
      await uploadUploadedSource(file);
    }
  }

  function handleUploadSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void uploadSelectedFiles(files);
  }

  return (
    <section className="page active brief-page">
      <h1 className="prompt-label">{t.brief.title}</h1>
      <div className="prompt-input-wrapper">
        <textarea
          className="prompt-input"
          id="deck-brief-prompt"
          name="deck-brief-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={t.brief.placeholder}
        />
        <div className="prompt-inline-actions">
          <button
            className="inline-context-btn"
            onClick={suggestContextFromPrompt}
            disabled={isCreating || isSuggestingContext}
          >
            {isSuggestingContext ? (
              <span className="spinner small" />
            ) : (
              <Sparkles size={14} />
            )}
            {t.controls.suggestContext}
          </button>
          <button
            className="inline-create-btn"
            onClick={generateDeck}
            disabled={isCreating || isSuggestingContext || workspaceSettingsSaving}
          >
            {isCreateButtonLoading ? (
              <span className="spinner small" />
            ) : (
              <Sparkles size={14} />
            )}
            {t.controls.createDeck}
          </button>
        </div>
      </div>

      <div className="brief-toggle-columns">
        <div className="brief-toggle-column">
          <button
            type="button"
            className={`checkbox-row ${reviewOutlineFirst ? "active" : ""}`}
            onClick={() => void setReviewOutlineFirst(!reviewOutlineFirst)}
            aria-checked={reviewOutlineFirst}
            role="switch"
            disabled={isCreating || isSuggestingContext || workspaceSettingsSaving}
          >
            <span className="checkbox-custom">
              {reviewOutlineFirst ? <Check size={11} strokeWidth={3} /> : null}
            </span>
            <span>{t.brief.reviewOutlineFirst}</span>
          </button>

          <div className="checkbox-row-with-help">
            <button
              type="button"
              className={`checkbox-row ${strictReviewMode ? "active" : ""}`}
              onClick={toggleStrictReviewMode}
              aria-checked={strictReviewMode}
              role="switch"
              disabled={isCreating || isSuggestingContext || workspaceSettingsSaving}
            >
              <span className="checkbox-custom">
                {strictReviewMode ? <Check size={11} strokeWidth={3} /> : null}
              </span>
              <span>{t.brief.strictReviewMode}</span>
            </button>
            <span className="help-tooltip" tabIndex={0} aria-label={t.brief.strictReviewModeHelp}>
              <HelpCircle size={15} />
              <span className="help-tooltip-content">{t.brief.strictReviewModeHelp}</span>
            </span>
          </div>
        </div>

        <ResearchSearchControlSwitches
          t={t}
          settings={researchSearchControlSettings}
          disabled={isCreating || isSuggestingContext || workspaceSettingsSaving}
          onChange={(settings) => {
            void setResearchSearchControlSettings(settings);
          }}
        />
      </div>

      {strictReviewConfirmOpen ? (
        <div
          className="strict-review-confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="strict-review-confirm-title"
          onClick={() => setStrictReviewConfirmOpen(false)}
        >
          <section
            className="strict-review-confirm-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="strict-review-confirm-icon">
              <AlertTriangle size={22} />
            </div>
            <div className="strict-review-confirm-copy">
              <h2 id="strict-review-confirm-title">
                {t.brief.strictReviewConfirmTitle}
              </h2>
              <p>{t.brief.strictReviewConfirmBody}</p>
            </div>
            <footer className="strict-review-confirm-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setStrictReviewConfirmOpen(false)}
              >
                {t.controls.cancel}
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={confirmStrictReviewMode}
              >
                {t.brief.strictReviewConfirmAction}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      <div className="brief-options">
        <div>
          <div className="section-label">{t.brief.optionalContext}</div>
          <div className="chips-row">
            <button
              className="chip-btn"
              onClick={() =>
                addContextRow({
                  id: "audience",
                  label: t.brief.contextLabels.audience,
                  value: "",
                  placeholder: t.brief.contextPlaceholders.audience
                })
              }
            >
              {t.brief.chips.audience}
            </button>
            <button
              className="chip-btn"
              onClick={() =>
                addContextRow({
                  id: "goal",
                  label: t.brief.contextLabels.goal,
                  value: "",
                  placeholder: t.brief.contextPlaceholders.goal
                })
              }
            >
              {t.brief.chips.goal}
            </button>
            <button className="chip-btn" onClick={addStyleRow}>
              {t.brief.chips.style}
            </button>
            <button
              className="chip-btn"
              onClick={() =>
                addContextRow({
                  id: "content",
                  label: t.brief.contextLabels.contentSource,
                  value: "",
                  placeholder: t.brief.contextPlaceholders.contentSource
                })
              }
            >
              {t.brief.chips.content}
            </button>
            <button className="chip-btn" onClick={openUploadPicker} disabled={loading === "upload" || loading === "uploadedSourceAnalysis"}>
              <Upload size={13} />
              {t.brief.chips.attachment}
            </button>
            <button
              className="chip-btn"
              onClick={() =>
                addContextRow({
                  id: "slides",
                  label: t.brief.contextLabels.slides,
                  value: "auto",
                  type: "select",
                  options: SLIDE_COUNT_OPTIONS,
                  allowCustomValue: true
                })
              }
            >
              {t.brief.contextLabels.slides}
            </button>
            <button
              className={`chip-btn ${templatePickerOpen ? "active" : ""}`}
              onClick={() => {
                setTemplatePickerOpen((value) => !value);
                setStyleProfilePickerOpen(false);
              }}
            >
              {t.brief.chips.template}
            </button>
            <button
              className={`chip-btn ${styleProfilePickerOpen ? "active" : ""}`}
              onClick={() => {
                setStyleProfilePickerOpen((value) => !value);
                setTemplatePickerOpen(false);
                void refreshStyleProfiles();
              }}
            >
              风格画像
            </button>
          </div>
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            className="uploaded-source-input"
            onChange={handleUploadSelection}
            aria-label={t.controls.chooseFile}
          />
        </div>
      </div>

      <div className="context-rows-container">
        {templatePickerOpen ? (
          <StyleSelection
            t={t}
            templates={templates}
            selectedTemplateGroupId={selectedTemplateGroupId}
            loading={loading}
            selectTemplate={selectTemplate}
          />
        ) : null}

        {styleProfilePickerOpen ? (
          <StyleProfileBriefSelection
            profiles={styleProfiles}
            previews={styleProfilePreviews}
            selectedStyleProfile={selectedStyleProfile}
            libraryLoading={styleProfileLibraryLoading}
            libraryError={styleProfileLibraryError}
            detail={styleProfileDetail}
            onRefresh={refreshStyleProfiles}
            onLoadPreview={loadStyleProfilePreview}
            onOpenDetail={openStyleProfileDetail}
            onCloseDetail={closeStyleProfileDetail}
            onSelect={selectStyleProfile}
            onClear={clearStyleProfile}
          />
        ) : null}

        {contextRows.map((row) => (
          <ContextRowView
            key={row.id}
            row={row}
            t={t}
            update={updateContextRow}
            remove={removeContextRow}
            onUpload={openUploadPicker}
          />
        ))}
        {uploadedSources.length > 0 ? (
          <div className="uploaded-source-block">
            <div className="uploaded-source-list">
              {uploadedSources.map((source) => (
                <span className="file-pill visible uploaded-source-pill" key={source.uploaded_source_id}>
                  <File size={12} />
                  {source.display_name || source.original_filename}
                  {source.duplicate_of.length > 0 ? (
                    <span className="uploaded-source-warning">{t.brief.uploadedSourceStatus.duplicate}</span>
                  ) : null}
                  <button
                    type="button"
                    className="context-remove-btn"
                    disabled={loading === "uploadedSourceAnalysis"}
                    onClick={() => void removeUploadedSource(source.uploaded_source_id)}
                    aria-label={`Remove ${source.display_name || source.original_filename}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function StyleSelection(props: {
  t: Messages;
  templates: TemplateSummary[];
  selectedTemplateGroupId: string | null;
  loading: LoadingKind;
  selectTemplate: (groupId: string) => Promise<void>;
}) {
  const { t, templates, selectedTemplateGroupId, loading, selectTemplate } = props;
  const selectableTemplates = filterSelectableTemplates(templates);
  const [previewGroupId, setPreviewGroupId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewTemplate = previewGroupId
    ? selectableTemplates.find((template) => template.group_id === previewGroupId) ?? null
    : null;

  function openPreview(groupId: string, index = 0) {
    setPreviewGroupId(groupId);
    setPreviewIndex(index);
  }

  function closePreview() {
    setPreviewGroupId(null);
  }

  return (
    <section className="style-selection-section">
      <div className="style-selection-heading">
        <div>
          <div className="section-label">{t.template.title}</div>
          <p>{t.template.helper}</p>
        </div>
      </div>

      {selectableTemplates.length === 0 ? (
        <div className="template-empty">
          {loading === "template" ? t.template.loading : t.template.empty}
        </div>
      ) : (
        <div className="template-grid style-template-grid">
          {selectableTemplates.map((template) => (
            <StyleTemplateCard
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

function StyleTemplateCard(props: {
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
        </div>
        <button className="template-use-btn" disabled={busy} onClick={() => void onSelect()}>
          {busy ? <span className="spinner small" /> : <Sparkles size={14} />}
          {t.controls.useTemplate}
        </button>
      </div>
    </article>
  );
}

function isThinkingStatus(message: string) {
  return /^(Thinking through|Checking page|正在思考|正在检查)/.test(message);
}

export function ThinkingStatusText({
  text,
  active = false,
  showOrb = true
}: {
  text: string;
  active?: boolean;
  showOrb?: boolean;
}) {
  if (!active && !isThinkingStatus(text)) {
    return <>{text}</>;
  }

  return (
    <span className="thinking-status" aria-label={text}>
      {showOrb ? <span className="thinking-status-orb" aria-hidden="true" /> : null}
      <span className="thinking-status-text">{text}</span>
      <span className="thinking-status-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </span>
  );
}

function ContextRowView(props: {
  row: ContextRow;
  t: Messages;
  update: (id: string, value: string) => void;
  remove: (id: string) => void;
  onUpload: () => void;
}) {
  const { row, t, update, remove, onUpload } = props;

  return (
    <div className="context-row">
      <div className="context-label">{row.label}</div>
      {row.type === "select" && row.allowCustomValue ? (
        <div className="context-combo">
          <input
            className="context-combo-input"
            value={row.value}
            onChange={(event) => update(row.id, event.target.value)}
            placeholder={row.placeholder}
          />
          <label className="context-combo-select-wrap">
            <select
              className="context-combo-select"
              value={row.options?.includes(row.value) ? row.value : ""}
              onChange={(event) => update(row.id, event.target.value)}
              aria-label={row.label}
            >
              {!row.options?.includes(row.value) ? (
                <option value="" disabled>
                  {t.controls.suggestions}
                </option>
              ) : null}
              {row.options?.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>
        </div>
      ) : row.type === "select" ? (
        <select
          className="context-select"
          value={row.value}
          onChange={(event) => update(row.id, event.target.value)}
        >
          {row.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : row.type === "attachment" ? (
        <div className="attachment-inline">
          <button className="upload-btn" onClick={onUpload}>
            <Upload size={12} />
            {t.controls.chooseFile}
          </button>
          <input
            className="context-input"
            value={row.value}
            onChange={(event) => update(row.id, event.target.value)}
            placeholder={row.placeholder ?? t.brief.contextDefaults.attachmentPlaceholder}
          />
        </div>
      ) : (
        <input
          className="context-input"
          value={row.value}
          onChange={(event) => update(row.id, event.target.value)}
          placeholder={row.placeholder}
        />
      )}
      <button className="context-remove-btn" onClick={() => remove(row.id)}>
        <X size={12} />
      </button>
    </div>
  );
}
