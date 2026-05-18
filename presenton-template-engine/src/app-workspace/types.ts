export interface AppWorkspaceSummary {
  workspace_id: string;
  workspace_dir: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AppWorkspaceFiles {
  task: string;
  setting: string;
  outline: string;
  pages: string;
}

export interface AppWorkspaceOutlineItem {
  title: string;
  outline: string;
}

export interface AppWorkspaceOutlineSource {
  prompt: string;
  context: unknown[];
  setting: Record<string, unknown>;
}

export interface AppWorkspaceOutline {
  version: 2;
  title: string;
  status: "draft" | "confirmed";
  items: AppWorkspaceOutlineItem[];
  source: AppWorkspaceOutlineSource;
  updated_at: string | null;
}

export interface AppWorkspaceResult {
  workspace_root: string;
  workspace_dir: string;
  workspace_id: string;
  initialized: boolean;
  created_files: string[];
  missing_files: string[];
  files: AppWorkspaceFiles;
  task: unknown;
  setting: unknown;
  outline: unknown;
  pages: unknown;
}

export interface ListAppWorkspacesResult {
  workspace_root: string;
  has_workspaces: boolean;
  latest_workspace: AppWorkspaceSummary | null;
  workspaces: AppWorkspaceSummary[];
}

export interface CreateAppWorkspaceInput {
  title?: string;
}

export interface OpenAppWorkspaceInput {
  workspace_dir: string;
}

export interface UpdateAppWorkspaceSettingsInput {
  workspace_dir: string;
  setting: Record<string, unknown>;
}

export interface UpdateAppWorkspaceTitleInput {
  workspace_dir: string;
  title: string;
}

export interface GetAppWorkspaceOutlineInput {
  workspace_dir: string;
}

export interface UpdateAppWorkspaceOutlineInput {
  workspace_dir: string;
  outline: {
    title?: string;
    status?: string;
    items?: unknown;
    source?: unknown;
  };
}

export interface AppendAppWorkspaceLogInput {
  workspace_dir: string;
  channel: "ai-outline";
  entry: Record<string, unknown>;
}

export interface AppendAppWorkspaceLogResult {
  workspace_dir: string;
  log_file: string;
  appended: true;
}
