import type { FileSnapshot, FileTreeNode, ProjectSnapshot } from "./types";

export const DECK_STATES = [
  "initialized",
  "project_ready",
  "requirements_collected",
  "template_selected",
  "project_forked",
  "outline_ready",
  "page_plan_ready",
  "page_iteration_active",
  "deck_html_ready",
  "deck_review_pending",
  "deck_reviewed",
  "model_ready",
  "pptx_ready",
  "completed",
  "failed",
] as const;

export const PAGE_STATES = [
  "page_selected",
  "page_authoring",
  "page_review",
  "page_fix_required",
  "page_accepted",
  "page_locked",
] as const;

export const TOOL_NAMES = [
  "create_task_project",
  "open_task_project",
  "query_task_state",
  "record_requirements",
  "record_template_selection",
  "record_outline",
  "record_page_plan",
  "start_page_iteration",
  "record_page_progress",
  "record_deck_review_feedback",
  "advance_task_state",
  "rewind_task_state",
  "branch_task_project",
  "list_task_checkpoints",
  "recover_task_project",
  "validate_task_project",
] as const;

type Summary = {
  deckState?: string;
  pageState?: string;
  currentPageId?: string;
  blockedBy: string[];
  allowedTransitions: string[];
  allPagesLocked?: boolean;
  recoverable?: boolean;
};

export function getStateSummary(snapshot: ProjectSnapshot | null, queryData: any): Summary {
  const compact = queryData?.snapshot;
  const stateFile = snapshot?.taskStateFiles["state.json"];
  const fileState = stateFile?.exists ? stateFile.content as Record<string, any> : null;
  return {
    deckState: compact?.deckState ?? fileState?.deckState,
    pageState: compact?.pageState ?? fileState?.pageState,
    currentPageId: compact?.currentPageId ?? fileState?.currentPageId,
    blockedBy: compact?.blockedBy ?? fileState?.blockedBy ?? [],
    allowedTransitions: compact?.allowedTransitions ?? fileState?.allowedTransitions ?? [],
    allPagesLocked: compact?.allPagesLocked ?? fileState?.allPagesLocked,
    recoverable: compact?.recoverable ?? fileState?.recoverable,
  };
}

export function getCurrentPageId(snapshot: ProjectSnapshot | null, queryData: any): string {
  const summary = getStateSummary(snapshot, queryData);
  if (summary.currentPageId) {
    return summary.currentPageId;
  }
  const currentPage = snapshot?.taskStateFiles["current-page.json"]?.content as Record<string, unknown> | undefined;
  return typeof currentPage?.pageId === "string" ? currentPage.pageId : "cover";
}

export function getCurrentPageNumber(snapshot: ProjectSnapshot | null): number | undefined {
  const currentPage = snapshot?.taskStateFiles["current-page.json"]?.content as Record<string, unknown> | undefined;
  return typeof currentPage?.pageNumber === "number" ? currentPage.pageNumber : undefined;
}

export function buildDefaultArgs(tool: string, projectDir: string, snapshot: ProjectSnapshot | null, queryData: any): Record<string, unknown> {
  const currentPageId = getCurrentPageId(snapshot, queryData);
  const currentPageNumber = getCurrentPageNumber(snapshot);
  const summary = getStateSummary(snapshot, queryData);
  const base = projectDir ? { project_dir: projectDir } : { project_dir: "/absolute/path/to/task-project" };

  switch (tool) {
    case "create_task_project":
      return {
        ...base,
        title: "Debug PPT Task",
        initial_request: "Create a PPT task for local state-machine debugging.",
      };
    case "query_task_state":
      return { ...base, response_mode: "compact" };
    case "record_requirements":
      return {
        ...base,
        mode: "merge",
        requirements: {
          topic: "示例主题",
          audience: "管理层",
          scenario: "内部汇报",
          pageCount: 8,
          tone: "professional",
          language: "zh-CN",
          mustCover: ["背景", "关键洞察", "行动建议"],
        },
        source: "user",
      };
    case "record_template_selection":
      return {
        ...base,
        template_group: "red-finance-v3",
        selection_reason: "Debug default selection.",
        source: "user",
      };
    case "record_outline":
      return {
        ...base,
        outline: {
          narrative: "从背景到洞察，再到行动计划。",
          sections: ["背景", "分析", "建议"],
          pages: [
            {
              pageId: "cover",
              pageNumber: 1,
              title: "封面",
              goal: "建立主题和语境",
              coreMessage: "这是一个状态机调试默认大纲。",
            },
          ],
        },
      };
    case "record_page_plan":
      return {
        ...base,
        mode: "update_page",
        page_plan: {
          pageId: currentPageId,
          patch: {
            title: "调试页面",
            goal: "验证页面计划更新",
            coreMessage: "默认参数可直接编辑后调用。",
          },
        },
      };
    case "start_page_iteration":
      return {
        ...base,
        page_id: currentPageId,
        ...(currentPageNumber ? { page_number: currentPageNumber } : {}),
      };
    case "record_page_progress":
      return {
        ...base,
        page_id: currentPageId,
        page_state: summary.pageState === "page_review" ? "page_accepted" : "page_authoring",
        summary: "Debug progress update.",
        review_notes: "",
        changed_files: [],
        rendered_html_path: "",
        rendered_png_path: "",
      };
    case "record_deck_review_feedback":
      return {
        ...base,
        pages: [
          {
            page_id: currentPageId,
            summary: "整套审阅中要求返修当前页。",
            review_notes: "请检查布局、文案和截图表现。",
          },
        ],
      };
    case "advance_task_state":
      return {
        ...base,
        target_deck_state: summary.deckState ?? "page_iteration_active",
        target_page_state: summary.pageState ?? "",
        reason: "Debug manual advance.",
        related_artifacts: [],
      };
    case "rewind_task_state":
      return {
        ...base,
        target_state: "outline_ready",
        checkpoint_id: "",
        reason: "Debug manual rewind.",
      };
    case "branch_task_project":
      return {
        ...base,
        checkpoint_id: "",
        branch_name: "debug-branch",
        reason: "Debug branch.",
      };
    case "list_task_checkpoints":
      return { ...base, include_branches: true };
    case "open_task_project":
    case "recover_task_project":
    case "validate_task_project":
    default:
      return base;
  }
}

export function collectFileEntries(snapshot: ProjectSnapshot | null): Array<{ label: string; file: FileSnapshot }> {
  if (!snapshot) {
    return [];
  }

  const taskState = Object.entries(snapshot.taskStateFiles).map(([name, file]) => ({
    label: `task-state/${name}`,
    file,
  }));
  const promote = snapshot.promoteFiles.map((file) => ({
    label: `promote/${relativePromotePath(snapshot.projectDir, file.path)}`,
    file,
  }));
  return [...taskState, ...promote];
}

export function buildFileTree(snapshot: ProjectSnapshot | null): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  for (const entry of collectFileEntries(snapshot)) {
    const parts = entry.label.split("/");
    let children = root;
    let currentPath = "";
    for (const [index, part] of parts.entries()) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;
      let node = children.find((child) => child.name === part);
      if (!node) {
        node = {
          id: currentPath,
          name: part,
          path: currentPath,
          kind: isFile ? "file" : "directory",
          children: isFile ? undefined : [],
        };
        children.push(node);
      }
      if (isFile) {
        node.kind = "file";
        node.file = entry.file;
      } else {
        node.children ??= [];
        children = node.children;
      }
    }
  }

  return sortNodes(root);
}

export function findFileNode(nodes: FileTreeNode[], path: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    const found = node.children ? findFileNode(node.children, path) : null;
    if (found) {
      return found;
    }
  }
  return null;
}

export function stringifyFile(file: FileSnapshot | null): string {
  if (!file) {
    return "No file selected.";
  }
  if (!file.exists) {
    return `${file.path}\n\nMissing${file.error ? `: ${file.error}` : ""}`;
  }
  return typeof file.content === "string"
    ? file.content
    : JSON.stringify(file.content, null, 2);
}

export function getFileLanguage(file: FileSnapshot | null): string {
  if (!file) return "plaintext";
  if (file.kind === "json" || file.kind === "jsonl") return "json";
  if (file.kind === "markdown") return "markdown";
  return "plaintext";
}

function relativePromotePath(projectDir: string, filePath: string): string {
  const prefix = `${projectDir}/promote/`;
  return filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath;
}

function sortNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes
    .map((node) => ({
      ...node,
      children: node.children ? sortNodes(node.children) : undefined,
    }))
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "directory" ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
}
