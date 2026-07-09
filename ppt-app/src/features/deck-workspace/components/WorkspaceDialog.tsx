import { FolderOpen, FolderPlus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import type {
  ListWorkspacesResult,
  WorkspaceResult
} from "../../../api/types";
import type { Locale } from "../../../i18n/messages";

interface WorkspaceDialogProps {
  locale: Locale;
  scan: ListWorkspacesResult | null;
  task: WorkspaceResult | null;
  loading: boolean;
  error: string;
  onUseLatest: () => void;
  onCreate: () => void;
  onCreateStyleProfile: () => void;
  onOpen: (taskDir: string) => Promise<void>;
}

function formatTaskName(value: string) {
  return value.replace(/^ppt-/, "PPT ");
}

const copy = {
  en: {
    title: "Choose task",
    rootPrefix: "Default workspace",
    loading: "Checking local tasks...",
    found: "Last task found",
    missing: "No existing task found",
    createRequired: "Create a new PPT task",
    createHint:
      "Anna will initialize task.json, setting.json, outline.json, and pages.json.",
    open: "Open project",
    recent: "Recent projects",
    noRecent: "No recent tasks",
    useLatest: "Open latest task",
    create: "Create new",
    createStyleProfile: "Create style profile",
    close: "Close"
  },
  zh: {
    title: "选择 PPT 任务",
    rootPrefix: "默认工作目录为",
    loading: "正在检查本地任务...",
    found: "找到上次的任务",
    missing: "没有找到已有任务",
    createRequired: "需要新建一个 PPT 任务",
    createHint: "会自动创建 task.json、setting.json、outline.json、pages.json。",
    open: "打开项目",
    recent: "最近项目",
    noRecent: "暂无最近任务",
    useLatest: "打开上次任务",
    create: "新建任务",
    createStyleProfile: "创建风格画像",
    close: "关闭"
  }
} satisfies Record<Locale, Record<string, string>>;

export function WorkspaceDialog({
  locale,
  scan,
  task,
  loading,
  error,
  onUseLatest,
  onCreate,
  onCreateStyleProfile,
  onOpen
}: WorkspaceDialogProps) {
  const [openPicker, setOpenPicker] = useState(false);

  if (task) {
    return null;
  }

  const latest = scan?.latest_task ?? scan?.latest_workspace ?? null;
  const tasks = scan?.tasks ?? scan?.workspaces ?? [];
  const text = copy[locale];

  return (
    <div className="task-overlay" role="dialog" aria-modal="true">
      <section className="task-dialog">
        <header className="task-dialog-copy">
          <h2>{text.title}</h2>
          <p>
            {text.rootPrefix}
            <strong>{scan?.task_root ?? scan?.workspace_root ?? "~/anna-workspace/ppt"}</strong>
          </p>
        </header>

        <div className="task-dialog-body">
          {loading ? (
            <div className="task-state">{text.loading}</div>
          ) : (
            <div className="task-launch-grid">
              <button className="task-launch-card" onClick={onCreate} disabled={loading}>
                <FolderPlus size={22} />
                <strong>{text.create}</strong>
              </button>
              <button className="task-launch-card" onClick={onCreateStyleProfile} disabled={loading}>
                <Sparkles size={22} />
                <strong>{text.createStyleProfile}</strong>
              </button>
              <button
                className="task-launch-card"
                onClick={() => setOpenPicker(true)}
                disabled={loading || tasks.length === 0}
              >
                <FolderOpen size={22} />
                <strong>{text.open}</strong>
              </button>
            </div>
          )}

          {error ? <div className="task-error">{error}</div> : null}
        </div>

        <section className="task-recent">
          <div className="task-recent-header">
            <span>{text.recent}</span>
            {latest ? (
              <button onClick={onUseLatest} disabled={loading}>
                {text.useLatest}
              </button>
            ) : null}
          </div>
          {latest ? (
            <button className="task-recent-row" onClick={onUseLatest} disabled={loading}>
              <strong>{latest.title || formatTaskName(latest.task_id ?? latest.workspace_id)}</strong>
              <span>{latest.task_dir ?? latest.workspace_dir}</span>
            </button>
          ) : (
            <div className="task-recent-empty">{text.noRecent}</div>
          )}
        </section>

        {openPicker ? (
          <div className="task-picker-backdrop" role="dialog" aria-modal="true">
            <section className="task-picker">
              <div className="task-picker-header">
                <strong>{text.open}</strong>
                <button aria-label={text.close} onClick={() => setOpenPicker(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="task-picker-list">
                {tasks.map((item) => {
                  const taskDir = item.task_dir ?? item.workspace_dir;
                  return (
                    <button
                      key={taskDir}
                      onClick={() => {
                        setOpenPicker(false);
                        void onOpen(taskDir);
                      }}
                      disabled={loading}
                    >
                      <strong>{item.title || formatTaskName(item.task_id ?? item.workspace_id)}</strong>
                      <span>{taskDir}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
