import { FolderOpen, Home, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { Messages } from "../../../i18n/messages";
import type { PageId } from "../types";

interface EntrySidebarProps {
  t: Messages;
  page: PageId;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onHome: () => void;
  onMyWork: () => void;
}

/**
 * The entry pages replace the panel header with this rail, so it carries the
 * brand and the two page links. Collapsed it keeps the links as icons only.
 */
export function EntrySidebar(props: EntrySidebarProps) {
  const { t, page, collapsed, onToggleCollapsed, onHome, onMyWork } = props;
  const toggleLabel = collapsed ? t.controls.expandSidebar : t.controls.collapseSidebar;

  return (
    <aside className={`entry-sidebar ${collapsed ? "collapsed" : ""}`} aria-label={t.appName}>
      {/* The toggle leads the row so its icon lines up with the nav icons below. */}
      <div className="entry-sidebar-brand">
        <button
          data-performance-id="navigation.new-presentation"
          type="button"
          className="entry-sidebar-toggle"
          onClick={onToggleCollapsed}
          title={toggleLabel}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <PanelLeftOpen size={16} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={16} aria-hidden="true" />
          )}
        </button>
        {collapsed ? null : <span className="app-title">{t.appName}</span>}
      </div>
      <nav className="entry-sidebar-nav" aria-label={t.myWork.home}>
        <button
          data-performance-id="navigation.my-work"
          type="button"
          className={page === "main" ? "active" : ""}
          aria-current={page === "main" ? "page" : undefined}
          onClick={onHome}
          title={collapsed ? t.myWork.home : undefined}
          aria-label={collapsed ? t.myWork.home : undefined}
        >
          <Home size={16} aria-hidden="true" />
          {collapsed ? null : t.myWork.home}
        </button>
        <button
          data-performance-id="navigation.collapse"
          type="button"
          className={page === "my-work" ? "active" : ""}
          aria-current={page === "my-work" ? "page" : undefined}
          onClick={onMyWork}
          title={collapsed ? t.myWork.title : undefined}
          aria-label={collapsed ? t.myWork.title : undefined}
        >
          <FolderOpen size={16} aria-hidden="true" />
          {collapsed ? null : t.myWork.title}
        </button>
      </nav>
    </aside>
  );
}
