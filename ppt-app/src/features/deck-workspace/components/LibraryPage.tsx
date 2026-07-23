import { Archive, Download, Edit3, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  ListWorkspacesResult,
  WorkspaceResult,
  WorkspaceSettings,
  WorkspaceSummary
} from "../../../api/types";
import { formatMessage, type Locale, type Messages } from "../../../i18n/messages";
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
  locale: Locale;
  workspaceScan: ListWorkspacesResult | null;
  currentWorkspace: WorkspaceResult | null;
  loading: boolean;
  savingSettings: boolean;
  pageReviewSettings: PageReviewSettings;
  onBack: () => void;
  onOpen: (workspaceDir: string) => Promise<void>;
  onCreateWorkspace: () => Promise<void>;
  onSaveSettings: (setting: WorkspaceSettings) => Promise<void>;
  onSaveTitle: (title: string) => Promise<void>;
  workspaceDiagnosticBundle: WorkspaceDiagnosticBundleState;
  onPrepareWorkspaceDiagnosticBundle: () => Promise<void>;
  onResetWorkspaceDiagnosticBundle: () => void;
}

function readSettings(workspace: WorkspaceResult | null): WorkspaceSettings {
  if (!workspace?.setting || typeof workspace.setting !== "object" || Array.isArray(workspace.setting)) {
    return {};
  }

  return workspace.setting as WorkspaceSettings;
}

function toEditableSettings(workspace: WorkspaceResult | null) {
  const setting = readSettings(workspace);
  return {
    page_generation_concurrency: readPageGenerationConcurrency(setting),
    disable_web_research: setting.disable_web_research === true,
    disable_image_research: setting.disable_image_research === true,
    ...pageReviewSettingsToWorkspaceSettings(readPageReviewSettings(setting))
  };
}

function localizeTaskTitle(title: string, t: Messages) {
  const match = /^(?:新建工作区|新建任务|New Workspace|New Task)-(\d{4}-\d{2}-\d{2})$/.exec(title);
  if (!match) {
    return title;
  }

  return formatMessage(t.library.defaultWorkspaceTitle, { date: match[1] });
}

function getTaskTitle(workspace: WorkspaceResult | null, t: Messages) {
  if (
    workspace?.task &&
    typeof workspace.task === "object" &&
    !Array.isArray(workspace.task) &&
    typeof (workspace.task as { title?: unknown }).title === "string"
  ) {
    return localizeTaskTitle((workspace.task as { title: string }).title, t);
  }

  return workspace?.task_id ?? workspace?.workspace_id ?? t.library.noWorkspaceSelected;
}

function formatUpdatedAt(value: string, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function LibraryPage({
  t,
  locale,
  workspaceScan,
  currentWorkspace,
  loading,
  savingSettings,
  pageReviewSettings,
  onBack,
  onOpen,
  onCreateWorkspace,
  onSaveSettings,
  onSaveTitle,
  workspaceDiagnosticBundle,
  onPrepareWorkspaceDiagnosticBundle,
  onResetWorkspaceDiagnosticBundle
}: LibraryPageProps) {
  const [editing, setEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draft, setDraft] = useState(toEditableSettings(currentWorkspace));
  const [titleDraft, setTitleDraft] = useState(getTaskTitle(currentWorkspace, t));

  useEffect(() => {
    setDraft({
      ...toEditableSettings(currentWorkspace),
      ...pageReviewSettingsToWorkspaceSettings(pageReviewSettings)
    });
    setTitleDraft(getTaskTitle(currentWorkspace, t));
    setEditing(false);
    setEditingTitle(false);
  }, [currentWorkspace, pageReviewSettings, t]);

  async function saveSettings() {
    await onSaveSettings(draft);
    setEditing(false);
  }

  async function saveTitle() {
    const nextTitle = titleDraft.trim();
    if (!nextTitle) return;

    await onSaveTitle(nextTitle);
    setEditingTitle(false);
  }

  const tasks = workspaceScan?.tasks ?? workspaceScan?.workspaces ?? [];
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
    <section className="page active library-page">
      <PageHeader title={t.library.title} onBack={onBack} t={t} />

      <div className="workspace-row">
        <div>
          <span className="workspace-section-label">{t.library.currentWorkspace}</span>
          {editingTitle ? (
            <span className="workspace-title-editor">
              <input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void saveTitle();
                  if (event.key === "Escape") {
                    setTitleDraft(getTaskTitle(currentWorkspace, t));
                    setEditingTitle(false);
                  }
                }}
                autoFocus
              />
              <button className="primary-btn compact" onClick={saveTitle} disabled={savingSettings}>
                {t.controls.save}
              </button>
              <button
                className="secondary-btn compact"
                onClick={() => {
                  setTitleDraft(getTaskTitle(currentWorkspace, t));
                  setEditingTitle(false);
                }}
                disabled={savingSettings}
              >
                {t.controls.cancel}
              </button>
            </span>
          ) : (
            // <button
            //   className="workspace-title-button"
            //   onClick={() => setEditingTitle(true)}
            //   disabled={!currentWorkspace}
            //   title={t.controls.edit}
            // >
            //   {getTaskTitle(currentWorkspace, t)}
            // </button>
            <button
              className="workspace-title-button"
              onClick={() => setEditingTitle(true)}
              disabled={!currentWorkspace}
              title={t.controls.edit}
            >
              <span>{getTaskTitle(currentWorkspace, t)}</span>
              <Edit3 className="workspace-title-edit-icon" size={13} />
            </button>
          )}
          <span>
            {currentWorkspace?.task_dir ??
              currentWorkspace?.workspace_dir ??
              workspaceScan?.task_root ??
              workspaceScan?.workspace_root ??
              ""}
          </span>
        </div>
      </div>

      <div className="local-deck-list">
        {tasks.length === 0 ? (
          <div className="empty-library-row">{t.library.empty}</div>
        ) : (
          tasks.map((task) => (
            <WorkspaceRow
              key={task.task_dir ?? task.workspace_dir}
              workspace={task}
              loading={loading}
              onOpen={onOpen}
              t={t}
              locale={locale}
            />
          ))
        )}

        <button className="secondary-btn create-workspace-btn" onClick={onCreateWorkspace} disabled={loading}>
          <Plus size={14} />
          {t.library.createWorkspace}
        </button>
      </div>

      <div className="preferences-box">
        <div className="pref-header">
          <strong>{t.library.preferences}</strong>
          {editing ? (
            <div className="pref-actions">
              <button className="secondary-btn compact" onClick={() => setEditing(false)} disabled={savingSettings}>
                {t.controls.cancel}
              </button>
              <button className="primary-btn compact" onClick={saveSettings} disabled={savingSettings || !currentWorkspace}>
                {t.controls.save}
              </button>
            </div>
          ) : (
            <button
              className="secondary-btn compact"
              onClick={() => setEditing(true)}
              disabled={!currentWorkspace}
            >
              <Edit3 size={12} />
              {t.controls.edit}
            </button>
          )}
        </div>

        <PreferenceSwitch
          label={t.preferences.visualReviewEnabled}
          value={draft.visual_review_enabled === true}
          editing={editing}
          t={t}
          onChange={(value) => setDraft((next) => ({ ...next, visual_review_enabled: value }))}
        />
        <PreferenceNumber
          label={t.preferences.pageGenerationConcurrency}
          value={Number(draft.page_generation_concurrency)}
          editing={editing}
          min={PAGE_GENERATION_CONCURRENCY_MIN}
          max={PAGE_GENERATION_CONCURRENCY_MAX}
          onChange={(value) => setDraft((next) => ({ ...next, page_generation_concurrency: value }))}
        />
        <PreferenceNumber
          label={t.preferences.visualReviewFailureLimit}
          value={Number(draft.visual_review_failure_limit ?? DEFAULT_VISUAL_REVIEW_FAILURE_LIMIT)}
          editing={editing}
          min={REVIEW_FAILURE_LIMIT_MIN}
          max={REVIEW_FAILURE_LIMIT_MAX}
          onChange={(value) => setDraft((next) => ({ ...next, visual_review_failure_limit: value }))}
        />
      </div>

      <div className="diagnostic-bundle-box">
        <div className="diagnostic-bundle-header">
          <div>
            <strong>{t.library.diagnosticBundleTitle}</strong>
            <p>{t.library.diagnosticBundleDescription}</p>
          </div>
          {workspaceDiagnosticBundle.href ? (
            <button
              className="diagnostic-bundle-refresh-btn"
              type="button"
              aria-label={t.library.diagnosticBundleRefresh}
              title={t.library.diagnosticBundleRefresh}
              onClick={onResetWorkspaceDiagnosticBundle}
            >
              <RefreshCw size={20} />
            </button>
          ) : (
            <Archive size={20} />
          )}
        </div>
        <div className="diagnostic-bundle-warning">
          {t.library.diagnosticBundleSensitiveHint}
        </div>
        <div className="diagnostic-bundle-action">
          {currentWorkspace && diagnosticBundleAvailability.active && workspaceDiagnosticBundle.href ? (
            <CopyableDownloadLink
              href={workspaceDiagnosticBundle.href}
              inputLabel={t.library.diagnosticBundleLinkLabel}
              copyLabel={t.library.diagnosticBundleCopyLink}
              copiedMessage={t.library.diagnosticBundleLinkCopied}
              copyHint={t.library.diagnosticBundleCopyHint}
            />
          ) : (
            <button
              className="diagnostic-bundle-generate-btn"
              type="button"
              disabled={!currentWorkspace || loading || workspaceDiagnosticBundle.status === "preparing"}
              aria-busy={workspaceDiagnosticBundle.status === "preparing"}
              onClick={() => {
                void onPrepareWorkspaceDiagnosticBundle();
              }}
            >
              <Download size={15} />
              <span>{currentWorkspace ? diagnosticButtonLabel : t.library.diagnosticBundleNoWorkspace}</span>
            </button>
          )}
        </div>
        {diagnosticStatusMessage ? (
          <div className={`diagnostic-bundle-status ${workspaceDiagnosticBundle.status === "error" ? "error" : ""}`}>
            {diagnosticStatusMessage}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function WorkspaceRow(props: {
  workspace: WorkspaceSummary;
  loading: boolean;
  onOpen: (workspaceDir: string) => Promise<void>;
  t: Messages;
  locale: Locale;
}) {
  return (
    <article className="local-deck-row">
      <button onClick={() => props.onOpen(props.workspace.task_dir ?? props.workspace.workspace_dir)} disabled={props.loading}>
        <strong>
          {localizeTaskTitle(
            props.workspace.title || props.workspace.task_id || props.workspace.workspace_id,
            props.t,
          )}
        </strong>
        <span>{formatUpdatedAt(props.workspace.updated_at, props.locale)}</span>
      </button>
      <button
        className="primary-btn compact"
        onClick={() => props.onOpen(props.workspace.task_dir ?? props.workspace.workspace_dir)}
        disabled={props.loading}
      >
        {props.t.controls.open}
      </button>
    </article>
  );
}

function clampPreferenceNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function PreferenceSwitch(props: {
  label: string;
  value: boolean;
  editing: boolean;
  t: Messages;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="pref-row">
      <span>{props.label}</span>
      {props.editing ? (
        <input
          type="checkbox"
          checked={props.value}
          onChange={(event) => props.onChange(event.target.checked)}
        />
      ) : (
        <strong>{props.value ? props.t.preferences.enabled : props.t.preferences.disabled}</strong>
      )}
    </label>
  );
}

function PreferenceNumber(props: {
  label: string;
  value: number;
  editing: boolean;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const value = clampPreferenceNumber(props.value, props.min, props.max);

  return (
    <label className="pref-row">
      <span>{props.label}</span>
      {props.editing ? (
        <input
          type="number"
          min={props.min}
          max={props.max}
          step={1}
          value={value}
          onChange={(event) => props.onChange(clampPreferenceNumber(Number(event.target.value), props.min, props.max))}
        />
      ) : (
        <strong>{value}</strong>
      )}
    </label>
  );
}

function PreferenceSelect(props: {
  label: string;
  value: string;
  options: string[];
  editing: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="pref-row">
      <span>{props.label}</span>
      {props.editing ? (
        <select value={props.value} onChange={(event) => props.onChange(event.target.value)}>
          {props.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <strong>{props.value || "-"}</strong>
      )}
    </label>
  );
}
