import { FolderOpen, Plus, RefreshCw } from "lucide-react";
import type {
  ListWorkspacesResult,
  WorkspaceResult
} from "../../../api/types";
import type { Locale } from "../../../i18n/messages";

interface WorkspaceDialogProps {
  locale: Locale;
  scan: ListWorkspacesResult | null;
  workspace: WorkspaceResult | null;
  loading: boolean;
  error: string;
  onUseLatest: () => void;
  onCreate: () => void;
  onRescan: () => void;
}

function formatWorkspaceName(value: string) {
  return value.replace(/^ppt-/, "PPT ");
}

const copy = {
  en: {
    title: "Choose workspace",
    rootPrefix: "Default workspace root",
    loading: "Checking local workspaces...",
    found: "Last workspace found",
    missing: "No existing workspace found",
    createRequired: "Create a new PPT workspace",
    createHint:
      "Anna will initialize task.json, setting.json, outline.json, and pages.json.",
    rescan: "Rescan",
    useLatest: "Use latest",
    create: "New workspace"
  },
  zh: {
    title: "选择 PPT 工作区",
    rootPrefix: "默认工作目录为",
    loading: "正在检查本地工作区...",
    found: "找到上次的工作区",
    missing: "没有找到已有工作区",
    createRequired: "需要新建一个 PPT 工作区",
    createHint: "会自动创建 task.json、setting.json、outline.json、pages.json。",
    rescan: "重新扫描",
    useLatest: "使用上次工作区",
    create: "新建工作区"
  }
} satisfies Record<Locale, Record<string, string>>;

export function WorkspaceDialog({
  locale,
  scan,
  workspace,
  loading,
  error,
  onUseLatest,
  onCreate,
  onRescan
}: WorkspaceDialogProps) {
  if (workspace) {
    return null;
  }

  const latest = scan?.latest_workspace ?? null;
  const text = copy[locale];

  return (
    <div className="workspace-overlay" role="dialog" aria-modal="true">
      <section className="workspace-dialog">
        <div className="workspace-dialog-icon">
          <FolderOpen size={22} />
        </div>
        <div className="workspace-dialog-copy">
          <h2>{text.title}</h2>
          <p>
            {text.rootPrefix}
            <strong>{scan?.workspace_root ?? "~/anna-workspace/ppt/tasks"}</strong>
          </p>
        </div>

        <div className="workspace-dialog-body">
          {loading ? (
            <div className="workspace-state">{text.loading}</div>
          ) : latest ? (
            <div className="workspace-card">
              <span>{text.found}</span>
              <strong>{latest.title || formatWorkspaceName(latest.workspace_id)}</strong>
              <small>{latest.workspace_dir}</small>
            </div>
          ) : (
            <div className="workspace-card muted">
              <span>{text.missing}</span>
              <strong>{text.createRequired}</strong>
              <small>{text.createHint}</small>
            </div>
          )}

          {error ? <div className="workspace-error">{error}</div> : null}
        </div>

        <div className="workspace-actions">
          <button className="workspace-secondary-btn" onClick={onRescan} disabled={loading}>
            <RefreshCw size={16} />
            {text.rescan}
          </button>
          {latest ? (
            <button className="workspace-primary-btn" onClick={onUseLatest} disabled={loading}>
              <FolderOpen size={16} />
              {text.useLatest}
            </button>
          ) : null}
          <button className="workspace-primary-btn" onClick={onCreate} disabled={loading}>
            <Plus size={16} />
            {text.create}
          </button>
        </div>
      </section>
    </div>
  );
}
