import type {
  AppendWorkspaceLogInput,
  AppendWorkspaceLogResult,
  CreateProjectInput,
  CreateWorkspaceInput,
  CreateWorkspaceResult,
  DuplicateWorkspacePageInput,
  GeneratePptxInput,
  GeneratePptxResult,
  GetExportArtifactDownloadUrlInput,
  GetWorkspacePageFileFingerprintsInput,
  GetWorkspacePageFileFingerprintsResult,
  GetWorkspaceOutlineInput,
  ListWorkspacesResult,
  ListTemplatesResult,
  PagePlan,
  PageProgress,
  OpenWorkspaceInput,
  PrepareExportModelInput,
  PrepareExportModelResult,
  PrepareDeckRefinementPageFilesInput,
  PrepareDeckRefinementPageFilesResult,
  PreparePageFilesInput,
  PreparePageFilesResult,
  PrepareResearchWorkspaceResult,
  ProjectResult,
  PptxExportJob,
  ResearchEvidenceIndex,
  ResearchCurationDraftFingerprint,
  RecordResearchEvidenceResult,
  RecordResearchEvidencePageResult,
  VisualResearchCurationDraft,
  ResearchPlan,
  ResearchStatus,
  WebResearchCurationDraft,
  ExportPdfInput,
  ExportPdfResult,
  ExportArtifactDownloadUrlResult,
  PublishExportArtifactResult,
  FinalizeResearchVisualAssetsResult,
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
  WorkspaceThemeContext,
  WorkspaceThemeValidationResult,
  RecordWorkspaceThemeTokenResult,
  UpdateWorkspaceSettingsInput,
  UpdateWorkspaceSettingsResult,
  ResetWorkspaceOutlineInput,
  SaveWorkspaceOutlineInput,
  UpdateWorkspacePagesInput,
  UpdateWorkspaceTitleInput,
  CommitUploadedSourceHostUploadInput,
  CommitUploadedSourceHostUploadResult,
  ClearWorkspaceStyleProfileResult,
  CommitStyleProfileReferenceHostUploadInput,
  CommitStyleProfileReferenceHostUploadResult,
  GetStyleProfilePreviewResult,
  GetStyleProfileResult,
  GetStyleProfileCreationContextResult,
  StyleProfileDraftFingerprint,
  GetStyleProfileDraftResult,
  GetWorkspaceStyleProfileResult,
  ListStyleProfilesResult,
  PrepareStyleProfileCreationInput,
  PrepareStyleProfileCreationResult,
  PublishStyleProfileInput,
  PublishStyleProfileResult,
  SelectWorkspaceStyleProfileResult,
  ListUploadedSourcesResult,
  RemoveUploadedSourceInput,
  RemoveUploadedSourceResult,
  PrepareUploadedSourceAnalysisWorkspaceResult,
  PresentationRequirements,
  UploadedSourceAnalysisDraftFingerprint,
  UploadedSourceAnalysisDraftType,
  WorkspaceOutline,
  WorkspaceDefaultsResult,
  WorkspaceResult
  , WorkspaceAuthoringKitResult
  , PrepareWorkspacePageSourcesResult
  , WorkspacePageSourceFingerprint
  , CommitWorkspaceStyleGuideHostUploadInput
  , CommitWorkspaceStyleGuideResult
  , WorkspaceStyleGuideStatus
} from "./types";
import { createAnnaPptBackend } from "./annaPptBackend";
import { connectAnnaRuntime } from "../runtime/annaRuntime";
import { detectRuntimeMode } from "../runtime/runtimeMode";

export interface PptBackend {
  listWorkspaces(): Promise<ListWorkspacesResult>;
  getWorkspaceDefaults(): Promise<WorkspaceDefaultsResult>;
  createWorkspace(input: CreateWorkspaceInput): Promise<CreateWorkspaceResult>;
  openWorkspace(input: OpenWorkspaceInput): Promise<WorkspaceResult>;
  installWorkspaceAuthoringKit(input: { workspace_dir: string }): Promise<WorkspaceAuthoringKitResult>;
  prepareWorkspacePageSources(input: { workspace_dir: string; reset_existing?: boolean }): Promise<PrepareWorkspacePageSourcesResult>;
  reconcileWorkspacePageSources(input: { workspace_dir: string }): Promise<{
    paths: PrepareWorkspacePageSourcesResult["paths"];
    repaired_page_ids: string[];
    manifest: PrepareWorkspacePageSourcesResult["manifest"];
  }>;
  getWorkspacePageSourceFingerprint(input: { workspace_dir: string; page_id: string }): Promise<WorkspacePageSourceFingerprint>;
  commitWorkspaceStyleGuideHostUpload(input: CommitWorkspaceStyleGuideHostUploadInput): Promise<CommitWorkspaceStyleGuideResult>;
  getWorkspaceStyleGuideStatus(input: { workspace_dir: string }): Promise<WorkspaceStyleGuideStatus>;
  initializePageProgress(input: { workspace_dir: string }): Promise<PageProgress>;
  commitUploadedSourceHostUpload(input: CommitUploadedSourceHostUploadInput): Promise<CommitUploadedSourceHostUploadResult>;
  listStyleProfiles(): Promise<ListStyleProfilesResult>;
  getStyleProfilePreview(input: { style_profile_id: string }): Promise<GetStyleProfilePreviewResult>;
  getStyleProfile(input: { style_profile_id: string }): Promise<GetStyleProfileResult>;
  prepareStyleProfileCreation(input?: PrepareStyleProfileCreationInput): Promise<PrepareStyleProfileCreationResult>;
  commitStyleProfileReferenceHostUpload(input: CommitStyleProfileReferenceHostUploadInput): Promise<CommitStyleProfileReferenceHostUploadResult>;
  getStyleProfileCreationContext(input: { creation_id: string }): Promise<GetStyleProfileCreationContextResult>;
  getStyleProfileDraftFingerprint(input: { creation_id: string }): Promise<StyleProfileDraftFingerprint>;
  getStyleProfileDraft(input: { creation_id: string }): Promise<GetStyleProfileDraftResult>;
  publishStyleProfile(input: PublishStyleProfileInput): Promise<PublishStyleProfileResult>;
  selectWorkspaceStyleProfile(input: { workspace_dir: string; style_profile_id: string }): Promise<SelectWorkspaceStyleProfileResult>;
  getWorkspaceStyleProfile(input: { workspace_dir: string }): Promise<GetWorkspaceStyleProfileResult>;
  clearWorkspaceStyleProfile(input: { workspace_dir: string }): Promise<ClearWorkspaceStyleProfileResult>;
  listUploadedSources(input: { workspace_dir: string; include_removed?: boolean }): Promise<ListUploadedSourcesResult>;
  removeUploadedSource(input: RemoveUploadedSourceInput): Promise<RemoveUploadedSourceResult>;
  prepareUploadedSourceAnalysisWorkspace(input: { workspace_dir: string }): Promise<PrepareUploadedSourceAnalysisWorkspaceResult>;
  recordUploadedSourceAnalysisDraft(input: {
    workspace_dir: string;
    draft_type: UploadedSourceAnalysisDraftType;
    draft_id?: string;
    draft: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;
  getUploadedSourceAnalysisDraft(input: {
    workspace_dir: string;
    draft_type: UploadedSourceAnalysisDraftType;
    draft_id?: string;
  }): Promise<Record<string, unknown>>;
  getUploadedSourceAnalysisDraftFingerprint(input: {
    workspace_dir: string;
    draft_type: UploadedSourceAnalysisDraftType;
    draft_id?: string;
  }): Promise<UploadedSourceAnalysisDraftFingerprint>;
  recordUploadedSourceAnalysis(input: {
    workspace_dir: string;
    analysis: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;
  getUploadedSourceAnalysis(input: { workspace_dir: string }): Promise<Record<string, unknown>>;
  appendWorkspaceLog(input: AppendWorkspaceLogInput): Promise<AppendWorkspaceLogResult>;
  getWorkspaceRequirements(input: { workspace_dir: string }): Promise<PresentationRequirements>;
  updateWorkspaceRequirements(input: {
    workspace_dir: string;
    requirements: PresentationRequirements;
  }): Promise<WorkspaceResult>;
  getWorkspaceOutline(input: GetWorkspaceOutlineInput): Promise<WorkspaceOutline>;
  resetWorkspaceOutline(input: ResetWorkspaceOutlineInput): Promise<WorkspaceResult>;
  saveWorkspaceOutlineDraft(input: SaveWorkspaceOutlineInput): Promise<WorkspaceResult>;
  confirmWorkspaceOutline(input: SaveWorkspaceOutlineInput): Promise<WorkspaceResult>;
  updateWorkspaceSettings(
    input: UpdateWorkspaceSettingsInput
  ): Promise<UpdateWorkspaceSettingsResult>;
  updateWorkspacePages(input: UpdateWorkspacePagesInput): Promise<WorkspaceResult>;
  duplicateWorkspacePage(input: DuplicateWorkspacePageInput): Promise<WorkspaceResult>;
  updateWorkspaceTitle(input: UpdateWorkspaceTitleInput): Promise<WorkspaceResult>;
  createProject(input: CreateProjectInput): Promise<ProjectResult>;
  getProject(input: { projectDir: string }): Promise<ProjectResult>;
  recordRequirements(input: RecordRequirementsInput): Promise<ProjectResult>;
  listTemplates(): Promise<ListTemplatesResult>;
  selectTemplate(input: SelectTemplateInput): Promise<SelectTemplateResult>;
  getTemplatePlanningContext(input: { workspace_dir: string }): Promise<TemplatePlanningContext>;
  getWorkspaceThemeContext(input: { workspace_dir: string }): Promise<WorkspaceThemeContext>;
  validateWorkspaceThemeToken(input: { workspace_dir: string; token: unknown }): Promise<WorkspaceThemeValidationResult>;
  recordWorkspaceThemeToken(input: { workspace_dir: string; token?: unknown; use_default?: boolean }): Promise<RecordWorkspaceThemeTokenResult>;
  recordPagePlan(input: RecordPagePlanInput): Promise<PagePlan>;
  getPagePlan(input: { workspace_dir: string }): Promise<PagePlan>;
  preparePageFiles(input: PreparePageFilesInput): Promise<PreparePageFilesResult>;
  prepareDeckRefinementPageFiles(
    input: PrepareDeckRefinementPageFilesInput
  ): Promise<PrepareDeckRefinementPageFilesResult>;
  getWorkspacePageFileFingerprints(
    input: GetWorkspacePageFileFingerprintsInput
  ): Promise<GetWorkspacePageFileFingerprintsResult>;
  getResearchCurationDraftFingerprint(input: {
    workspace_dir: string;
    page_id: string;
    draft_type: "web" | "visual";
    draft_id?: string;
  }): Promise<ResearchCurationDraftFingerprint>;
  prepareResearchWorkspace(input: { workspace_dir: string }): Promise<PrepareResearchWorkspaceResult>;
  recordResearchPlan(input: { workspace_dir: string; research_plan: ResearchPlan }): Promise<ResearchPlan>;
  getResearchPlan(input: { workspace_dir: string }): Promise<ResearchPlan>;
  recordResearchEvidence(input: { workspace_dir: string; evidence: ResearchEvidenceIndex }): Promise<RecordResearchEvidenceResult>;
  recordResearchEvidencePage(input: {
    workspace_dir: string;
    page_evidence: Omit<ResearchEvidenceIndex["pages"][number], "updated_at"> & {
      updated_at?: string;
    };
  }): Promise<RecordResearchEvidencePageResult>;
  getResearchEvidence(input: { workspace_dir: string }): Promise<ResearchEvidenceIndex>;
  finalizeResearchVisualAssets(input: {
    workspace_dir: string;
    page_id: string;
    visual_assets: VisualResearchCurationDraft["visual_assets"];
    raw_image_index_paths?: string[];
  }): Promise<FinalizeResearchVisualAssetsResult>;
  recordResearchCurationDraft(input: {
    workspace_dir: string;
    page_id: string;
    draft_type: "web";
    draft_id?: string;
    draft: WebResearchCurationDraft;
  } | {
    workspace_dir: string;
    page_id: string;
    draft_type: "visual";
    draft_id?: string;
    draft: VisualResearchCurationDraft;
  }): Promise<WebResearchCurationDraft | VisualResearchCurationDraft>;
  getResearchCurationDraft(input: {
    workspace_dir: string;
    page_id: string;
    draft_type: "web" | "visual";
    draft_id?: string;
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
  recordResearchStatusPage(input: {
    workspace_dir: string;
    page_status: ResearchStatus["pages"][number];
  }): Promise<ResearchStatus>;
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
  getRenderedDeckHtml(input: RenderDeckHtmlInput): Promise<RenderDeckHtmlResult>;
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
  publishExportArtifact(
    input: GetExportArtifactDownloadUrlInput
  ): Promise<PublishExportArtifactResult>;
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
