import { Edit3, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  ListWorkspacesResult,
  WorkspaceResult,
  WorkspaceSettings,
  WorkspaceSummary
} from "../../../api/types";
import { type Messages } from "../../../i18n/messages";
import { PageHeader } from "./PageHeader";

interface LibraryPageProps {
  t: Messages;
  workspaceScan: ListWorkspacesResult | null;
  currentWorkspace: WorkspaceResult | null;
  loading: boolean;
  savingSettings: boolean;
  onBack: () => void;
  onOpen: (workspaceDir: string) => Promise<void>;
  onCreateWorkspace: () => Promise<void>;
  onSaveSettings: (setting: WorkspaceSettings) => Promise<void>;
  onSaveTitle: (title: string) => Promise<void>;
}

const EMPTY_SETTINGS: Required<
  Pick<
    WorkspaceSettings,
    | "audience"
    | "goal"
    | "style_notes"
    | "slide_count"
    | "text_density"
    | "output_language"
    | "aspect_ratio"
    | "visual_tone"
    | "typography"
  >
> = {
  audience: "",
  goal: "",
  style_notes: "",
  slide_count: "auto",
  text_density: "balanced",
  output_language: "中文",
  aspect_ratio: "16:9",
  visual_tone: "",
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
    audience: normalizeSettingValue(setting.audience, EMPTY_SETTINGS.audience),
    goal: normalizeSettingValue(setting.goal, EMPTY_SETTINGS.goal),
    style_notes: normalizeSettingValue(setting.style_notes, EMPTY_SETTINGS.style_notes),
    slide_count: normalizeSettingValue(setting.slide_count, EMPTY_SETTINGS.slide_count),
    text_density: normalizeSettingValue(setting.text_density, EMPTY_SETTINGS.text_density),
    output_language: normalizeSettingValue(setting.output_language, EMPTY_SETTINGS.output_language),
    aspect_ratio: normalizeSettingValue(setting.aspect_ratio, EMPTY_SETTINGS.aspect_ratio),
    visual_tone:
      setting.visual_tone === "极简 SaaS · 清爽版式 · 柔和中性色" ||
      setting.visual_tone === "professional"
        ? EMPTY_SETTINGS.visual_tone
        : normalizeSettingValue(setting.visual_tone, EMPTY_SETTINGS.visual_tone),
    typography:
      setting.typography === "Clean Sans"
        ? EMPTY_SETTINGS.typography
        : normalizeSettingValue(setting.typography, EMPTY_SETTINGS.typography)
  };
}

function getWorkspaceTitle(workspace: WorkspaceResult | null) {
  if (
    workspace?.task &&
    typeof workspace.task === "object" &&
    !Array.isArray(workspace.task) &&
    typeof (workspace.task as { title?: unknown }).title === "string"
  ) {
    return (workspace.task as { title: string }).title;
  }

  return workspace?.workspace_id ?? "未选择工作区";
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function LibraryPage({
  t,
  workspaceScan,
  currentWorkspace,
  loading,
  savingSettings,
  onBack,
  onOpen,
  onCreateWorkspace,
  onSaveSettings,
  onSaveTitle
}: LibraryPageProps) {
  const [editing, setEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draft, setDraft] = useState(toEditableSettings(currentWorkspace));
  const [titleDraft, setTitleDraft] = useState(getWorkspaceTitle(currentWorkspace));

  useEffect(() => {
    setDraft(toEditableSettings(currentWorkspace));
    setTitleDraft(getWorkspaceTitle(currentWorkspace));
    setEditing(false);
    setEditingTitle(false);
  }, [currentWorkspace]);

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

  const workspaces = workspaceScan?.workspaces ?? [];

  return (
    <section className="page active library-page">
      <PageHeader title={t.library.title} onBack={onBack} t={t} />

      <div className="workspace-row">
        <div>
          <span className="workspace-section-label">当前工作区</span>
          {editingTitle ? (
            <span className="workspace-title-editor">
              <input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void saveTitle();
                  if (event.key === "Escape") {
                    setTitleDraft(getWorkspaceTitle(currentWorkspace));
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
                  setTitleDraft(getWorkspaceTitle(currentWorkspace));
                  setEditingTitle(false);
                }}
                disabled={savingSettings}
              >
                {t.controls.cancel}
              </button>
            </span>
          ) : (
            <button
              className="workspace-title-button"
              onClick={() => setEditingTitle(true)}
              disabled={!currentWorkspace}
              title={t.controls.edit}
            >
              {getWorkspaceTitle(currentWorkspace)}
            </button>
          )}
          <span>{currentWorkspace?.workspace_dir ?? workspaceScan?.workspace_root ?? ""}</span>
        </div>
      </div>

      <div className="local-deck-list">
        {workspaces.length === 0 ? (
          <div className="empty-library-row">暂无工作区</div>
        ) : (
          workspaces.map((workspace) => (
            <WorkspaceRow
              key={workspace.workspace_dir}
              workspace={workspace}
              loading={loading}
              onOpen={onOpen}
              t={t}
            />
          ))
        )}

        <button className="secondary-btn create-workspace-btn" onClick={onCreateWorkspace} disabled={loading}>
          <Plus size={14} />
          新建工作区
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

        <PreferenceField
          label={t.brief.contextLabels.audience}
          value={draft.audience}
          editing={editing}
          onChange={(value) => setDraft((next) => ({ ...next, audience: value }))}
        />
        <PreferenceField
          label={t.brief.contextLabels.goal}
          value={draft.goal}
          editing={editing}
          onChange={(value) => setDraft((next) => ({ ...next, goal: value }))}
        />
        <PreferenceField
          label={t.brief.contextLabels.styleNotes}
          value={draft.style_notes}
          editing={editing}
          onChange={(value) => setDraft((next) => ({ ...next, style_notes: value }))}
        />
        <PreferenceField
          label={t.brief.contextLabels.slides}
          value={draft.slide_count}
          editing={editing}
          onChange={(value) => setDraft((next) => ({ ...next, slide_count: value }))}
        />
        <PreferenceSelect
          label={t.brief.contextLabels.textPerSlide}
          value={draft.text_density}
          options={["light", "balanced", "detailed"]}
          editing={editing}
          onChange={(value) => setDraft((next) => ({ ...next, text_density: value }))}
        />
        <PreferenceField
          label={t.brief.contextLabels.outputLanguage}
          value={draft.output_language}
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
          label="视觉方向"
          value={draft.visual_tone}
          editing={editing}
          onChange={(value) => setDraft((next) => ({ ...next, visual_tone: value }))}
        />
        <PreferenceField
          label={t.preferences.typography}
          value={draft.typography}
          editing={editing}
          onChange={(value) => setDraft((next) => ({ ...next, typography: value }))}
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
}) {
  return (
    <article className="local-deck-row">
      <button onClick={() => props.onOpen(props.workspace.workspace_dir)} disabled={props.loading}>
        <strong>{props.workspace.title || props.workspace.workspace_id}</strong>
        <span>{formatUpdatedAt(props.workspace.updated_at)}</span>
      </button>
      <button
        className="primary-btn compact"
        onClick={() => props.onOpen(props.workspace.workspace_dir)}
        disabled={props.loading}
      >
        {props.t.controls.open}
      </button>
    </article>
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
