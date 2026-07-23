import { MoreHorizontal, Plus, X } from "lucide-react";
import { useState } from "react";
import type { ListWorkspacesResult, WorkspaceSummary } from "../../../api/types";
import { formatMessage, type Locale, type Messages } from "../../../i18n/messages";

interface MyWorkPageProps {
  t: Messages;
  locale: Locale;
  workspaceScan: ListWorkspacesResult | null;
  workspaceCovers: Record<string, string | undefined>;
  loading: boolean;
  error: string;
  onRetry: () => Promise<void>;
  onOpen: (workspaceDir: string) => Promise<void>;
  onNew: () => Promise<void>;
  onRename: (workspaceDir: string, title: string) => Promise<void>;
  onDelete: (workspaceDir: string) => Promise<void>;
}

const DEFAULT_COVER = "/default-project-cover.svg";

function formatUpdatedAt(value: string, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function projectTitle(project: WorkspaceSummary, t: Messages) {
  const match = /^(?:新建工作区|新建任务|New Workspace|New Task)-\d{4}-\d{2}-\d{2}$/.exec(project.title);
  return match ? formatMessage(t.library.defaultWorkspaceTitle, { date: match[0].slice(-10) }) : project.title;
}

export function MyWorkPage({
  t,
  locale,
  workspaceScan,
  workspaceCovers,
  loading,
  error,
  onRetry,
  onOpen,
  onNew,
  onRename,
  onDelete,
}: MyWorkPageProps) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<WorkspaceSummary | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceSummary | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const projects = workspaceScan?.tasks ?? workspaceScan?.workspaces ?? [];
  const presentations = projects.filter((project) => project.has_deck_html);
  const inProgress = projects.filter((project) => !project.has_deck_html);

  async function submitRename() {
    if (!renameTarget || !renameDraft.trim()) return;
    setActionLoading(true);
    try {
      await onRename(renameTarget.task_dir ?? renameTarget.workspace_dir, renameDraft.trim());
      setRenameTarget(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await onDelete(deleteTarget.task_dir ?? deleteTarget.workspace_dir);
      setDeleteTarget(null);
    } finally {
      setActionLoading(false);
    }
  }

  function renderProject(project: WorkspaceSummary, completed: boolean) {
    const dir = project.task_dir ?? project.workspace_dir;
    return (
      <article className="my-work-card" key={project.workspace_id}>
        <button className="my-work-card-main" type="button" onClick={() => void onOpen(dir)} disabled={loading || actionLoading}>
          <img src={completed ? (workspaceCovers[project.workspace_id] ?? DEFAULT_COVER) : DEFAULT_COVER} alt="" />
          <span className="my-work-card-copy">
            <strong>{projectTitle(project, t)}</strong>
            <small>{formatUpdatedAt(project.updated_at, locale)}</small>
          </span>
        </button>
        <button
          type="button"
          className="my-work-card-menu-trigger"
          aria-label={t.myWork.menu}
          onClick={(event) => {
            event.stopPropagation();
            setMenuId((current) => current === project.workspace_id ? null : project.workspace_id);
          }}
          disabled={loading || actionLoading}
        >
          <MoreHorizontal size={17} />
        </button>
        {menuId === project.workspace_id ? (
          <div className="my-work-card-menu" role="menu">
            <button type="button" onClick={() => { setMenuId(null); setRenameDraft(project.title); setRenameTarget(project); }}>
              {t.myWork.rename}
            </button>
            <button type="button" onClick={() => { setMenuId(null); setDeleteTarget(project); }}>
              {t.myWork.delete}
            </button>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <section className="page active my-work-page">
      <header className="my-work-header">
        <div>
          <p className="eyebrow">{t.myWork.home}</p>
          <h1>{t.myWork.title}</h1>
        </div>
      </header>

      {loading ? (
        <div className="my-work-loading" aria-live="polite">
          <div className="my-work-section-skeleton">
            <span />
            <div className="my-work-skeleton-grid"><i /><i /><i /></div>
          </div>
          <div className="my-work-section-skeleton">
            <span />
            <div className="my-work-skeleton-grid"><i /><i /></div>
          </div>
        </div>
      ) : error ? (
        <div className="my-work-error">
          <p>{error || t.myWork.loadFailed}</p>
          <button type="button" className="secondary-btn" onClick={() => void onRetry()}>{t.myWork.retry}</button>
        </div>
      ) : (
        <>
          <section className="my-work-section">
            <div className="my-work-section-heading"><h2>{t.myWork.presentations}</h2></div>
            <div className="my-work-grid">
              <button type="button" className="my-work-new-card" onClick={() => void onNew()}>
                <Plus size={22} />
                <strong>{t.myWork.newPresentation}</strong>
              </button>
              {presentations.map((project) => renderProject(project, true))}
            </div>
            {presentations.length === 0 ? <p className="my-work-empty">{t.myWork.emptyPresentations}</p> : null}
          </section>
          <section className="my-work-section my-work-in-progress-section">
            <div className="my-work-section-heading"><h2>{t.myWork.inProgress}</h2></div>
            <div className="my-work-grid">{inProgress.map((project) => renderProject(project, false))}</div>
            {inProgress.length === 0 ? <p className="my-work-empty">{t.myWork.emptyInProgress}</p> : null}
          </section>
        </>
      )}

      {renameTarget ? (
        <div className="my-work-modal-backdrop" role="dialog" aria-modal="true">
          <section className="my-work-modal">
            <button type="button" className="my-work-modal-close" onClick={() => setRenameTarget(null)} aria-label={t.controls.close}><X size={16} /></button>
            <h2>{t.myWork.renameTitle}</h2>
            <input autoFocus value={renameDraft} placeholder={t.myWork.renamePlaceholder} onChange={(event) => setRenameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitRename(); if (event.key === "Escape") setRenameTarget(null); }} />
            <div className="my-work-modal-actions"><button type="button" className="secondary-btn" onClick={() => setRenameTarget(null)} disabled={actionLoading}>{t.controls.cancel}</button><button type="button" className="primary-btn" onClick={() => void submitRename()} disabled={!renameDraft.trim() || actionLoading}>{t.controls.save}</button></div>
          </section>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="my-work-modal-backdrop" role="dialog" aria-modal="true">
          <section className="my-work-modal">
            <button type="button" className="my-work-modal-close" onClick={() => setDeleteTarget(null)} aria-label={t.controls.close}><X size={16} /></button>
            <h2>{t.myWork.deleteTitle}</h2>
            <p>{formatMessage(t.myWork.deleteBody, { title: projectTitle(deleteTarget, t) })}</p>
            <div className="my-work-modal-actions"><button type="button" className="secondary-btn" onClick={() => setDeleteTarget(null)} disabled={actionLoading}>{t.controls.cancel}</button><button type="button" className="danger-btn" onClick={() => void confirmDelete()} disabled={actionLoading}>{t.myWork.deleteConfirm}</button></div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
