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
  page_plan: string;
  page_progress: string;
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
  kind?: string;
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
  page_plan: unknown;
  page_progress: unknown;
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

export interface UpdateAppWorkspacePagesInput {
  workspace_dir: string;
  pages: Array<{
    page_id: string;
    title?: string;
  }>;
}

export interface DuplicateAppWorkspacePageInput {
  workspace_dir: string;
  page_id: string;
  title?: string;
}

export interface AppendAppWorkspaceLogInput {
  workspace_dir: string;
  channel: "ai-outline" | "ai-page-plan" | "ai-page-agent" | "ai-page-agent-stream";
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

export interface AppTemplatePlanningBlueprint {
  id: string;
  name: string;
  blueprint_source: string;
  example_slide?: string;
  layout_family?: string;
  content_intents: string[];
  suitable_for: string[];
  avoid_for: string[];
}

export interface AppTemplatePlanningContext {
  template_group: string;
  template_group_name: string;
  template_dir: string;
  manifest_path: string;
  catalog_path: string;
  blueprints: AppTemplatePlanningBlueprint[];
  rules: string[];
}

export interface GetAppTemplatePlanningContextInput {
  workspace_dir: string;
}

export interface AppPagePlanItem {
  page_id: string;
  index: number;
  title: string;
  outline: string;
  blueprint_id: string;
  blueprint_source: string;
  slide_path: string;
  data_path: string;
  manifest_slide_id: string;
  reason: string;
}

export interface AppPagePlan {
  version: 1;
  status: "planned" | "prepared" | "stale";
  title: string;
  source: {
    outline_updated_at: string | null;
    template_group: string;
    template_manifest_path: string;
    generated_by: string;
  };
  pages: AppPagePlanItem[];
  updated_at: string;
}

export interface RecordAppPagePlanInput {
  workspace_dir: string;
  page_plan: unknown;
}

export interface GetAppPagePlanInput {
  workspace_dir: string;
}

export interface PrepareAppPageFilesInput {
  workspace_dir: string;
}

export interface PrepareAppPageFilesResult {
  workspace_dir: string;
  manifest_path: string;
  page_plan_path: string;
  prepared_at: string;
  pages: Array<{
    page_id: string;
    index: number;
    title: string;
    slide_path: string;
    data_path: string;
    blueprint_id: string;
    manifest_slide_id: string;
  }>;
}

export interface AppPageProgressItem {
  page_id: string;
  index: number;
  title: string;
  status: string;
  render_attempts: number;
  self_review_attempts: number;
  agent_failures: number;
  agent_infrastructure_failures: number;
  slide_path: string;
  data_path: string;
  last_html_path: string;
  last_screenshot_path: string;
  last_error: string;
  review: unknown | null;
  updated_at: string | null;
}

export interface AppPageProgress {
  version: 1;
  status: string;
  pages: AppPageProgressItem[];
  updated_at: string | null;
}

export interface GetAppPageProgressInput {
  workspace_dir: string;
}

export interface RecordAppPageProgressInput {
  workspace_dir: string;
  page_id: string;
  patch: Record<string, unknown>;
}

export interface RenderAppWorkspacePagePreviewInput {
  workspace_dir: string;
  page_index: number;
}

export interface RenderAppWorkspacePagePreviewResult {
  workspace_dir: string;
  manifest_path: string;
  html_path: string;
  preview_url?: string;
  screenshot_path: string;
  page_index: number;
  page_number: number;
  slide_id: string;
  layout_id: string;
  title: string;
  rendered_at: string;
}

export interface AppWorkspacePageItem {
  page_id: string;
  index: number;
  title: string;
  layout_id: string;
  html_path: string;
  speaker_note: string;
}

export interface AppWorkspacePages {
  version: 1;
  status: "rendered";
  title: string;
  manifest_path: string;
  output_dir: string;
  rendered_at: string;
  pages: AppWorkspacePageItem[];
  source: {
    kind: "template-manifest";
  };
  updated_at: string;
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

export interface PrepareAppExportModelInput {
  workspace_dir: string;
}

export interface PrepareAppExportModelResult {
  workspace_dir: string;
  manifest_path: string;
  html_path: string;
  model_path: string;
  output_dir: string;
  prepared_at: string;
}

export interface ExportAppPdfInput {
  workspace_dir: string;
}

export interface ExportAppPdfResult {
  workspace_dir: string;
  manifest_path: string;
  html_path: string;
  pdf_path: string;
  output_dir: string;
  exported_at: string;
}

export interface RecordAppPptxExportInput {
  workspace_dir: string;
  pptx_path: string;
  generator_result?: unknown;
}

export interface RecordAppPdfExportInput {
  workspace_dir: string;
  pdf_path: string;
}
