export interface ToolIds {
  pptEngine: string;
}

export interface HostUploadRef {
  transport: "host_upload";
  r2_key: string;
  url: string;
  mime_type: string;
  size_bytes: number;
  filename?: string;
  expires_at?: string;
  expires_in?: number;
  mode?: "negotiate+confirm";
}

export type GenerationRunKind = "deck-generation" | "page-refinement" | "deck-refinement";
export type GenerationRunState = "preparing" | "active" | "committing" | "committed" | "abandoned";
export interface GenerationRunTransaction {
  schema_version: 1;
  run_id: string;
  workspace_id: string;
  run_kind: GenerationRunKind;
  state: GenerationRunState;
  official_workspace_dir: string;
  shadow_workspace_dir: string;
  previous_workspace_dir: string;
  origin_page_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrepareGenerationRunResult {
  transaction: GenerationRunTransaction;
  workspace: WorkspaceResult | null;
}

export interface CommitGenerationRunResult {
  transaction: GenerationRunTransaction;
  workspace: WorkspaceResult;
}

export interface WorkspaceSummary {
  workspace_id: string;
  task_id?: string;
  workspace_dir: string;
  task_dir?: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  has_deck_html: boolean;
}

export interface WorkspaceFiles {
  task: string;
  setting: string;
  requirements: string;
  outline: string;
  manifest: string;
  style_guide: string;
  authoring_kit: string;
  page_plan?: string;
  page_progress: string;
  pages?: string;
  template?: string;
}

export interface WorkspaceResult {
  workspace_root: string;
  task_root?: string;
  workspace_dir: string;
  task_dir?: string;
  workspace_id: string;
  task_id?: string;
  initialized?: boolean;
  created_files?: string[];
  missing_files?: string[];
  files?: WorkspaceFiles;
  task: unknown;
  setting: unknown;
  requirements: PresentationRequirements;
  outline: unknown;
  page_plan?: unknown;
  page_progress?: unknown;
  pages?: unknown;
  template?: unknown;
}

export interface PresentationRequirementCandidate {
  label: string;
  description: string;
}

export interface PresentationRequirementsCandidates {
  audience: PresentationRequirementCandidate[];
  purpose: PresentationRequirementCandidate[];
  desired_outcome: PresentationRequirementCandidate[];
  slide_count: number[];
  output_language: string[];
  visual_tone: PresentationRequirementCandidate[];
}

export interface PresentationRequirementsSelections {
  audience: PresentationRequirementCandidate | null;
  purpose: PresentationRequirementCandidate | null;
  desired_outcome: PresentationRequirementCandidate | null;
  slide_count: number | null;
  output_language: string | null;
  visual_tone: PresentationRequirementCandidate | null;
  visual_style_preset?: VisualStylePresetSelection | null;
}

export interface VisualStylePresetPreview {
  url: string;
  alt: string;
}

export type VisualStylePresetTheme = "dark" | "light";

export type VisualStylePresetColor =
  | "black"
  | "white"
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "cyan"
  | "blue"
  | "purple"
  | "pink"
  | "brown"
  | "beige";

export interface VisualStylePreset {
  id: string;
  version: number;
  ppt_number: number;
  score?: number;
  theme: VisualStylePresetTheme;
  color: VisualStylePresetColor[];
  name: string;
  description: string;
  user: string;
  use_case: string;
  industry: string;
  style_guide: string;
  preview_images: VisualStylePresetPreview[];
}

export type VisualStylePresetSelection = Pick<VisualStylePreset, "id" | "version" | "name" | "description">;

export interface PresentationRequirements {
  version: 1;
  status: "empty" | "draft" | "confirmed";
  source: { brief: string } | null;
  candidates: PresentationRequirementsCandidates;
  selections: PresentationRequirementsSelections;
  updated_at: string | null;
  confirmed_at: string | null;
}

export type UploadedSourceStatus = "active" | "removed";

export interface UploadedSourceMaterial {
  uploaded_source_id: string;
  status: UploadedSourceStatus;
  original_filename: string;
  display_name: string;
  mime_type: string;
  extension: string;
  size_bytes: number;
  sha256: string;
  file_path: string;
  duplicate_of: string[];
  created_at: string;
  updated_at: string;
  removed_at?: string | null;
}

export interface UploadedSourceIndex {
  version: 1;
  workspace_dir: string;
  active_total_size_bytes: number;
  materials: UploadedSourceMaterial[];
  updated_at: string;
}

export interface UploadUploadedSourceResult {
  workspace_dir: string;
  material: UploadedSourceMaterial;
  index: UploadedSourceIndex;
  warnings: string[];
}

export interface CommitUploadedSourceHostUploadInput {
  workspace_dir: string;
  filename: string;
  mime_type?: string;
  size_bytes: number;
  host_upload: HostUploadRef;
}

export interface CommitUploadedSourceHostUploadResult extends UploadUploadedSourceResult {
  upload_id: string;
  host_upload: HostUploadRef;
}

export interface StyleProfileIndexEntry {
  version: 1;
  style_profile_id: string;
  display_name: string;
  profile_dir: string;
  profile_path: string;
  metadata_path: string;
  profile_sha256: string;
  size_bytes: number;
  reference_count: number;
  source_file_count: number;
  created_at: string;
  updated_at: string;
}

export interface StyleProfileIndex {
  version: 1;
  library_dir: string;
  profiles: StyleProfileIndexEntry[];
  updated_at: string;
}

export interface ListStyleProfilesResult {
  library_dir: string;
  index: StyleProfileIndex;
  profiles: StyleProfileIndexEntry[];
}

export interface StyleProfileReferenceImagePreview {
  reference_image_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  order: number;
  image_upload: HostUploadRef;
}

export interface GetStyleProfilePreviewResult {
  style_profile: StyleProfileIndexEntry;
  cover_image: StyleProfileReferenceImagePreview | null;
}

export interface GetStyleProfileResult {
  style_profile: StyleProfileIndexEntry;
  content: string;
  size_bytes: number;
  sha256: string;
  reference_images: StyleProfileReferenceImagePreview[];
}

export interface PrepareStyleProfileCreationInput {
  display_name?: string;
}

export interface StyleProfileCreationPaths {
  library_dir: string;
  creation_dir: string;
  uploads_dir: string;
  references_dir: string;
  rasterized_dir: string;
  draft_dir: string;
  draft_profile_path: string;
  manifest_path: string;
}

export interface PrepareStyleProfileCreationResult extends StyleProfileCreationPaths {
  creation_id: string;
  display_name: string;
  prepared_at: string;
}

export interface StyleProfileReferenceMaterial {
  reference_id: string;
  original_filename: string;
  display_name: string;
  mime_type: string;
  extension: string;
  size_bytes: number;
  sha256: string;
  file_path: string;
  kind: "pptx" | "image";
  created_at: string;
}

export interface ReferenceSlideImage {
  reference_image_id: string;
  source_reference_id: string;
  source_file_path: string;
  page_number: number | null;
  file_path: string;
  width: number | null;
  height: number | null;
  selected_for_analysis: boolean;
  order: number;
}

export interface StyleProfileCreationManifest {
  version: 1;
  creation_id: string;
  display_name: string;
  status: "prepared" | "uploaded" | "published";
  reference_materials: StyleProfileReferenceMaterial[];
  reference_images: ReferenceSlideImage[];
  selected_reference_image_ids: string[];
  created_at: string;
  updated_at: string;
  published_style_profile_id?: string;
}

export interface CommitStyleProfileReferenceUploadResult {
  creation_id: string;
  upload_id: string;
  material: StyleProfileReferenceMaterial;
  manifest: StyleProfileCreationManifest;
  warnings: string[];
}

export interface CommitStyleProfileReferenceHostUploadInput {
  creation_id: string;
  filename: string;
  mime_type?: string;
  size_bytes: number;
  host_upload: HostUploadRef;
}

export interface CommitStyleProfileReferenceHostUploadResult extends CommitStyleProfileReferenceUploadResult {
  host_upload: HostUploadRef;
}

export interface GetStyleProfileCreationContextResult extends StyleProfileCreationPaths {
  creation_id: string;
  manifest: StyleProfileCreationManifest;
  selected_reference_images: ReferenceSlideImage[];
}

export interface StyleProfileDraftFingerprint {
  creation_id: string;
  draft_path: string;
  exists: boolean;
  sha256?: string;
  size_bytes?: number;
}

export interface GetStyleProfileDraftResult {
  creation_id: string;
  draft_path: string;
  exists: boolean;
  content: string;
  size_bytes: number;
  sha256: string;
}

export interface PublishStyleProfileInput {
  creation_id: string;
  display_name?: string;
}

export interface PublishStyleProfileResult {
  style_profile: StyleProfileIndexEntry;
  index: StyleProfileIndex;
  profile_path: string;
  reference_count: number;
}

export interface WorkspaceStyleProfileSelection {
  version: 1;
  style_profile_id: string;
  display_name: string;
  source_profile_path: string;
  workspace_profile_path: string;
  selection_path: string;
  profile_sha256: string;
  size_bytes: number;
  selected_at: string;
}

export interface SelectWorkspaceStyleProfileResult {
  workspace: WorkspaceResult;
  selection: WorkspaceStyleProfileSelection;
  content: string;
}

export interface GetWorkspaceStyleProfileResult {
  workspace_dir: string;
  selected: boolean;
  profile_path: string;
  selection_path: string;
  selection: WorkspaceStyleProfileSelection | null;
  content: string;
  size_bytes: number;
  sha256: string;
}

export interface ClearWorkspaceStyleProfileResult {
  workspace: WorkspaceResult;
  cleared: boolean;
}

export interface ListUploadedSourcesResult {
  workspace_dir: string;
  index: UploadedSourceIndex;
  active: UploadedSourceMaterial[];
  removed: UploadedSourceMaterial[];
  limits: {
    single_file_max_bytes: number;
    active_total_max_bytes: number;
  };
}

export interface RemoveUploadedSourceInput {
  workspace_dir: string;
  uploaded_source_id: string;
}

export interface RemoveUploadedSourceResult {
  workspace_dir: string;
  material: UploadedSourceMaterial;
  index: UploadedSourceIndex;
}

export interface UploadedSourceAnalysisPaths {
  root_dir: string;
  drafts_dir: string;
  factual_draft_path: string;
  visual_draft_path: string;
  analysis_path: string;
}

export interface PrepareUploadedSourceAnalysisWorkspaceResult extends UploadedSourceAnalysisPaths {
  workspace_dir: string;
  uploaded_source_index: UploadedSourceIndex;
  prepared_at: string;
}

export type UploadedSourceAnalysisDraftType = "factual" | "visual";

export interface UploadedSourceAnalysisDraftFingerprint {
  workspace_dir: string;
  draft_type: UploadedSourceAnalysisDraftType;
  draft_id?: string;
  draft_path: string;
  exists: boolean;
  sha256?: string;
  size_bytes?: number;
}

export interface WorkspaceSettings {
  /** Legacy isolated setting; not persisted by authoring-kit-v1 Workspaces. */
  output_language?: string;
  /** Legacy isolated setting; not persisted by authoring-kit-v1 Workspaces. */
  text_density?: string;
  page_generation_concurrency?: number;
  research_image_session_concurrency?: number;
  visual_review_enabled?: boolean;
  visual_review_failure_limit?: number;
  disable_web_research?: boolean;
  disable_image_research?: boolean;
  updated_at?: string;
  [key: string]: unknown;
}

export type CreatedWorkspaceSetting = Required<
  Pick<
    WorkspaceSettings,
    | "page_generation_concurrency"
    | "research_image_session_concurrency"
    | "visual_review_enabled"
    | "visual_review_failure_limit"
    | "disable_web_research"
    | "disable_image_research"
  >
>;

export interface CreateWorkspaceResult {
  version: 1;
  workspace_root: string;
  workspace_id: string;
  workspace_dir: string;
  title: string;
  setting: CreatedWorkspaceSetting;
}

export interface WorkspaceOutlineItem {
  page_id?: string;
  title: string;
  core_message: string;
  required_content: string;
}

export interface WorkspaceOutline {
  version: 3;
  title: string;
  status: "empty" | "draft" | "confirmed";
  items: WorkspaceOutlineItem[];
  updated_at: string | null;
  confirmed_at: string | null;
  /** Temporary in-memory compatibility for downstream stages that have not been refactored yet. */
  output_language?: string;
  /** Temporary in-memory compatibility for downstream stages that have not been refactored yet. */
  source?: {
    prompt: string;
    context: unknown[];
    task_context?: unknown[];
    setting: Record<string, unknown>;
    kind?: string;
    uploaded_source_analysis?: UploadedSourceAnalysisDependency;
  };
}

export interface UploadedSourceAnalysisDependency {
  status: "ready" | "blocked" | "gap";
  updated_at: string;
  active_uploaded_sources: Array<{
    uploaded_source_id: string;
    sha256: string;
    size_bytes: number;
    file_path?: string;
  }>;
}

export interface WorkspacePageItem {
  page_id: string;
  index: number;
  title: string;
  layout_id: string;
  html_path: string;
  screenshot_path?: string;
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
  task_root?: string;
  has_workspaces: boolean;
  has_tasks?: boolean;
  latest_workspace: WorkspaceSummary | null;
  latest_task?: WorkspaceSummary | null;
  workspaces: WorkspaceSummary[];
  tasks?: WorkspaceSummary[];
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
  persist_as_default?: boolean;
}

export interface UpdateWorkspaceSettingsResult {
  workspace_dir: string;
  setting: WorkspaceSettings;
  persisted_as_default: boolean;
}

export interface WorkspaceDefaultsResult {
  workspace_root: string;
  setting: WorkspaceSettings;
}

export interface PptEngineRuntimeInfo {
  ppt_engine_version: string;
  performance_testing?: {
    supported: boolean;
    schema_version: number;
  };
}

export type PerformanceRunStatus = "recording" | "finalizing" | "completed" | "finalization_failed" | "abandoned";
export interface PerformanceContext {
  run_id: string;
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  operation_name?: string;
  workspace_id?: string;
}
export interface PerformanceEvent {
  schema_version: 1;
  event_id: string;
  event_type: "span.started" | "span.finished" | "button.interaction" | "data.loss";
  recorded_at: string;
  producer_id: string;
  sequence_number: number;
  trace_id?: string;
  span_id?: string;
  parent_span_id?: string;
  operation_name?: string;
  workspace_id?: string;
  duration_ms?: number;
  interaction_delay_ms?: number;
  feedback_delay_ms?: number;
  status?: "ok" | "error" | "interrupted";
  attributes?: Record<string, string | number | boolean | null>;
}
export interface PerformanceRunSummary {
  schema_version: 1;
  run_id: string;
  status: PerformanceRunStatus;
  data_integrity: "complete" | "degraded";
  started_at: string;
  updated_at: string;
  ended_at: string | null;
  report_locale: "en" | "zh" | null;
  report_status: "not_generated" | "generated" | "failed";
  report_error: string | null;
  app_version: string;
  environment: Record<string, string | number | boolean | null>;
  initial_settings: Record<string, unknown>;
  event_count: number;
  dropped_event_count: number;
  run_dir: string;
  report_available: boolean;
}
export interface ListPerformanceRunsResult {
  root_dir: string;
  active_run: PerformanceRunSummary | null;
  runs: PerformanceRunSummary[];
}
export interface FinalizePerformanceRunResult {
  run: PerformanceRunSummary;
  requires_force: boolean;
  active_span_count: number;
}
export interface PreparePerformanceReportResult {
  run: PerformanceRunSummary;
  report_upload: HostUploadRef;
}

export interface PatchWorkspaceDefaultsInput {
  setting: WorkspaceSettings;
}

export interface UpdateWorkspaceTitleInput {
  workspace_dir: string;
  title: string;
}

export interface DeleteWorkspaceResult {
  deleted: true;
  workspace_id: string;
  workspace_dir: string;
}

export interface DuplicateWorkspaceInput {
  workspace_dir: string;
  title?: string;
}

export interface DuplicateWorkspaceResult {
  version: 1;
  workspace_root: string;
  source_workspace_id: string;
  source_workspace_dir: string;
  workspace_id: string;
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

export interface ResetWorkspaceOutlineInput {
  workspace_dir: string;
}

export interface SaveWorkspaceOutlineInput {
  workspace_dir: string;
  outline: {
    title: string;
    items: WorkspaceOutlineItem[];
  };
}

export interface AppendWorkspaceLogInput {
  workspace_dir: string;
  channel:
    | "ai-requirements"
    | "ai-requirements-interactions"
    | "ai-outline"
    | "ai-outline-interactions"
    | "ai-style-guide"
    | "ai-style-guide-interactions"
    | "ai-page-plan"
    | "ai-page-plan-interactions"
    | "ai-page-agent"
    | "ai-page-agent-interactions"
    | "ai-page-agent-stream"
    | "ai-research"
    | "ai-research-interactions"
    | "research-web-interactions"
    | "ai-theme"
    | "ai-theme-interactions"
    | "storage-transport";
  entry: Record<string, unknown>;
  payload_keys?: string[];
  inline_payload_max_bytes?: number;
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

export interface WorkspaceThemeValidationResult {
  ok: boolean;
  errors: string[];
}

export interface WorkspaceThemeContext {
  workspace_dir: string;
  template_dir: string;
  token_path: string;
  schema_path: string;
  default_token_path: string;
  readme_path: string;
  schema: Record<string, unknown>;
  default_token: unknown;
  current_token: unknown | null;
  current_token_validation: WorkspaceThemeValidationResult | null;
  readme: string;
}

export interface RecordWorkspaceThemeTokenResult {
  workspace: WorkspaceResult;
  workspace_dir: string;
  token_path: string;
  fallback_used: boolean;
  validation: WorkspaceThemeValidationResult;
  token: unknown;
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
  content_plan?: PageContentPlan;
}

export interface PageContentPlan {
  main_message: string;
  content_points: string[];
  evidence_fact_ids: string[];
  derived_insight_ids: string[];
  visual_asset_ids: string[];
  uploaded_source_fact_ids?: string[];
  uploaded_source_visual_asset_ids?: string[];
  gaps: string[];
  authoring_notes: string[];
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

export interface PrepareDeckRefinementPageFilesInput {
  workspace_dir: string;
  new_page_ids?: string[];
}

export interface PrepareDeckRefinementPageFilesResult extends PreparePageFilesResult {
  new_page_ids: string[];
}

export interface PageFileFingerprint {
  path: string;
  sha256: string;
  size_bytes: number;
}

export interface GetWorkspacePageFileFingerprintsInput {
  workspace_dir: string;
  slide_path: string;
  data_path: string;
}

export interface GetWorkspacePageFileFingerprintsResult {
  workspace_dir: string;
  slide: PageFileFingerprint;
  data: PageFileFingerprint;
}

export type SharedResearchStageState = "waiting" | "running" | "completed" | "skipped" | "warning";

export interface SharedResearchImageCandidate {
  candidate_id: string;
  query: string;
  dedup_key?: string;
  representative_occurrence_id?: string;
  matched_occurrence_ids?: string[];
  matched_queries?: string[];
  image_url: string;
  thumbnail_url?: string | null;
  source_url: string;
  title?: string | null;
  width?: number | null;
  height?: number | null;
  use_in_ppt: boolean;
  description: string;
  reason: string;
  analysis_status?: "pending" | "running" | "completed" | "failed";
  file_path?: string;
  download_status: "pending" | "imported" | "failed";
  sha256?: string;
  mime_type?: string;
  bytes_size?: number;
  aps_path?: string;
  final_url?: string;
  content_duplicate_of?: string;
  error?: string;
}

export interface SharedResearchImageBatch {
  title: string;
  status: SharedResearchStageState;
  queries: Array<{
    query: string;
    status: SharedResearchStageState;
    candidate_count: number;
    message?: string;
  }>;
  candidates: SharedResearchImageCandidate[];
  gaps: string[];
  statistics?: {
    queries: number;
    candidates: number;
    raw_candidates?: number;
    unique_url_candidates?: number;
    duplicate_url_occurrences?: number;
    selected: number;
    imported: number;
    unique_content_imported?: number;
    failed: number;
    gaps: number;
  };
}

export interface SharedResearchImageAsset {
  asset_id: string;
  file_path: string;
  sha256: string;
  mime_type: string;
  bytes_size: number;
  width?: number;
  height?: number;
  description: string;
  reason: string;
  matched_queries: string[];
  source_url: string;
}

export interface SharedResearchImageCatalog {
  schema_version: 2;
  assets: SharedResearchImageAsset[];
}

export interface SharedResearchContextResult {
  workspace_dir: string;
  web_summary_path: string;
  image_catalog_path: string;
  images_dir: string;
  progress_path: string;
  web_summary: string;
  image_catalog: SharedResearchImageCatalog;
  progress: Record<string, unknown>;
}

export type SharedResearchStage =
  | "web_decision"
  | "web_research"
  | "image_decision"
  | "image_research"
  | "image_search"
  | "image_deduplication"
  | "image_analysis"
  | "image_import";

export type SharedResearchProgressOperation =
  | { op: "set_stage"; stage: SharedResearchStage; state: SharedResearchStageState }
  | { op: "set_web_decision"; decision: Record<string, unknown> }
  | { op: "upsert_web_search"; query: string; search: Record<string, unknown> }
  | { op: "set_web_fetch_result_ids"; result_ids: string[] }
  | { op: "upsert_web_fetched_page"; url: string; page: Record<string, unknown> }
  | { op: "set_web_prepared_batch"; markdown: string }
  | { op: "set_web_diagnostics"; gaps: string[]; diagnostic_errors: string[] }
  | { op: "set_image_decision"; decision: Record<string, unknown> }
  | { op: "upsert_image_search"; query: string; search: Record<string, unknown> }
  | { op: "set_image_work_status"; field: "search_status" | "analysis_status" | "import_status"; state: "waiting" | "running" | "completed" | "warning" }
  | { op: "upsert_image_deduplication_entry"; candidate_id: string; group: Record<string, unknown>; candidate: Record<string, unknown> }
  | { op: "set_image_deduplication_summary"; strategy: Record<string, unknown>; statistics: Record<string, unknown> }
  | { op: "upsert_image_analysis_batch"; batch_id: string; batch: Record<string, unknown>; candidates: Array<{ candidate_id: string; candidate: Record<string, unknown> }> }
  | { op: "upsert_image_candidate"; candidate_id: string; candidate: Record<string, unknown> }
  | { op: "set_image_diagnostics"; gaps: string[]; diagnostic_errors: string[] }
  | { op: "set_image_content_deduplication"; value: Record<string, unknown> }
  | { op: "finalize_image_research"; title: string; status: SharedResearchStageState; queries: Array<Record<string, unknown>>; gaps: string[]; statistics: Record<string, unknown> }
  | { op: "finalize_shared_research" };

export interface PatchSharedResearchProgressResult {
  workspace_dir: string;
  progress_path: string;
  updated: boolean;
  revision: number;
  updated_at: string;
}

export interface PublishSharedResearchBatchResult {
  workspace_dir: string;
  artifact_path: string;
  published: boolean;
  already_published: boolean;
  revision: number;
}

export interface ImportSharedResearchImageResult {
  workspace_dir: string;
  candidate_id: string;
  file_path: string;
  sha256: string;
  mime_type: string;
  bytes_size: number;
}

export interface PageProgressItem {
  page_id: string;
  status: string;
  render_attempts: number;
  visual_review_attempts: number;
  agent_failures: number;
  agent_infrastructure_failures: number;
  last_html_path: string;
  last_screenshot_path: string;
  last_error: string;
  visual_review?: unknown | null;
  updated_at: string | null;
}

export type PageProgressRecoveryRunKind =
  | "deck-generation"
  | "page-generation-retry"
  | "page-refinement"
  | "deck-refinement"
  | "final-deck-render";

export type PageProgressRecoveryStatus =
  | "idle"
  | "running"
  | "interrupted"
  | "failed"
  | "completed";

export interface PageProgressRecoveryState {
  status: PageProgressRecoveryStatus;
  run_kind: PageProgressRecoveryRunKind | null;
  step: string | null;
  target_page_ids: string[];
  refinement_request: string | null;
  page_refinement_reasons: Record<string, string>;
  error: string | null;
  updated_at: string | null;
}

export interface PreparePageRefinementInput {
  workspace_dir: string;
  page_id: string;
  refinement_request: string;
}

export interface PreparePageRefinementResult {
  workspace_dir: string;
  page_id: string;
  progress: PageProgress;
}

export type CommitDeckRefinementOperation =
  | { op: "keep"; page_id: string; reason: string }
  | { op: "update"; page_id: string; title: string; core_message: string; required_content: string[]; reason: string }
  | { op: "add"; title: string; core_message: string; required_content: string[]; reason: string }
  | { op: "delete"; page_id: string; reason: string };

export interface CommitDeckRefinementInput {
  workspace_dir: string;
  refinement_request: string;
  title: string;
  output_language_change: { changed: boolean; output_language?: string };
  style_guide_action: "preserve" | "regenerate";
  operations: CommitDeckRefinementOperation[];
  style_guide_upload?: {
    size_bytes: number;
    host_upload: HostUploadRef;
  };
}

export interface CommitDeckRefinementResult {
  workspace_dir: string;
  outline: WorkspaceOutline;
  progress: PageProgress;
  target_page_ids: string[];
  added_page_ids: string[];
  deleted_page_ids: string[];
}

export type FinalDeckRenderStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "interrupted";

export interface FinalDeckRenderState {
  status: FinalDeckRenderStatus;
  message: string | null;
  error: string | null;
  output_dir: string | null;
  deck_html_path: string | null;
  rendered_at: string | null;
  updated_at: string | null;
}

export type ResearchDiscoveryProgressPhase =
  | "web-decision"
  | "web-collection"
  | "visual-decision"
  | "visual-collection";

export type ResearchDiscoveryProgressState =
  | "waiting"
  | "running"
  | "completed"
  | "warning"
  | "skipped";

export interface ResearchDiscoveryProgressSource {
  title?: string;
  url?: string;
}

export interface ResearchDiscoveryProgressQuery {
  kind: "web" | "visual";
  query: string;
  status: "collected" | "gap" | "error" | "skipped_duplicate";
  resultCount?: number;
  fetchCount?: number;
  downloadCount?: number;
  message?: string;
  sources?: ResearchDiscoveryProgressSource[];
}

export interface ResearchDiscoveryProgressVisualAsset {
  id: string;
  filePath?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  pageUrl?: string;
  reason?: string;
  visualSummary?: string;
}

export interface ResearchDiscoveryProgressSummary {
  facts: number;
  derivedInsights: number;
  visualAssets: number;
  gaps: number;
  rejectedMaterial: number;
}

export interface ResearchDiscoveryProgressPhaseRecord {
  phase: ResearchDiscoveryProgressPhase;
  state: ResearchDiscoveryProgressState;
  iteration?: number;
  rationale?: string;
  queries?: ResearchDiscoveryProgressQuery[];
  sources?: ResearchDiscoveryProgressSource[];
  visualAssets?: ResearchDiscoveryProgressVisualAsset[];
  activities?: string[];
  lines?: string[];
  gaps?: string[];
  rejectedReasons?: string[];
  counts?: Partial<ResearchDiscoveryProgressSummary>;
  updatedAt?: string;
}

export interface ResearchDiscoveryProgress {
  status: ResearchDiscoveryProgressState;
  records: ResearchDiscoveryProgressPhaseRecord[];
  summary: ResearchDiscoveryProgressSummary;
  updatedAt?: string;
}

export interface PageProgress {
  version: 1;
  status: string;
  recovery?: PageProgressRecoveryState;
  final_deck_render?: FinalDeckRenderState;
  research_discovery?: ResearchDiscoveryProgress;
  pages: PageProgressItem[];
  updated_at: string | null;
}

export interface RecordPageProgressInput {
  workspace_dir: string;
  page_id?: string;
  patch: Record<string, unknown>;
}

export interface RenderWorkspacePagePreviewInput {
  workspace_dir: string;
  page_id: string;
}

export interface WorkspaceAuthoringKitResult {
  workspace_dir: string;
  authoring_kit_dir: string;
  manifest_path: string;
  slides_dir: string;
  installed: boolean;
}

export interface PrepareWorkspacePageSourcesResult {
  paths: Omit<WorkspaceAuthoringKitResult, "installed">;
  outline: WorkspaceOutline;
  manifest: { title: string; slides: Array<{ id: string; source: string }> };
  created_page_ids: string[];
}

export interface WorkspacePageSourceFingerprint {
  path: string;
  sha256: string;
  size_bytes: number;
}

export interface CommitWorkspaceStyleGuideHostUploadInput {
  workspace_dir: string;
  size_bytes: number;
  host_upload: HostUploadRef;
}

export interface ConfirmWorkspaceRequirementsInput {
  workspace_dir: string;
  requirements: PresentationRequirements;
  size_bytes?: number;
  host_upload?: HostUploadRef;
  clear_style_guide?: boolean;
}

export interface ConfirmWorkspaceRequirementsResult {
  workspace: WorkspaceResult;
  style_guide: CommitWorkspaceStyleGuideResult | null;
}

export interface CommitWorkspaceStyleGuideResult {
  workspace_dir: string;
  style_guide_path: string;
  size_bytes: number;
  sha256: string;
  updated_at: string;
}

export interface WorkspaceStyleGuideStatus {
  workspace_dir: string;
  style_guide_path: string;
  exists: boolean;
  non_empty: boolean;
  size_bytes: number;
  sha256?: string;
}

export interface WorkspaceStyleGuide extends WorkspaceStyleGuideStatus {
  content: string;
}

export interface RenderWorkspacePagePreviewResult {
  workspace_dir: string;
  manifest_path: string;
  html_path: string;
  screenshot_path: string;
  /** @deprecated Rendering no longer uploads; kept optional for compatibility with older callers. */
  screenshot_upload?: HostUploadRef;
  page_index: number;
  page_number: number;
  slide_id: string;
  layout_id: string;
  title: string;
  rendered_at: string;
}

export interface UploadCurrentPageScreenshotInput {
  workspace_dir: string;
  page_id: string;
}

export interface ManualPageRevisionManifest {
  version: 1;
  page_id: string;
  revision: number;
  manually_edited: true;
  base_source_sha256: string;
  base_html_sha256: string;
  current_html_sha256: string;
  base_html_path: string;
  current_html_path: string;
  agent_html_path: string;
  screenshot_path: string;
  updated_at: string;
}

export interface GetPageEditContextInput {
  workspace_dir: string;
  page_id: string;
}

export interface GetPageEditContextResult {
  workspace_dir: string;
  page_id: string;
  title: string;
  page_index: number;
  revision: number;
  manually_edited: boolean;
  html_path: string;
  screenshot_path: string;
  html_upload: HostUploadRef;
  screenshot_upload: HostUploadRef;
  manifest: ManualPageRevisionManifest | null;
}

export interface SaveManualPageRevisionInput {
  workspace_dir: string;
  page_id: string;
  base_revision: number;
  size_bytes: number;
  host_upload: HostUploadRef;
}

export interface SaveManualPageRevisionResult {
  workspace_dir: string;
  page_id: string;
  manifest: ManualPageRevisionManifest;
  screenshot_upload: HostUploadRef;
  final_deck_render_updated: boolean;
  final_deck_render_requires_rebuild: boolean;
  deck_html_path: string | null;
  rendered_at: string | null;
  page_progress_updated_at: string;
}

export interface RestorePageSourceVersionResult {
  workspace_dir: string;
  page_id: string;
  restored: true;
  html_path: string;
  screenshot_path: string;
  html_upload: HostUploadRef;
  screenshot_upload: HostUploadRef;
  final_deck_render_updated: boolean;
  final_deck_render_requires_rebuild: boolean;
  deck_html_path: string | null;
  rendered_at: string | null;
  page_progress_updated_at: string;
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
  deck_html_path: string;
  slides: Array<{
    slide_id: string;
    layout_id: string;
    title: string;
    html_path: string;
    screenshot_path?: string;
    screenshot_upload?: HostUploadRef;
    speaker_note: string;
    manually_edited?: boolean;
  }>;
  slide_count: number;
  title: string;
  rendered_at: string;
  diagnostics?: unknown;
}

export interface GetWorkspaceCoverInput {
  workspace_dir: string;
}

export interface GetWorkspaceCoverResult {
  version: 1;
  workspace_dir: string;
  page_id: string;
  source_path: string;
  cover_path: string;
  width: number | null;
  height: number | null;
  size_bytes: number;
  generated_at: string;
  cover_upload: HostUploadRef;
}

export interface GetWorkspacePageImageInput {
  workspace_dir: string;
  page_id: string;
  width?: number;
}

export interface GetWorkspacePageImageResult {
  version: 1;
  workspace_dir: string;
  page_id: string;
  page_index: number;
  page_status: string;
  source_path: string;
  image_path: string;
  width: number | null;
  height: number | null;
  size_bytes: number;
  generated_at: string;
  image_upload: HostUploadRef;
}

export interface RecordDeckReviewInput {
  projectDir: string;
  approved: boolean;
  feedback?: string;
}

export type PptxExportStatus =
  | "idle"
  | "queued"
  | "validating"
  | "converting"
  | "completed"
  | "failed";

export interface PptxExportJob {
  version: 2;
  job_id: string;
  status: PptxExportStatus;
  message: string;
  percent: number;
  workspace_dir: string;
  status_path: string;
  output_dir: string;
  deck_html_path: string;
  pptx_path: string;
  started_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  error: {
    message: string;
    stack?: string;
  } | null;
  warning_count: number;
}

export interface StartPptxExportInput {
  workspace_dir: string;
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

export interface ExportArtifactMirror {
  provider: "aps.files";
  scope: "user";
  path: string;
  etag: string;
  size_bytes: number;
  content_type: string;
  content_disposition: string;
  source_updated_at: string;
  source_sha256: string;
  published_at: string;
}

export interface ExportArtifactInfo {
  workspace_dir: string;
  workspace_id: string;
  title: string;
  artifact_type: "pptx" | "pdf";
  path: string;
  filename: string;
  updated_at: string;
  mirror: ExportArtifactMirror | null;
}

export interface PublishExportArtifactResult {
  status: "ready";
  artifact: ExportArtifactInfo;
  mirror: ExportArtifactMirror;
  published: boolean;
}

export type ExportArtifactDownloadUrlResult =
  | {
      status: "ready";
      reason: null;
      artifact: ExportArtifactInfo;
      mirror: ExportArtifactMirror;
      download_url: string;
      expires_at: string | null;
    }
  | {
      status: "missing" | "stale";
      reason: "mirror_missing" | "artifact_version_changed" | "source_hash_changed";
      artifact: ExportArtifactInfo;
      mirror: ExportArtifactMirror | null;
      download_url: null;
      expires_at: null;
    };

export interface PrepareWorkspaceDiagnosticBundleInput {
  workspace_dir: string;
}

export interface PrepareWorkspaceDiagnosticBundleResult {
  status: "ready";
  workspace_id: string;
  filename: string;
  size_bytes: number;
  download_url: string;
  expires_at: string | null;
  /** Object reference the Host can download directly; absent on older engines. */
  mirror?: {
    provider?: string;
    scope?: string;
    path?: string;
    content_type?: string;
    content_disposition?: string;
    size_bytes?: number;
  };
}
