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
  template: string;
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
  template: unknown;
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

export interface AppTemplatePreviewRef {
  group_id: string;
  layout_id: string;
  layout_name: string;
  file_name: string;
  mime_type: "image/png";
  width: number;
  height: number;
  primary: boolean;
  url: string;
}

export interface AppTemplateGroupSummary {
  group_id: string;
  group_name: string;
  group_description: string;
  ordered: boolean;
  default: boolean;
  group_brief?: string;
  style_tags?: string[];
  industry_tags?: string[];
  use_cases?: string[];
  audience_tags?: string[];
  tone_tags?: string[];
  cover_layout_id?: string;
  agenda_layout_id?: string;
  closing_layout_id?: string;
  layout_roles_summary?: string[];
  content_elements_summary?: string[];
  layout_count: number;
  preview: AppTemplatePreviewRef | null;
  previews: AppTemplatePreviewRef[];
}

export interface ListAppTemplateGroupsResult {
  groups: AppTemplateGroupSummary[];
  count: number;
}

export interface GetAppTemplateGroupInput {
  group_id: string;
}

export interface GetAppTemplatePreviewInput {
  group_id: string;
  layout_id?: string;
}

export interface AppTemplatePreviewResult {
  group_id: string;
  layout_id: string;
  file_name: string;
  mime_type: "image/png";
  data_url: string;
}

export interface SelectAppWorkspaceTemplateInput {
  workspace_dir: string;
  template_group: string;
}

export interface AppWorkspaceTemplateSelection {
  version: 1;
  selected_template_group: string;
  selected_template_group_name: string;
  template_dir: string;
  manifest_path: string;
  catalog_json_path?: string;
  data_dir_path?: string;
  selected_at: string;
}

export interface SelectAppWorkspaceTemplateResult {
  workspace: AppWorkspaceResult;
  selection: AppWorkspaceTemplateSelection;
}

export interface RenderAppWorkspaceDeckHtmlInput {
  workspace_dir: string;
}

export interface RenderAppWorkspaceDeckHtmlResult {
  workspace_dir: string;
  manifest_path: string;
  output_dir: string;
  slides: Array<{
    slide_id: string;
    layout_id: string;
    title: string;
    html_path: string;
    preview_url?: string;
    speaker_note: string;
  }>;
  slide_count: number;
  title: string;
  rendered_at: string;
}
