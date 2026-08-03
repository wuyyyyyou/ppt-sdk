import { Archive, Cpu, Download, Edit3, MemoryStick, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import appManifest from "../../../../app.json";
import type { PptAgentResourceInfo, PptEngineRuntimeInfo, WorkspaceResult, WorkspaceSettings } from "../../../api/types";
import type { Messages } from "../../../i18n/messages";
import {
  PAGE_GENERATION_CONCURRENCY_MAX,
  PAGE_GENERATION_CONCURRENCY_MIN,
  readPageGenerationConcurrency,
} from "../generationConcurrency";
import {
  RESEARCH_IMAGE_SESSION_CONCURRENCY_MAX,
  RESEARCH_IMAGE_SESSION_CONCURRENCY_MIN,
  readResearchImageSessionConcurrency,
} from "../researchImageSessionConcurrency";
import { readResearchSearchControlSettings } from "../researchSearchControl";
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
import { PerformanceTestingPanel } from "../../performance/PerformanceTestingPanel";
import type { AgentResourceInfoState, PerformanceTestingState } from "../types";
import type { PerformanceRunSummary } from "../../../api/types";

interface LibraryPageProps {
  t: Messages;
  locale: "en" | "zh";
  settings: WorkspaceSettings;
  currentWorkspace: WorkspaceResult | null;
  loading: boolean;
  savingSettings: boolean;
  pageReviewSettings: PageReviewSettings;
  runtimeInfo: PptEngineRuntimeInfo | null;
  runtimeInfoError: string;
  agentResourceInfo: AgentResourceInfoState;
  onBack: () => void;
  onSaveSettings: (setting: WorkspaceSettings) => Promise<void>;
  onSaveTitle: (title: string) => Promise<void>;
  workspaceDiagnosticBundle: WorkspaceDiagnosticBundleState;
  onDownloadWorkspaceDiagnosticBundle: () => Promise<void>;
  onResetWorkspaceDiagnosticBundle: () => void;
  performanceTesting: PerformanceTestingState;
  onRefreshPerformanceRuns: () => Promise<void>;
  onRefreshAgentResourceInfo: () => Promise<void>;
  onStartPerformanceRun: () => Promise<void>;
  onFinalizePerformanceRun: () => Promise<void>;
  onAbandonPerformanceRun: () => Promise<void>;
  onViewPerformanceReport: (run: PerformanceRunSummary) => Promise<void>;
  onRegeneratePerformanceReport: (run: PerformanceRunSummary) => Promise<void>;
  onDeletePerformanceRun: (run: PerformanceRunSummary) => Promise<void>;
}

function toEditableSettings(settings: WorkspaceSettings, pageReviewSettings: PageReviewSettings) {
  const researchSearchControls = readResearchSearchControlSettings(settings);
  return {
    ...settings,
    ...pageReviewSettingsToWorkspaceSettings(pageReviewSettings),
    page_generation_concurrency: readPageGenerationConcurrency(settings),
    research_image_session_concurrency: readResearchImageSessionConcurrency(settings),
    visual_review_enabled: pageReviewSettings.visualReviewEnabled,
    visual_review_failure_limit: pageReviewSettings.visualReviewFailureLimit,
    disable_web_research: researchSearchControls.disableWebResearch,
    disable_image_research: researchSearchControls.disableImageResearch,
  };
}

export function LibraryPage({
  t,
  locale,
  settings,
  currentWorkspace,
  loading,
  savingSettings,
  pageReviewSettings,
  runtimeInfo,
  runtimeInfoError,
  agentResourceInfo,
  onBack,
  onSaveSettings,
  onSaveTitle,
  workspaceDiagnosticBundle,
  onDownloadWorkspaceDiagnosticBundle,
  onResetWorkspaceDiagnosticBundle,
  performanceTesting,
  onRefreshPerformanceRuns,
  onRefreshAgentResourceInfo,
  onStartPerformanceRun,
  onFinalizePerformanceRun,
  onAbandonPerformanceRun,
  onViewPerformanceReport,
  onRegeneratePerformanceReport,
  onDeletePerformanceRun,
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
      : t.library.diagnosticBundleDownload;
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
                <button data-performance-id="settings.workspace-title.save" className="primary-btn compact" onClick={() => void saveTitle()} disabled={savingSettings}>{t.controls.save}</button>
                <button data-performance-id="settings.workspace-title.cancel" className="secondary-btn compact" onClick={() => setEditingTitle(false)} disabled={savingSettings}>{t.controls.cancel}</button>
              </span>
            ) : (
              <button data-performance-id="settings.workspace-title.edit" className="workspace-title-button" onClick={() => setEditingTitle(true)} disabled={savingSettings} title={t.controls.edit}>
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
            <div className="pref-actions"><button data-performance-id="settings.preferences.cancel" className="secondary-btn compact" onClick={() => setEditing(false)} disabled={savingSettings}>{t.controls.cancel}</button><button data-performance-id="settings.preferences.save" className="primary-btn compact" onClick={() => void saveSettings()} disabled={savingSettings}>{t.controls.save}</button></div>
          ) : <button data-performance-id="settings.preferences.edit" className="secondary-btn compact" onClick={() => setEditing(true)} disabled={savingSettings}><Edit3 size={12} />{t.controls.edit}</button>}
        </div>
        <PreferenceSwitch label={t.preferences.visualReviewEnabled} value={draft.visual_review_enabled === true} editing={editing} t={t} onChange={(value) => setDraft((next) => ({ ...next, visual_review_enabled: value }))} />
        <PreferenceSwitch label={t.preferences.disableWebResearch} value={draft.disable_web_research === true} editing={editing} t={t} onChange={(value) => setDraft((next) => ({ ...next, disable_web_research: value }))} />
        <PreferenceSwitch label={t.preferences.disableImageResearch} value={draft.disable_image_research === true} editing={editing} t={t} onChange={(value) => setDraft((next) => ({ ...next, disable_image_research: value }))} />
        <PreferenceNumber label={t.preferences.pageGenerationConcurrency} value={Number(draft.page_generation_concurrency)} editing={editing} min={PAGE_GENERATION_CONCURRENCY_MIN} max={PAGE_GENERATION_CONCURRENCY_MAX} onChange={(value) => setDraft((next) => ({ ...next, page_generation_concurrency: value }))} />
        <PreferenceNumber label={t.preferences.researchImageSessionConcurrency} value={Number(draft.research_image_session_concurrency)} editing={editing} min={RESEARCH_IMAGE_SESSION_CONCURRENCY_MIN} max={RESEARCH_IMAGE_SESSION_CONCURRENCY_MAX} onChange={(value) => setDraft((next) => ({ ...next, research_image_session_concurrency: value }))} />
        <PreferenceNumber label={t.preferences.visualReviewFailureLimit} value={Number(draft.visual_review_failure_limit ?? DEFAULT_VISUAL_REVIEW_FAILURE_LIMIT)} editing={editing} min={REVIEW_FAILURE_LIMIT_MIN} max={REVIEW_FAILURE_LIMIT_MAX} onChange={(value) => setDraft((next) => ({ ...next, visual_review_failure_limit: value }))} />
      </div>

      <div className="runtime-info-box">
        <div className="runtime-info-header"><strong>{t.library.runtimeInfoTitle}</strong></div>
        <div className="pref-row"><span>{t.library.annaDeckVersion}</span><strong>{appManifest.version}</strong></div>
        <div className="pref-row"><span>{t.library.pptEngineVersion}</span><strong>{runtimeInfo?.ppt_engine_version ?? "—"}</strong></div>
        {runtimeInfoError ? <div className="runtime-info-error" title={runtimeInfoError}>{t.library.runtimeInfoUnavailable}</div> : null}
      </div>

      <AgentResourceInfoPanel
        t={t}
        locale={locale}
        state={agentResourceInfo}
        onRefresh={onRefreshAgentResourceInfo}
      />

      <PerformanceTestingPanel
        t={t}
        locale={locale}
        state={performanceTesting}
        onRefresh={onRefreshPerformanceRuns}
        onStart={onStartPerformanceRun}
        onFinish={onFinalizePerformanceRun}
        onAbandon={onAbandonPerformanceRun}
        onViewReport={onViewPerformanceReport}
        onRegenerateReport={onRegeneratePerformanceReport}
        onDelete={onDeletePerformanceRun}
      />

      {currentWorkspace ? (
        <div className="diagnostic-bundle-box">
          <div className="diagnostic-bundle-header"><div><strong>{t.library.diagnosticBundleTitle}</strong><p>{t.library.diagnosticBundleDescription}</p></div>{workspaceDiagnosticBundle.href ? <button data-performance-id="settings.diagnostic-bundle.reset" className="diagnostic-bundle-refresh-btn" type="button" aria-label={t.library.diagnosticBundleRefresh} title={t.library.diagnosticBundleRefresh} onClick={onResetWorkspaceDiagnosticBundle}><RefreshCw size={20} /></button> : <Archive size={20} />}</div>
          <div className="diagnostic-bundle-warning">{t.library.diagnosticBundleSensitiveHint}</div>
          <div className="diagnostic-bundle-action">
            <button data-performance-id="settings.diagnostic-bundle.download" className="diagnostic-bundle-generate-btn" type="button" disabled={loading || workspaceDiagnosticBundle.status === "preparing"} aria-busy={workspaceDiagnosticBundle.status === "preparing"} onClick={() => void onDownloadWorkspaceDiagnosticBundle()}><Download size={15} /><span>{diagnosticButtonLabel}</span></button>
            {/* ADR-0025: the host iframe may still refuse to start the transfer,
                so the signed URL stays reachable as a manual fallback. */}
            {diagnosticBundleAvailability.active && workspaceDiagnosticBundle.href ? <CopyableDownloadLink href={workspaceDiagnosticBundle.href} inputLabel={t.library.diagnosticBundleLinkLabel} copyLabel={t.library.diagnosticBundleCopyLink} copiedMessage={t.library.diagnosticBundleLinkCopied} copyHint={t.library.diagnosticBundleDownloadFallbackHint} /> : null}
          </div>
          {diagnosticStatusMessage ? <div className={`diagnostic-bundle-status ${workspaceDiagnosticBundle.status === "error" ? "error" : ""}`}>{diagnosticStatusMessage}</div> : null}
        </div>
      ) : null}
    </section>
  );
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount >= 10 || unit === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unit]}`;
}

function formatPercent(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`;
}

function formatCores(value: number, locale: "en" | "zh"): string {
  const amount = Number.isInteger(value) ? value : value.toFixed(2);
  return locale === "zh" ? `${amount} 核` : `${amount} core${value === 1 ? "" : "s"}`;
}

function formatSampleTime(value: string, locale: "en" | "zh"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function limitSourceLabel(source: PptAgentResourceInfo["cpu"]["limit_source"], t: Messages): string {
  if (source === "cgroup") return t.library.agentResourceInfoCgroupLimit;
  if (source === "system") return t.library.agentResourceInfoSystemVisible;
  return t.library.agentResourceInfoUnknown;
}

function AgentResourceInfoPanel({
  t,
  locale,
  state,
  onRefresh,
}: {
  t: Messages;
  locale: "en" | "zh";
  state: AgentResourceInfoState;
  onRefresh: () => Promise<void>;
}) {
  if (!state.enabled) return null;
  const info = state.info;
  const refreshLabel = state.loading ? t.library.agentResourceInfoRefreshing : t.library.agentResourceInfoRefresh;
  return (
    <div className="agent-resource-info-box" data-performance-control="true">
      <div className="agent-resource-info-header">
        <div>
          <strong>{t.library.agentResourceInfoTitle}</strong>
          <p>{t.library.agentResourceInfoDescription}</p>
        </div>
        <button
          data-performance-id="settings.agent-resource-info.refresh"
          className="secondary-btn compact agent-resource-info-refresh"
          type="button"
          onClick={() => void onRefresh()}
          disabled={state.loading}
          aria-label={refreshLabel}
          title={refreshLabel}
        >
          <RefreshCw size={14} className={state.loading ? "spin" : undefined} />
          <span>{state.loading ? t.library.agentResourceInfoRefreshing : t.library.agentResourceInfoRefresh}</span>
        </button>
      </div>
      {state.error ? <div className="runtime-info-error" title={state.error}>{t.library.agentResourceInfoUnavailable}</div> : null}
      {info ? (
        <>
          <div className="agent-resource-info-section-title"><Cpu size={14} />{t.library.agentResourceInfoSystem}</div>
          <div className="agent-resource-info-grid">
            <ResourceMetric label={t.library.agentResourceInfoConfiguredCores} value={`${formatCores(info.cpu.configured_cores, locale)} · ${limitSourceLabel(info.cpu.limit_source, t)}`} />
            <ResourceMetric label={t.library.agentResourceInfoVisibleCores} value={formatCores(info.cpu.visible_cores, locale)} />
            <ResourceMetric label={t.library.agentResourceInfoCpuUsage} value={formatPercent(info.cpu.system_usage_percent)} />
            <ResourceMetric label={t.library.agentResourceInfoMemoryUsage} value={`${formatPercent(info.memory.usage_percent)} · ${formatBytes(info.memory.used_bytes)} / ${formatBytes(info.memory.total_bytes)} · ${limitSourceLabel(info.memory.limit_source, t)}`} />
          </div>
          <div className="agent-resource-info-section-title"><MemoryStick size={14} />{t.library.agentResourceInfoProcess}</div>
          <div className="agent-resource-info-grid">
            <ResourceMetric label={t.library.agentResourceInfoProcessCpuUsage} value={formatPercent(info.process.cpu_usage_percent)} />
            <ResourceMetric label={t.library.agentResourceInfoProcessMemory} value={formatBytes(info.process.rss_bytes)} />
            <ResourceMetric label={t.library.agentResourceInfoPlatform} value={`${info.environment.platform} / ${info.environment.arch}`} />
            <ResourceMetric label={t.library.agentResourceInfoNode} value={info.environment.node_version} />
            {info.cpu.load_average ? <ResourceMetric label={t.library.agentResourceInfoLoadAverage} value={info.cpu.load_average.join(" / ")} /> : null}
            <ResourceMetric label={t.library.agentResourceInfoSampledAt} value={formatSampleTime(info.sampled_at, locale)} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function ResourceMetric({ label, value }: { label: string; value: string }) {
  return <div className="agent-resource-info-metric"><span>{label}</span><strong>{value}</strong></div>;
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
