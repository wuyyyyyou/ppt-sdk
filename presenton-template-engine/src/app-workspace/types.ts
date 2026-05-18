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
