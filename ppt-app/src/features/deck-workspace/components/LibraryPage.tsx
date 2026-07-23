import { Archive, Download, Edit3, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { WorkspaceResult, WorkspaceSettings } from "../../../api/types";
import type { Messages } from "../../../i18n/messages";
import {
  PAGE_GENERATION_CONCURRENCY_MAX,
  PAGE_GENERATION_CONCURRENCY_MIN,
  readPageGenerationConcurrency,
} from "../generationConcurrency";
import {
  DEFAULT_VISUAL_REVIEW_FAILURE_LIMIT,
  pageReviewSettingsToWorkspaceSettings,
  readPageReviewSettings,
  REVIEW_FAILURE_LIMIT_MAX,
  REVIEW_FAILURE_LIMIT_MIN,
  type PageReviewSettings,
} from "../reviewSettings";
import type { WorkspaceDiagnosticBundleState } from "../types";
import { useDownloadUrlAvailability } from "../useDownloadUrlAvailability";
import { CopyableDownloadLink } from "./CopyableDownloadLink";
import { PageHeader } from "./PageHeader";

interface LibraryPageProps {
  t: Messages;
  settings: WorkspaceSettings;
  currentWorkspace: WorkspaceResult | null;
  loading: boolean;
  savingSettings: boolean;
  pageReviewSettings: PageReviewSettings;
  onBack: () => void;
  onSaveSettings: (setting: WorkspaceSettings) => Promise<void>;
  onSaveTitle: (title: string) => Promise<void>;
  workspaceDiagnosticBundle: WorkspaceDiagnosticBundleState;
  onPrepareWorkspaceDiagnosticBundle: () => Promise<void>;
  onResetWorkspaceDiagnosticBundle: () => void;
}

function toEditableSettings(settings: WorkspaceSettings, pageReviewSettings: PageReviewSettings) {
  return {
    ...settings,
    ...pageReviewSettingsToWorkspaceSettings(pageReviewSettings),
    page_generation_concurrency: readPageGenerationConcurrency(settings),
    visual_review_enabled: pageReviewSettings.visualReviewEnabled,
    visual_review_failure_limit: pageReviewSettings.visualReviewFailureLimit,
  };
}

export function LibraryPage({
  t,
  settings,
  currentWorkspace,
  loading,
  savingSettings,
  pageReviewSettings,
  onBack,
  onSaveSettings,
  onSaveTitle,
  workspaceDiagnosticBundle,
  onPrepareWorkspaceDiagnosticBundle,
  onResetWorkspaceDiagnosticBundle,
}: LibraryPageProps) {
  const [editing, setEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draft, setDraft] = useState(toEditableSettings(settings, pageReviewSettings));
  const [titleDraft, setTitleDraft] = useState(currentWorkspace?.task_id ?? "");

  useEffect(() => {
    setDraft(toEditableSettings(settings, pageReviewSettings));
    setTitleDraft(getWorkspaceTitle(currentWorkspace));
    setEditing(false);
    setEditingTitle(false);
  }, [currentWorkspace, pageReviewSettings, settings, t]);

  async function saveSettings() {
    await onSaveSettings(draft);
    setEditing(false);
  }

  async function saveTitle() {
    const nextTitle = titleDraft.trim();
    if (!nextTitle || !currentWorkspace) return;
    await onSaveTitle(nextTitle);
    setEditingTitle(false);
  }

  const diagnosticBundleAvailability = useDownloadUrlAvailability(workspaceDiagnosticBundle);
  const diagnosticButtonLabel = workspaceDiagnosticBundle.status === "preparing"
    ? t.library.diagnosticBundlePreparing
    : workspaceDiagnosticBundle.status === "error"
      ? t.library.diagnosticBundleRetry
      : diagnosticBundleAvailability.expired
        ? t.library.diagnosticBundleRetry
        : t.library.diagnosticBundleGenerate;
  const diagnosticStatusMessage = diagnosticBundleAvailability.expired
    ? t.library.diagnosticBundleExpired
    : workspaceDiagnosticBundle.message;

  return (
    <section className="page active library-page settings-page">
      <PageHeader title={t.library.title} onBack={onBack} t={t} />

      {currentWorkspace ? (
        <div className="workspace-row">
          <div>
            <span className="workspace-section-label">{t.library.currentWorkspace}</span>
            {editingTitle ? (
              <span className="workspace-title-editor">
                <input value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveTitle(); if (event.key === "Escape") setEditingTitle(false); }} autoFocus />
                <button className="primary-btn compact" onClick={() => void saveTitle()} disabled={savingSettings}>{t.controls.save}</button>
                <button className="secondary-btn compact" onClick={() => setEditingTitle(false)} disabled={savingSettings}>{t.controls.cancel}</button>
              </span>
            ) : (
              <button className="workspace-title-button" onClick={() => setEditingTitle(true)} disabled={savingSettings} title={t.controls.edit}>
                <span>{getWorkspaceTitle(currentWorkspace)}</span><Edit3 className="workspace-title-edit-icon" size={13} />
              </button>
            )}
            <span>{currentWorkspace.task_dir ?? currentWorkspace.workspace_dir}</span>
          </div>
        </div>
      ) : null}

      <div className="preferences-box">
        <div className="pref-header">
          <strong>{t.library.preferences}</strong>
          {editing ? (
            <div className="pref-actions"><button className="secondary-btn compact" onClick={() => setEditing(false)} disabled={savingSettings}>{t.controls.cancel}</button><button className="primary-btn compact" onClick={() => void saveSettings()} disabled={savingSettings}>{t.controls.save}</button></div>
          ) : <button className="secondary-btn compact" onClick={() => setEditing(true)} disabled={savingSettings}><Edit3 size={12} />{t.controls.edit}</button>}
        </div>
        <PreferenceSwitch label={t.preferences.visualReviewEnabled} value={draft.visual_review_enabled === true} editing={editing} t={t} onChange={(value) => setDraft((next) => ({ ...next, visual_review_enabled: value }))} />
        <PreferenceNumber label={t.preferences.pageGenerationConcurrency} value={Number(draft.page_generation_concurrency)} editing={editing} min={PAGE_GENERATION_CONCURRENCY_MIN} max={PAGE_GENERATION_CONCURRENCY_MAX} onChange={(value) => setDraft((next) => ({ ...next, page_generation_concurrency: value }))} />
        <PreferenceNumber label={t.preferences.visualReviewFailureLimit} value={Number(draft.visual_review_failure_limit ?? DEFAULT_VISUAL_REVIEW_FAILURE_LIMIT)} editing={editing} min={REVIEW_FAILURE_LIMIT_MIN} max={REVIEW_FAILURE_LIMIT_MAX} onChange={(value) => setDraft((next) => ({ ...next, visual_review_failure_limit: value }))} />
      </div>

      {currentWorkspace ? (
        <div className="diagnostic-bundle-box">
          <div className="diagnostic-bundle-header"><div><strong>{t.library.diagnosticBundleTitle}</strong><p>{t.library.diagnosticBundleDescription}</p></div>{workspaceDiagnosticBundle.href ? <button className="diagnostic-bundle-refresh-btn" type="button" aria-label={t.library.diagnosticBundleRefresh} title={t.library.diagnosticBundleRefresh} onClick={onResetWorkspaceDiagnosticBundle}><RefreshCw size={20} /></button> : <Archive size={20} />}</div>
          <div className="diagnostic-bundle-warning">{t.library.diagnosticBundleSensitiveHint}</div>
          <div className="diagnostic-bundle-action">
            {diagnosticBundleAvailability.active && workspaceDiagnosticBundle.href ? <CopyableDownloadLink href={workspaceDiagnosticBundle.href} inputLabel={t.library.diagnosticBundleLinkLabel} copyLabel={t.library.diagnosticBundleCopyLink} copiedMessage={t.library.diagnosticBundleLinkCopied} copyHint={t.library.diagnosticBundleCopyHint} /> : <button className="diagnostic-bundle-generate-btn" type="button" disabled={loading || workspaceDiagnosticBundle.status === "preparing"} aria-busy={workspaceDiagnosticBundle.status === "preparing"} onClick={() => void onPrepareWorkspaceDiagnosticBundle()}><Download size={15} /><span>{diagnosticButtonLabel}</span></button>}
          </div>
          {diagnosticStatusMessage ? <div className={`diagnostic-bundle-status ${workspaceDiagnosticBundle.status === "error" ? "error" : ""}`}>{diagnosticStatusMessage}</div> : null}
        </div>
      ) : null}
    </section>
  );
}

function getWorkspaceTitle(workspace: WorkspaceResult | null) {
  if (workspace?.task && typeof workspace.task === "object" && !Array.isArray(workspace.task) && typeof (workspace.task as { title?: unknown }).title === "string") return (workspace.task as { title: string }).title;
  return workspace?.task_id ?? workspace?.workspace_id ?? "";
}

function clampPreferenceNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function PreferenceSwitch(props: { label: string; value: boolean; editing: boolean; t: Messages; onChange: (value: boolean) => void }) {
  return <label className="pref-row"><span>{props.label}</span>{props.editing ? <input type="checkbox" checked={props.value} onChange={(event) => props.onChange(event.target.checked)} /> : <strong>{props.value ? props.t.preferences.enabled : props.t.preferences.disabled}</strong>}</label>;
}

function PreferenceNumber(props: { label: string; value: number; editing: boolean; min: number; max: number; onChange: (value: number) => void }) {
  const value = clampPreferenceNumber(props.value, props.min, props.max);
  return <label className="pref-row"><span>{props.label}</span>{props.editing ? <input type="number" min={props.min} max={props.max} step={1} value={value} onChange={(event) => props.onChange(clampPreferenceNumber(Number(event.target.value), props.min, props.max))} /> : <strong>{value}</strong>}</label>;
}
