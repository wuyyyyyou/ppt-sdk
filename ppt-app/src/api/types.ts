export interface ToolIds {
  pptEngine: string;
  pptGener: string;
}

export interface WorkspaceSummary {
  workspace_id: string;
  workspace_dir: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceFiles {
  task: string;
  setting: string;
  outline: string;
  page_plan?: string;
  page_progress?: string;
  pages: string;
  template: string;
}

export interface WorkspaceResult {
  workspace_root: string;
  workspace_dir: string;
  workspace_id: string;
  initialized: boolean;
  created_files: string[];
  missing_files: string[];
  files: WorkspaceFiles;
  task: unknown;
  setting: unknown;
  outline: unknown;
  page_plan?: unknown;
  page_progress?: unknown;
  pages: unknown;
  template: unknown;
}

export interface WorkspaceSettings {
  audience?: string;
  goal?: string;
  style_notes?: string;
  language?: string;
  output_language?: string;
  aspect_ratio?: string;
  slide_count?: string;
  text_density?: string;
  visual_tone?: string;
  typography?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface WorkspaceOutlineItem {
  title: string;
  outline: string;
}

export interface WorkspaceOutline {
  version: 2;
  title: string;
  status: "draft" | "confirmed";
  items: WorkspaceOutlineItem[];
  source: {
    prompt: string;
    context: unknown[];
    setting: Record<string, unknown>;
    kind?: string;
  };
  updated_at: string | null;
}

export interface WorkspacePageItem {
  page_id: string;
  index: number;
  title: string;
  layout_id: string;
  html_path: string;
  speaker_note: string;
}

export interface WorkspacePages {
  version: 1;
  status?: "rendered" | string;
  title?: string;
  manifest_path?: string;
  output_dir?: string;
  rendered_at?: string;
  pages: WorkspacePageItem[];
  source?: {
    kind?: string;
  };
  updated_at?: string | null;
}

export interface ListWorkspacesResult {
  workspace_root: string;
  has_workspaces: boolean;
  latest_workspace: WorkspaceSummary | null;
  workspaces: WorkspaceSummary[];
}

export interface CreateWorkspaceInput {
  title?: string;
}

export interface OpenWorkspaceInput {
  workspace_dir: string;
}

export interface UpdateWorkspaceSettingsInput {
  workspace_dir: string;
  setting: WorkspaceSettings;
}

export interface UpdateWorkspaceTitleInput {
  workspace_dir: string;
  title: string;
}

export interface UpdateWorkspacePagesInput {
  workspace_dir: string;
  pages: Array<{
    page_id: string;
    title?: string;
  }>;
}

export interface DuplicateWorkspacePageInput {
  workspace_dir: string;
  page_id: string;
  title?: string;
}

export interface GetWorkspaceOutlineInput {
  workspace_dir: string;
}

export interface UpdateWorkspaceOutlineInput {
  workspace_dir: string;
  outline: {
    title?: string;
    status?: "draft" | "confirmed";
    items?: WorkspaceOutlineItem[];
    source?: {
      prompt: string;
      context: unknown[];
      setting?: Record<string, unknown>;
    };
  };
}

export interface AppendWorkspaceLogInput {
  workspace_dir: string;
  channel: "ai-outline" | "ai-page-plan" | "ai-page-agent" | "ai-page-agent-stream";
  entry: Record<string, unknown>;
}

export interface AppendWorkspaceLogResult {
  workspace_dir: string;
  log_file: string;
  appended: true;
}

export interface CreateProjectInput {
  projectDir: string;
  title: string;
  initialRequest?: string;
}

export interface ProjectResult {
  projectDir: string;
  state: unknown;
  nextStep?: string;
}

export interface RecordRequirementsInput {
  projectDir: string;
  requirements: string;
}

export interface TemplateSummary {
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
  preview: TemplatePreviewRef | null;
  previews: TemplatePreviewRef[];
}

export interface ListTemplatesResult {
  templates: TemplateSummary[];
  count: number;
}

export interface SelectTemplateInput {
  workspace_dir: string;
  template_group: string;
}

export interface TemplatePreviewRef {
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

export interface WorkspaceTemplateSelection {
  version: 1;
  selected_template_group: string;
  selected_template_group_name: string;
  template_dir: string;
  manifest_path: string;
  catalog_json_path?: string;
  data_dir_path?: string;
  selected_at: string;
}

export interface SelectTemplateResult {
  workspace: WorkspaceResult;
  selection: WorkspaceTemplateSelection;
}

export interface TemplatePlanningBlueprint {
  id: string;
  name: string;
  blueprint_source: string;
  example_slide?: string;
  layout_family?: string;
  content_intents: string[];
  suitable_for: string[];
  avoid_for: string[];
}

export interface TemplatePlanningContext {
  template_group: string;
  template_group_name: string;
  template_dir: string;
  manifest_path: string;
  catalog_path: string;
  blueprints: TemplatePlanningBlueprint[];
  rules: string[];
}

export interface PagePlanItem {
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

export interface PagePlan {
  version: 1;
  status: "planned" | "prepared" | "stale";
  title: string;
  source: {
    outline_updated_at: string | null;
    template_group: string;
    template_manifest_path: string;
    generated_by: string;
  };
  pages: PagePlanItem[];
  updated_at: string;
}

export interface RecordPagePlanInput {
  workspace_dir: string;
  page_plan: PagePlan;
}

export interface PreparePageFilesInput {
  workspace_dir: string;
}

export interface PreparePageFilesResult {
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

export interface PageProgressItem {
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

export interface PageProgress {
  version: 1;
  status: string;
  pages: PageProgressItem[];
  updated_at: string | null;
}

export interface RecordPageProgressInput {
  workspace_dir: string;
  page_id: string;
  patch: Record<string, unknown>;
}

export interface RenderWorkspacePagePreviewInput {
  workspace_dir: string;
  page_index: number;
}

export interface RenderWorkspacePagePreviewResult {
  workspace_dir: string;
  manifest_path: string;
  html_path: string;
  preview_url: string;
  screenshot_path: string;
  page_index: number;
  page_number: number;
  slide_id: string;
  layout_id: string;
  title: string;
  rendered_at: string;
}

export interface RecordOutlineInput {
  projectDir: string;
  outline: unknown;
}

export interface RenderDeckHtmlInput {
  workspace_dir: string;
}

export interface RenderDeckHtmlResult {
  workspace_dir: string;
  manifest_path: string;
  output_dir: string;
  preview_url?: string | null;
  slides: Array<{
    slide_id: string;
    layout_id: string;
    title: string;
    html_path: string;
    preview_url: string;
    speaker_note: string;
  }>;
  slide_count: number;
  title: string;
  rendered_at: string;
  diagnostics?: unknown;
}

export interface RecordDeckReviewInput {
  projectDir: string;
  approved: boolean;
  feedback?: string;
}

export interface PrepareExportModelInput {
  workspace_dir: string;
}

export interface PrepareExportModelResult {
  modelPath: string;
  htmlPath: string;
  outputDir: string;
}

export type PptxExportStatus =
  | "idle"
  | "preparing_model"
  | "model_ready"
  | "generating_pptx"
  | "completed"
  | "failed";

export interface PptxExportJob {
  version: 1;
  job_id: string;
  status: PptxExportStatus;
  message: string;
  percent: number;
  workspace_dir: string;
  status_path: string;
  output_dir: string;
  html_path: string;
  model_path: string;
  pptx_path: string;
  started_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  error: {
    message: string;
    stack?: string;
  } | null;
  generator_result?: unknown;
}

export interface StartPptxExportModelInput {
  workspace_dir: string;
}

export interface GeneratePptxInput {
  modelPath: string;
  outputPath: string;
}

export interface GeneratePptxResult {
  pptxPath: string;
  summary?: unknown;
}

export interface StartGeneratePptxInput extends GeneratePptxInput {
  workspace_dir: string;
  job_id?: string;
}

export interface RecordPptxExportInput {
  workspace_dir: string;
  pptxPath: string;
  generatorResult?: unknown;
}

export interface ExportPdfInput {
  workspace_dir: string;
}

export interface ExportPdfResult {
  pdfPath: string;
  htmlPath: string;
  outputDir: string;
}

export interface RecordPdfExportInput {
  workspace_dir: string;
  pdfPath: string;
}

export interface GetExportArtifactDownloadUrlInput {
  workspace_dir: string;
  artifact_type: "pptx" | "pdf";
}

export interface ExportArtifactDownloadUrlResult {
  workspace_dir: string;
  workspace_id: string;
  title: string;
  artifact_type: "pptx" | "pdf";
  path: string;
  filename: string;
  updated_at: string | null;
  download_url: string;
}
