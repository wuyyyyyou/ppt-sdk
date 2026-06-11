import { Edit3, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  ListWorkspacesResult,
  WorkspaceResult,
  WorkspaceSettings,
  WorkspaceSummary
} from "../../../api/types";
import { formatMessage, type Locale, type Messages } from "../../../i18n/messages";
import {
  AUTO_OUTPUT_LANGUAGE,
  DEFAULT_OUTPUT_LANGUAGE_OPTIONS,
} from "../../../ai/outputLanguage";
import {
  pageReviewSettingsToWorkspaceSettings,
  readPageReviewSettings,
  REVIEW_FAILURE_LIMIT_MAX,
  REVIEW_FAILURE_LIMIT_MIN,
  type PageReviewSettings,
} from "../reviewSettings";
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
}

const EMPTY_SETTINGS: Required<
  Pick<
    WorkspaceSettings,
    | "text_density"
    | "output_language"
    | "aspect_ratio"
    | "typography"
  >
> = {
  text_density: "balanced",
  output_language: AUTO_OUTPUT_LANGUAGE,
  aspect_ratio: "16:9",
  typography: ""
};

function readSettings(workspace: WorkspaceResult | null): WorkspaceSettings {
  if (!workspace?.setting || typeof workspace.setting !== "object" || Array.isArray(workspace.setting)) {
    return {};
  }

  return workspace.setting as WorkspaceSettings;
}

function normalizeSettingValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function toEditableSettings(workspace: WorkspaceResult | null) {
  const setting = readSettings(workspace);
  return {
    text_density: normalizeSettingValue(setting.text_density, EMPTY_SETTINGS.text_density),
    output_language: normalizeSettingValue(setting.output_language, EMPTY_SETTINGS.output_language),
    aspect_ratio: normalizeSettingValue(setting.aspect_ratio, EMPTY_SETTINGS.aspect_ratio),
    typography:
      setting.typography === "Clean Sans"
        ? EMPTY_SETTINGS.typography
        : normalizeSettingValue(setting.typography, EMPTY_SETTINGS.typography),
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
  onSaveTitle
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

        <PreferenceSelect
          label={t.brief.contextLabels.textPerSlide}
          value={draft.text_density}
          options={["light", "balanced", "detailed"]}
          editing={editing}
          onChange={(value) => setDraft((next) => ({ ...next, text_density: value }))}
        />
        <PreferenceSelect
          label={t.brief.contextLabels.outputLanguage}
          value={draft.output_language}
          options={
            DEFAULT_OUTPUT_LANGUAGE_OPTIONS.includes(
              draft.output_language as (typeof DEFAULT_OUTPUT_LANGUAGE_OPTIONS)[number]
            )
              ? [...DEFAULT_OUTPUT_LANGUAGE_OPTIONS]
              : [...DEFAULT_OUTPUT_LANGUAGE_OPTIONS, draft.output_language]
          }
          editing={editing}
          onChange={(value) => setDraft((next) => ({ ...next, output_language: value }))}
        />
        <PreferenceSelect
          label={t.preferences.aspectRatio}
          value={draft.aspect_ratio}
          options={["16:9", "4:3"]}
          editing={editing}
          onChange={(value) => setDraft((next) => ({ ...next, aspect_ratio: value }))}
        />
        <PreferenceField
          label={t.preferences.typography}
          value={draft.typography}
          editing={editing}
          onChange={(value) => setDraft((next) => ({ ...next, typography: value }))}
        />
        <PreferenceSwitch
          label={t.preferences.contentReviewEnabled}
          value={draft.content_review_enabled !== false}
          editing={editing}
          t={t}
          onChange={(value) => setDraft((next) => ({ ...next, content_review_enabled: value }))}
        />
        <PreferenceNumber
          label={t.preferences.contentReviewFailureLimit}
          value={Number(draft.content_review_failure_limit ?? 5)}
          editing={editing}
          onChange={(value) => setDraft((next) => ({ ...next, content_review_failure_limit: value }))}
        />
        <PreferenceSwitch
          label={t.preferences.visualReviewEnabled}
          value={draft.visual_review_enabled !== false}
          editing={editing}
          t={t}
          onChange={(value) => setDraft((next) => ({ ...next, visual_review_enabled: value }))}
        />
        <PreferenceNumber
          label={t.preferences.visualReviewFailureLimit}
          value={Number(draft.visual_review_failure_limit ?? 5)}
          editing={editing}
          onChange={(value) => setDraft((next) => ({ ...next, visual_review_failure_limit: value }))}
        />
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

function clampReviewFailureLimit(value: number) {
  if (!Number.isFinite(value)) return 5;
  return Math.max(REVIEW_FAILURE_LIMIT_MIN, Math.min(REVIEW_FAILURE_LIMIT_MAX, Math.floor(value)));
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
  onChange: (value: number) => void;
}) {
  const value = clampReviewFailureLimit(props.value);

  return (
    <label className="pref-row">
      <span>{props.label}</span>
      {props.editing ? (
        <input
          type="number"
          min={REVIEW_FAILURE_LIMIT_MIN}
          max={REVIEW_FAILURE_LIMIT_MAX}
          step={1}
          value={value}
          onChange={(event) => props.onChange(clampReviewFailureLimit(Number(event.target.value)))}
        />
      ) : (
        <strong>{value}</strong>
      )}
    </label>
  );
}

function PreferenceField(props: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="pref-row">
      <span>{props.label}</span>
      {props.editing ? (
        <input value={props.value} onChange={(event) => props.onChange(event.target.value)} />
      ) : (
        <strong>{props.value || "-"}</strong>
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
