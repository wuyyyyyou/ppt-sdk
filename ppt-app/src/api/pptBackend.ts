import type {
  AppendWorkspaceLogInput,
  AppendWorkspaceLogResult,
  CreateProjectInput,
  CreateWorkspaceInput,
  DuplicateWorkspacePageInput,
  GeneratePptxInput,
  GeneratePptxResult,
  GetExportArtifactDownloadUrlInput,
  GetWorkspaceOutlineInput,
  ListWorkspacesResult,
  ListTemplatesResult,
  PagePlan,
  PageProgress,
  OpenWorkspaceInput,
  PrepareExportModelInput,
  PrepareExportModelResult,
  PreparePageFilesInput,
  PreparePageFilesResult,
  PrepareResearchWorkspaceResult,
  ProjectResult,
  PptxExportJob,
  ResearchEvidenceIndex,
  VisualResearchCurationDraft,
  ResearchPlan,
  ResearchStatus,
  WebResearchCurationDraft,
  ExportPdfInput,
  ExportPdfResult,
  ExportArtifactDownloadUrlResult,
  RecordDeckReviewInput,
  RecordPagePlanInput,
  RecordPageProgressInput,
  RecordPptxExportInput,
  RecordPdfExportInput,
  RecordRequirementsInput,
  RecordOutlineInput,
  RenderDeckHtmlInput,
  RenderDeckHtmlResult,
  RenderWorkspacePagePreviewInput,
  RenderWorkspacePagePreviewResult,
  SelectTemplateInput,
  SelectTemplateResult,
  StartGeneratePptxInput,
  StartPptxExportModelInput,
  WebFetchResult,
  WebSearchResult,
  ImageFetchResult,
  ImageSearchResult,
  TemplatePlanningContext,
  UpdateWorkspaceSettingsInput,
  UpdateWorkspaceOutlineInput,
  UpdateWorkspacePagesInput,
  UpdateWorkspaceTitleInput,
  WorkspaceOutline,
  WorkspaceDefaultsResult,
  WorkspaceResult
} from "./types";
import { createAnnaPptBackend } from "./annaPptBackend";
import { connectAnnaRuntime } from "../runtime/annaRuntime";
import { detectRuntimeMode } from "../runtime/runtimeMode";

export interface PptBackend {
  listWorkspaces(): Promise<ListWorkspacesResult>;
  getWorkspaceDefaults(): Promise<WorkspaceDefaultsResult>;
  createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceResult>;
  openWorkspace(input: OpenWorkspaceInput): Promise<WorkspaceResult>;
  appendWorkspaceLog(input: AppendWorkspaceLogInput): Promise<AppendWorkspaceLogResult>;
  getWorkspaceOutline(input: GetWorkspaceOutlineInput): Promise<WorkspaceOutline>;
  updateWorkspaceOutline(input: UpdateWorkspaceOutlineInput): Promise<WorkspaceResult>;
  updateWorkspaceSettings(
    input: UpdateWorkspaceSettingsInput
  ): Promise<WorkspaceResult>;
  updateWorkspacePages(input: UpdateWorkspacePagesInput): Promise<WorkspaceResult>;
  duplicateWorkspacePage(input: DuplicateWorkspacePageInput): Promise<WorkspaceResult>;
  updateWorkspaceTitle(input: UpdateWorkspaceTitleInput): Promise<WorkspaceResult>;
  createProject(input: CreateProjectInput): Promise<ProjectResult>;
  getProject(input: { projectDir: string }): Promise<ProjectResult>;
  recordRequirements(input: RecordRequirementsInput): Promise<ProjectResult>;
  listTemplates(): Promise<ListTemplatesResult>;
  selectTemplate(input: SelectTemplateInput): Promise<SelectTemplateResult>;
  getTemplatePlanningContext(input: { workspace_dir: string }): Promise<TemplatePlanningContext>;
  recordPagePlan(input: RecordPagePlanInput): Promise<PagePlan>;
  getPagePlan(input: { workspace_dir: string }): Promise<PagePlan>;
  preparePageFiles(input: PreparePageFilesInput): Promise<PreparePageFilesResult>;
  prepareResearchWorkspace(input: { workspace_dir: string }): Promise<PrepareResearchWorkspaceResult>;
  recordResearchPlan(input: { workspace_dir: string; research_plan: ResearchPlan }): Promise<ResearchPlan>;
  getResearchPlan(input: { workspace_dir: string }): Promise<ResearchPlan>;
  recordResearchEvidence(input: { workspace_dir: string; evidence: ResearchEvidenceIndex }): Promise<ResearchEvidenceIndex>;
  getResearchEvidence(input: { workspace_dir: string }): Promise<ResearchEvidenceIndex>;
  recordResearchCurationDraft(input: {
    workspace_dir: string;
    page_id: string;
    draft_type: "web";
    draft: WebResearchCurationDraft;
  } | {
    workspace_dir: string;
    page_id: string;
    draft_type: "visual";
    draft: VisualResearchCurationDraft;
  }): Promise<WebResearchCurationDraft | VisualResearchCurationDraft>;
  getResearchCurationDraft(input: {
    workspace_dir: string;
    page_id: string;
    draft_type: "web" | "visual";
  }): Promise<WebResearchCurationDraft | VisualResearchCurationDraft | Record<string, unknown>>;
  recordResearchEvidencePageMarkdown(input: {
    workspace_dir: string;
    page_id: string;
    markdown: string;
  }): Promise<{
    workspace_dir: string;
    page_id: string;
    markdown_path: string;
    updated_at: string;
  }>;
  recordResearchStatus(input: { workspace_dir: string; status: ResearchStatus }): Promise<ResearchStatus>;
  getResearchStatus(input: { workspace_dir: string }): Promise<ResearchStatus>;
  webSearch(input: {
    query: string;
    max_results?: number;
    safesearch?: "off" | "moderate" | "strict";
    timelimit?: "d" | "w" | "m" | "y";
  }): Promise<WebSearchResult>;
  webFetch(input: {
    urls: string[];
    output_dir?: string;
    format?: "text_markdown" | "text_plain" | "text_rich";
    max_chars?: number;
  }): Promise<WebFetchResult>;
  imageSearch(input: {
    query: string;
    max_results?: number;
    safesearch?: "off" | "moderate" | "strict";
    timelimit?: "d" | "w" | "m" | "y";
    size?: string;
    color?: string;
    type_image?: string;
    layout?: string;
  }): Promise<ImageSearchResult>;
  imageFetch(input: {
    urls: string[];
    output_dir?: string;
    max_bytes?: number;
  }): Promise<ImageFetchResult>;
  getPageProgress(input: { workspace_dir: string }): Promise<PageProgress>;
  recordPageProgress(input: RecordPageProgressInput): Promise<PageProgress>;
  renderWorkspacePagePreview(
    input: RenderWorkspacePagePreviewInput
  ): Promise<RenderWorkspacePagePreviewResult>;
  recordOutline(input: RecordOutlineInput): Promise<ProjectResult>;
  renderDeckHtml(input: RenderDeckHtmlInput): Promise<RenderDeckHtmlResult>;
  recordDeckReview(input: RecordDeckReviewInput): Promise<ProjectResult>;
  prepareExportModel(
    input: PrepareExportModelInput
  ): Promise<PrepareExportModelResult>;
  startPptxExportModel(input: StartPptxExportModelInput): Promise<PptxExportJob>;
  getPptxExportStatus(input: { workspace_dir: string }): Promise<PptxExportJob>;
  generatePptx(input: GeneratePptxInput): Promise<GeneratePptxResult>;
  startGeneratePptx(input: StartGeneratePptxInput): Promise<PptxExportJob>;
  exportPdf(input: ExportPdfInput): Promise<ExportPdfResult>;
  recordPptxExport(input: RecordPptxExportInput): Promise<WorkspaceResult>;
  recordPdfExport(input: RecordPdfExportInput): Promise<WorkspaceResult>;
  getExportArtifactDownloadUrl(
    input: GetExportArtifactDownloadUrlInput
  ): Promise<ExportArtifactDownloadUrlResult>;
}

export async function createPptBackend(): Promise<PptBackend> {
  const mode = detectRuntimeMode();

  if (mode === "anna") {
    return createAnnaPptBackend(await connectAnnaRuntime());
  }

  throw new Error("PptBackend is only available inside Anna runtime.");
}
