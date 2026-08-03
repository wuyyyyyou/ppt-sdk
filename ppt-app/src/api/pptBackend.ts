import type {
  AppendWorkspaceLogInput,
  AppendWorkspaceLogResult,
  CreateProjectInput,
  CreateWorkspaceInput,
  CreateWorkspaceResult,
  DeleteWorkspaceResult,
  DuplicateWorkspaceInput,
  DuplicateWorkspacePageInput,
  DuplicateWorkspaceResult,
  GetExportArtifactDownloadUrlInput,
  GetWorkspacePageFileFingerprintsInput,
  GetWorkspacePageFileFingerprintsResult,
  GetPageEditContextInput,
  GetPageEditContextResult,
  HostUploadRef,
  GetWorkspaceCoverInput,
  GetWorkspaceCoverResult,
  GetWorkspacePageImageInput,
  GetWorkspacePageImageResult,
  GetWorkspaceOutlineInput,
  ListWorkspacesResult,
  ListTemplatesResult,
  PagePlan,
  PageProgress,
  PptEngineRuntimeInfo,
  PptAgentResourceInfo,
  OpenWorkspaceInput,
  PatchWorkspaceDefaultsInput,
  PrepareDeckRefinementPageFilesInput,
  PrepareDeckRefinementPageFilesResult,
  PreparePageFilesInput,
  PreparePageFilesResult,
  SharedResearchContextResult,
  SharedResearchProgressOperation,
  PatchSharedResearchProgressResult,
  PublishSharedResearchBatchResult,
  ImportSharedResearchImageResult,
  PrepareSharedResearchImageCandidateResult,
  UploadSharedResearchImageCandidateResult,
  CleanupSharedResearchImageStagingResult,
  ProjectResult,
  PptxExportJob,
  ExportPdfInput,
  ExportPdfResult,
  ExportArtifactDownloadUrlResult,
  PublishExportArtifactResult,
  PrepareWorkspaceDiagnosticBundleInput,
  PrepareWorkspaceDiagnosticBundleResult,
  RecordDeckReviewInput,
  RecordPagePlanInput,
  RecordPageProgressInput,
  RecordPdfExportInput,
  RecordRequirementsInput,
  RecordOutlineInput,
  RenderDeckHtmlInput,
  RenderDeckHtmlResult,
  RenderDeckHtmlSubmissionResult,
  RenderWorkspacePagePreviewInput,
  RenderWorkspacePagePreviewSubmissionResult,
  UploadCurrentPageScreenshotInput,
  SaveManualPageRevisionInput,
  SaveManualPageRevisionResult,
  CommitManagedFontUploadInput,
  CommitManagedFontUploadResult,
  ManagedFontRuntimeFamily,
  RestorePageSourceVersionResult,
  SelectTemplateInput,
  SelectTemplateResult,
  StartPptxExportInput,
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
  , ConfirmWorkspaceRequirementsInput
  , ConfirmWorkspaceRequirementsResult
  , WorkspaceStyleGuideStatus
  , WorkspaceStyleGuide
  , PreparePageRefinementInput
  , PreparePageRefinementResult
  , CommitDeckRefinementInput
  , CommitDeckRefinementResult
  , GenerationRunKind
  , GenerationRunTransaction
  , PrepareGenerationRunResult
  , CommitGenerationRunResult
  , PerformanceEvent
  , PerformanceRunSummary
  , ListPerformanceRunsResult
  , FinalizePerformanceRunResult
  , PreparePerformanceReportResult
} from "./types";
import { createAnnaPptBackend } from "./annaPptBackend";
import { connectAnnaRuntime } from "../runtime/annaRuntime";
import { detectRuntimeMode } from "../runtime/runtimeMode";

export interface PptBackend {
  getRuntimeInfo(): Promise<PptEngineRuntimeInfo>;
  getAgentResourceInfo(): Promise<PptAgentResourceInfo>;
  listPerformanceRuns(): Promise<ListPerformanceRunsResult>;
  startPerformanceRun(input: { app_version: string; environment?: Record<string, string | number | boolean | null>; initial_settings?: Record<string, unknown> }): Promise<PerformanceRunSummary>;
  appendPerformanceEvents(input: { run_id: string; events: PerformanceEvent[] }): Promise<{ appended: number; run: PerformanceRunSummary }>;
  finalizePerformanceRun(input: { run_id: string; locale: "en" | "zh"; force?: boolean }): Promise<FinalizePerformanceRunResult>;
  regeneratePerformanceReport(input: { run_id: string; locale: "en" | "zh" }): Promise<PerformanceRunSummary>;
  abandonPerformanceRun(input: { run_id: string }): Promise<PerformanceRunSummary>;
  deletePerformanceRun(input: { run_id: string }): Promise<{ deleted: true; run_id: string }>;
  preparePerformanceReport(input: { run_id: string }): Promise<PreparePerformanceReportResult>;
  beginGenerationRun(input: { workspace_dir: string; run_kind: GenerationRunKind; origin_page_id?: string | null }): Promise<GenerationRunTransaction>;
  prepareGenerationRun(input: { run_id: string }): Promise<PrepareGenerationRunResult>;
  abandonGenerationRun(input: { run_id: string }): Promise<GenerationRunTransaction>;
  commitGenerationRun(input: { run_id: string }): Promise<CommitGenerationRunResult>;
  cleanupGenerationRun(input: { run_id: string }): Promise<{ cleaned: true }>;
  getWorkspaceGenerationRun(input: { workspace_dir: string }): Promise<GenerationRunTransaction | null>;
  listWorkspaces(): Promise<ListWorkspacesResult>;
  getWorkspaceDefaults(): Promise<WorkspaceDefaultsResult>;
  patchWorkspaceDefaults(input: PatchWorkspaceDefaultsInput): Promise<WorkspaceDefaultsResult>;
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
  confirmWorkspaceRequirements(input: ConfirmWorkspaceRequirementsInput): Promise<ConfirmWorkspaceRequirementsResult>;
  getWorkspaceStyleGuideStatus(input: { workspace_dir: string }): Promise<WorkspaceStyleGuideStatus>;
  getWorkspaceStyleGuide(input: { workspace_dir: string }): Promise<WorkspaceStyleGuide>;
  initializePageProgress(input: { workspace_dir: string }): Promise<PageProgress>;
  preparePageRefinement(input: PreparePageRefinementInput): Promise<PreparePageRefinementResult>;
  commitDeckRefinement(input: CommitDeckRefinementInput): Promise<CommitDeckRefinementResult>;
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
  deleteWorkspace(input: { workspace_dir: string }): Promise<DeleteWorkspaceResult>;
  duplicateWorkspace(input: DuplicateWorkspaceInput): Promise<DuplicateWorkspaceResult>;
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
  prepareSharedResearchWorkspace(input: { workspace_dir: string; reset_progress?: boolean }): Promise<SharedResearchContextResult>;
  getSharedResearchContext(input: { workspace_dir: string }): Promise<SharedResearchContextResult>;
  patchSharedResearchProgress(input: { workspace_dir: string; operations: SharedResearchProgressOperation[] }): Promise<PatchSharedResearchProgressResult>;
  publishPreparedWebResearchBatch(input: { workspace_dir: string }): Promise<PublishSharedResearchBatchResult>;
  publishPreparedImageResearchBatch(input: { workspace_dir: string }): Promise<PublishSharedResearchBatchResult>;
  prepareSharedResearchImageCandidate(input: {
    workspace_dir: string;
    operation_id: string;
    candidate_id: string;
    source_url: string;
    existing_file_path?: string;
    expected_sha256?: string;
  }): Promise<PrepareSharedResearchImageCandidateResult>;
  uploadSharedResearchImageCandidate(input: {
    workspace_dir: string;
    operation_id: string;
    candidate_id: string;
    local_file_path: string;
    mime_type: string;
  }): Promise<UploadSharedResearchImageCandidateResult>;
  importSharedResearchImageLocal(input: {
    workspace_dir: string;
    candidate_id: string;
    local_file_path: string;
    mime_type: string;
    size_bytes: number;
    sha256: string;
  }): Promise<ImportSharedResearchImageResult>;
  cleanupSharedResearchImageStaging(input: {
    workspace_dir: string;
    operation_id: string;
  }): Promise<CleanupSharedResearchImageStagingResult>;
  getPageProgress(input: { workspace_dir: string }): Promise<PageProgress>;
  recordPageProgress(input: RecordPageProgressInput): Promise<PageProgress>;
  renderWorkspacePagePreview(
    input: RenderWorkspacePagePreviewInput
  ): Promise<RenderWorkspacePagePreviewSubmissionResult>;
  uploadCurrentPageScreenshot(input: UploadCurrentPageScreenshotInput): Promise<HostUploadRef>;
  getPageEditContext(input: GetPageEditContextInput): Promise<GetPageEditContextResult>;
  pinManagedFont(input: { workspace_dir: string; family: string }): Promise<ManagedFontRuntimeFamily>;
  commitManagedFontUpload(input: CommitManagedFontUploadInput): Promise<CommitManagedFontUploadResult>;
  saveManualPageRevision(input: SaveManualPageRevisionInput): Promise<SaveManualPageRevisionResult>;
  restorePageSourceVersion(input: GetPageEditContextInput): Promise<RestorePageSourceVersionResult>;
  recordOutline(input: RecordOutlineInput): Promise<ProjectResult>;
  getRenderedDeckHtml(input: RenderDeckHtmlInput): Promise<RenderDeckHtmlResult>;
  getWorkspaceCover(input: GetWorkspaceCoverInput): Promise<GetWorkspaceCoverResult>;
  getWorkspacePageImage(input: GetWorkspacePageImageInput): Promise<GetWorkspacePageImageResult>;
  renderDeckHtml(input: RenderDeckHtmlInput): Promise<RenderDeckHtmlSubmissionResult>;
  recordDeckReview(input: RecordDeckReviewInput): Promise<ProjectResult>;
  startPptxExport(input: StartPptxExportInput): Promise<PptxExportJob>;
  getPptxExportStatus(input: { workspace_dir: string }): Promise<PptxExportJob>;
  exportPdf(input: ExportPdfInput): Promise<ExportPdfResult>;
  recordPdfExport(input: RecordPdfExportInput): Promise<WorkspaceResult>;
  publishExportArtifact(
    input: GetExportArtifactDownloadUrlInput
  ): Promise<PublishExportArtifactResult>;
  getExportArtifactDownloadUrl(
    input: GetExportArtifactDownloadUrlInput
  ): Promise<ExportArtifactDownloadUrlResult>;
  prepareWorkspaceDiagnosticBundle(
    input: PrepareWorkspaceDiagnosticBundleInput
  ): Promise<PrepareWorkspaceDiagnosticBundleResult>;
}

export async function createPptBackend(): Promise<PptBackend> {
  const mode = detectRuntimeMode();

  if (mode === "anna") {
    return createAnnaPptBackend(await connectAnnaRuntime());
  }

  throw new Error("PptBackend is only available inside Anna runtime.");
}
