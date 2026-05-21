import type {
  AppendWorkspaceLogInput,
  AppendWorkspaceLogResult,
  CreateProjectInput,
  CreateWorkspaceInput,
  GeneratePptxInput,
  GeneratePptxResult,
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
  ProjectResult,
  RecordDeckReviewInput,
  RecordPagePlanInput,
  RecordPageProgressInput,
  RecordPptxExportInput,
  RecordRequirementsInput,
  RecordOutlineInput,
  RenderDeckHtmlInput,
  RenderDeckHtmlResult,
  RenderWorkspacePagePreviewInput,
  RenderWorkspacePagePreviewResult,
  SelectTemplateInput,
  SelectTemplateResult,
  TemplatePlanningContext,
  UpdateWorkspaceSettingsInput,
  UpdateWorkspaceOutlineInput,
  UpdateWorkspaceTitleInput,
  WorkspaceOutline,
  WorkspaceResult
} from "./types";
import { createAnnaPptBackend } from "./annaPptBackend";
import { connectAnnaRuntime } from "../runtime/annaRuntime";
import { detectRuntimeMode } from "../runtime/runtimeMode";

export interface PptBackend {
  listWorkspaces(): Promise<ListWorkspacesResult>;
  createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceResult>;
  openWorkspace(input: OpenWorkspaceInput): Promise<WorkspaceResult>;
  appendWorkspaceLog(input: AppendWorkspaceLogInput): Promise<AppendWorkspaceLogResult>;
  getWorkspaceOutline(input: GetWorkspaceOutlineInput): Promise<WorkspaceOutline>;
  updateWorkspaceOutline(input: UpdateWorkspaceOutlineInput): Promise<WorkspaceResult>;
  updateWorkspaceSettings(
    input: UpdateWorkspaceSettingsInput
  ): Promise<WorkspaceResult>;
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
  generatePptx(input: GeneratePptxInput): Promise<GeneratePptxResult>;
  recordPptxExport(input: RecordPptxExportInput): Promise<ProjectResult>;
}

export async function createPptBackend(): Promise<PptBackend> {
  const mode = detectRuntimeMode();

  if (mode === "anna") {
    return createAnnaPptBackend(await connectAnnaRuntime());
  }

  throw new Error("PptBackend is only available inside Anna runtime.");
}
