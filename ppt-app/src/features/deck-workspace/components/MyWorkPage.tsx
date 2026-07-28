import { Copy, Loader2, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import type { ListWorkspacesResult, WorkspaceSummary } from "../../../api/types";
import { formatMessage, type Locale, type Messages } from "../../../i18n/messages";
import { buildMyWorkMenuItems, type MyWorkMenuItemId } from "../myWorkMenu";
import type { WorkspaceCovers } from "../workspaceCovers";
import { ErrorNotice } from "./ErrorNotice";

const MENU_ICONS: Record<MyWorkMenuItemId, typeof Pencil> = {
  rename: Pencil,
  duplicate: Copy,
  delete: Trash2,
};

interface MyWorkPageProps {
  t: Messages;
  locale: Locale;
  workspaceScan: ListWorkspacesResult | null;
  workspaceCovers: WorkspaceCovers;
  openingWorkspaceDir: string | null;
  /** WORK-005: the copy just created, so the user can find it in the list. */
  highlightedWorkspaceId?: string | null;
  loading: boolean;
  error: string;
  errorDetail?: string;
  onRetry: () => Promise<void>;
  onOpen: (workspaceDir: string) => Promise<void>;
  onNew: () => Promise<void>;
  onRename: (workspaceDir: string, title: string) => Promise<void>;
  /** Confirmation is owned by the workspace-level dialog, not by this page. */
  onDelete: (workspaceDir: string, title: string) => Promise<void>;
  /**
   * WORK-005: the duplicate action only renders once a backend contract is
   * wired up, so the menu never shows an entry that cannot do anything.
   */
  onDuplicate?: (workspaceDir: string, sourceTitle: string) => Promise<void>;
}

const DEFAULT_COVER = new URL(
  "../assets/default-project-cover.svg",
  import.meta.url,
).href;

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

function workspaceDirOf(project: WorkspaceSummary) {
  return project.task_dir ?? project.workspace_dir;
}

export function MyWorkPage({
  t,
  locale,
  workspaceScan,
  workspaceCovers,
  openingWorkspaceDir,
  highlightedWorkspaceId,
  loading,
  error,
  errorDetail,
  onRetry,
  onOpen,
  onNew,
  onRename,
  onDelete,
  onDuplicate,
}: MyWorkPageProps) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<WorkspaceSummary | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [brokenCoverIds, setBrokenCoverIds] = useState<string[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const lastOpenAttemptRef = useRef<string | null>(null);

  const projects = workspaceScan?.tasks ?? workspaceScan?.workspaces ?? [];
  const presentations = projects.filter((project) => project.has_deck_html);
  const inProgress = projects.filter((project) => !project.has_deck_html);
  const hasList = workspaceScan !== null;
  const busy = actionLoading || openingWorkspaceDir !== null || duplicatingId !== null;

  useEffect(() => {
    if (!menuId) return;

    const menu = menuRef.current;
    menu?.querySelector<HTMLButtonElement>("button")?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenuId(null);
      // Dismissing with the keyboard hands focus back to the trigger instead of
      // dropping it on the node that is about to unmount.
      const trigger = menuTriggerRef.current;
      if (trigger?.isConnected) trigger.focus();
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuId]);

  function moveMenuFocus(event: React.KeyboardEvent<HTMLDivElement>, step: 1 | -1) {
    event.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = (index + step + items.length) % items.length;
    items[next]?.focus();
  }

  async function openProject(dir: string) {
    lastOpenAttemptRef.current = dir;
    await onOpen(dir);
  }

  async function submitRename() {
    if (!renameTarget || !renameDraft.trim()) return;
    setActionLoading(true);
    try {
      await onRename(workspaceDirOf(renameTarget), renameDraft.trim());
      setRenameTarget(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteProject(target: WorkspaceSummary) {
    setActionLoading(true);
    try {
      await onDelete(workspaceDirOf(target), projectTitle(target, t));
    } finally {
      setActionLoading(false);
    }
  }

  async function duplicateProject(project: WorkspaceSummary) {
    if (!onDuplicate || duplicatingId) return;
    setDuplicatingId(project.workspace_id);
    try {
      await onDuplicate(workspaceDirOf(project), projectTitle(project, t));
    } finally {
      setDuplicatingId(null);
    }
  }

  function renderCover(project: WorkspaceSummary, completed: boolean) {
    const cover = completed ? workspaceCovers[project.workspace_id] : undefined;
    const broken = brokenCoverIds.includes(project.workspace_id);

    if (cover?.status === "loading") {
      return (
        <span
          className="my-work-card-cover my-work-card-cover-skeleton"
          role="img"
          aria-label={t.myWork.coverLoading}
        />
      );
    }

    if (cover?.status === "ready" && !broken) {
      return (
        <span className="my-work-card-cover">
          <img
            src={cover.url}
            alt={projectTitle(project, t)}
            loading="lazy"
            onError={() =>
              setBrokenCoverIds((current) =>
                current.includes(project.workspace_id) ? current : [...current, project.workspace_id],
              )
            }
          />
        </span>
      );
    }

    return (
      <span className="my-work-card-cover">
        <img src={DEFAULT_COVER} alt="" />
      </span>
    );
  }

  function renderProject(project: WorkspaceSummary, completed: boolean) {
    const dir = workspaceDirOf(project);
    const opening = openingWorkspaceDir === dir;
    const duplicating = duplicatingId === project.workspace_id;
    const highlighted = highlightedWorkspaceId === project.workspace_id;
    const menuOpen = menuId === project.workspace_id;

    return (
      <article
        className={`my-work-card${opening || duplicating ? " busy" : ""}${highlighted ? " highlighted" : ""}${menuOpen ? " menu-open" : ""}`}
        key={project.workspace_id}
      >
        <button
          className="my-work-card-main"
          type="button"
          onClick={() => void openProject(dir)}
          disabled={loading || busy}
        >
          {renderCover(project, completed)}
          <span className="my-work-card-copy">
            <strong>{projectTitle(project, t)}</strong>
            <small>{formatUpdatedAt(project.updated_at, locale)}</small>
          </span>
        </button>
        {opening || duplicating ? (
          <span className="my-work-card-busy" aria-live="polite">
            <Loader2 size={14} aria-hidden="true" />
            {opening ? t.myWork.opening : t.myWork.duplicating}
          </span>
        ) : null}
        <button
          type="button"
          className="my-work-card-menu-trigger"
          aria-label={t.myWork.menu}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(event) => {
            event.stopPropagation();
            menuTriggerRef.current = event.currentTarget;
            setMenuId((current) => (current === project.workspace_id ? null : project.workspace_id));
          }}
          disabled={loading || busy}
        >
          <MoreHorizontal size={17} aria-hidden="true" />
        </button>
        {menuOpen ? (
          <div
            className="my-work-card-menu"
            role="menu"
            ref={menuRef}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") moveMenuFocus(event, 1);
              if (event.key === "ArrowUp") moveMenuFocus(event, -1);
            }}
          >
            {buildMyWorkMenuItems(t, { canDuplicate: Boolean(onDuplicate) }).map((item) => {
              const Icon = MENU_ICONS[item.id];
              return (
                <Fragment key={item.id}>
                  {item.dividerBefore ? <span className="my-work-card-menu-divider" role="separator" /> : null}
                  <button
                    type="button"
                    role="menuitem"
                    className={item.tone ?? ""}
                    disabled={item.id === "duplicate" && duplicatingId !== null}
                    onClick={() => {
                      setMenuId(null);
                      if (item.id === "rename") {
                        setRenameDraft(project.title);
                        setRenameTarget(project);
                        return;
                      }
                      if (item.id === "duplicate") {
                        void duplicateProject(project);
                        return;
                      }
                      void deleteProject(project);
                    }}
                  >
                    <Icon size={14} aria-hidden="true" />
                    {item.label}
                  </button>
                </Fragment>
              );
            })}
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <section className="page active my-work-page">
      <header className="my-work-header">
        <div>
          <h1>{t.myWork.title}</h1>
        </div>
      </header>

      {loading && !hasList ? (
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
      ) : error && !hasList ? (
        <div className="my-work-error">
          <ErrorNotice
            t={t}
            tone="block"
            summary={error || t.myWork.loadFailed}
            detail={errorDetail}
            actions={
              <button type="button" className="secondary-btn" onClick={() => void onRetry()}>
                {t.myWork.retry}
              </button>
            }
          />
        </div>
      ) : (
        <>
          {error ? (
            <ErrorNotice
              t={t}
              summary={error}
              detail={errorDetail}
              actions={
                lastOpenAttemptRef.current ? (
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={busy}
                    onClick={() => {
                      const dir = lastOpenAttemptRef.current;
                      if (dir) void openProject(dir);
                    }}
                  >
                    {t.myWork.openRetry}
                  </button>
                ) : (
                  <button type="button" className="secondary-btn" onClick={() => void onRetry()}>
                    {t.myWork.retry}
                  </button>
                )
              }
            />
          ) : null}
          <section className="my-work-section">
            <div className="my-work-section-heading"><h2>{t.myWork.presentations}</h2></div>
            <div className="my-work-grid">
              <button type="button" className="my-work-new-card" onClick={() => void onNew()} disabled={busy}>
                <Plus size={22} aria-hidden="true" />
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
        <div className="my-work-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="my-work-rename-title">
          <section className="my-work-modal">
            <button type="button" className="my-work-modal-close" onClick={() => setRenameTarget(null)} aria-label={t.controls.close}><X size={16} aria-hidden="true" /></button>
            <h2 id="my-work-rename-title">{t.myWork.renameTitle}</h2>
            <input autoFocus value={renameDraft} placeholder={t.myWork.renamePlaceholder} onChange={(event) => setRenameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitRename(); if (event.key === "Escape") setRenameTarget(null); }} />
            <div className="my-work-modal-actions"><button type="button" className="secondary-btn" onClick={() => setRenameTarget(null)} disabled={actionLoading}>{t.controls.cancel}</button><button type="button" className="primary-btn" onClick={() => void submitRename()} disabled={!renameDraft.trim() || actionLoading}>{t.controls.save}</button></div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
