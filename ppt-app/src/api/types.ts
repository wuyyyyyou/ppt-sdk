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
  pages: string;
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
  pages: unknown;
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
  summary: string;
  bullets: string[];
}

export interface WorkspaceOutline {
  version: 1;
  title: string;
  status: "draft" | "confirmed";
  items: WorkspaceOutlineItem[];
  source: {
    prompt: string;
    context: unknown[];
  };
  updated_at: string | null;
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
    };
  };
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

export interface ListTemplatesInput {
  projectDir?: string;
}

export interface TemplateSummary {
  id: string;
  name: string;
  description?: string;
}

export interface ListTemplatesResult {
  templates: TemplateSummary[];
}

export interface SelectTemplateInput {
  projectDir: string;
  templateId: string;
}

export interface RecordOutlineInput {
  projectDir: string;
  outline: unknown;
}

export interface RenderDeckHtmlInput {
  projectDir: string;
}

export interface RenderDeckHtmlResult {
  htmlPath: string;
  screenshotPaths: string[];
  diagnostics?: unknown;
}

export interface RecordDeckReviewInput {
  projectDir: string;
  approved: boolean;
  feedback?: string;
}

export interface PrepareExportModelInput {
  projectDir: string;
}

export interface PrepareExportModelResult {
  modelPath: string;
}

export interface GeneratePptxInput {
  modelPath: string;
  outputPath: string;
}

export interface GeneratePptxResult {
  pptxPath: string;
  summary?: unknown;
}

export interface RecordPptxExportInput {
  projectDir: string;
  pptxPath: string;
  generatorResult?: unknown;
}
