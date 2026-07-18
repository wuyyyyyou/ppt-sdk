export interface AppWorkspaceSummary {
  workspace_id: string;
  task_id: string;
  workspace_dir: string;
  task_dir: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AppWorkspaceFiles {
  task: string;
  setting: string;
  requirements: string;
  outline: string;
  manifest: string;
  style_guide: string;
  authoring_kit: string;
  page_plan: string;
  page_progress: string;
  pages: string;
  template: string;
  research_plan: string;
  research_evidence: string;
  research_status: string;
}

export interface AppPresentationRequirementCandidate {
  label: string;
  description: string;
}

export interface AppPresentationRequirementsCandidates {
  audience: AppPresentationRequirementCandidate[];
  purpose: AppPresentationRequirementCandidate[];
  desired_outcome: AppPresentationRequirementCandidate[];
  slide_count: number[];
  output_language: string[];
  visual_tone: AppPresentationRequirementCandidate[];
}

export interface AppPresentationRequirementsSelections {
  audience: AppPresentationRequirementCandidate | null;
  purpose: AppPresentationRequirementCandidate | null;
  desired_outcome: AppPresentationRequirementCandidate | null;
  slide_count: number | null;
  output_language: string | null;
  visual_tone: AppPresentationRequirementCandidate | null;
}

export interface AppPresentationRequirements {
  version: 1;
  status: "empty" | "draft" | "confirmed";
  source: { brief: string } | null;
  candidates: AppPresentationRequirementsCandidates;
  selections: AppPresentationRequirementsSelections;
  updated_at: string | null;
  confirmed_at: string | null;
}

export interface AppWorkspaceOutlineItem {
  page_id?: string;
  title: string;
  core_message: string;
  required_content: string;
}

export interface AppWorkspaceOutline {
  version: 3;
  title: string;
  status: "empty" | "draft" | "confirmed";
  items: AppWorkspaceOutlineItem[];
  updated_at: string | null;
  confirmed_at: string | null;
}

export interface AppPageContentPlan {
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

export interface AppWorkspaceResult {
  workspace_root: string;
  task_root: string;
  workspace_dir: string;
  task_dir: string;
  workspace_id: string;
  task_id: string;
  initialized: boolean;
  created_files: string[];
  missing_files: string[];
  files: AppWorkspaceFiles;
  task: unknown;
  setting: unknown;
  requirements: unknown;
  outline: unknown;
  page_plan: unknown;
  page_progress: unknown;
  pages: unknown;
  template: unknown;
}

export interface AppWorkspaceSettings {
  audience?: string;
  goal?: string;
  style_notes?: string;
  output_language?: string;
  text_density?: string;
  visual_tone?: string;
  theme_id?: string;
  page_generation_concurrency?: number;
  visual_review_enabled?: boolean;
  visual_review_failure_limit?: number;
  disable_web_research?: boolean;
  disable_image_research?: boolean;
  updated_at?: string;
  [key: string]: unknown;
}

export interface AppCreateWorkspaceSetting {
  page_generation_concurrency: number;
  visual_review_enabled: boolean;
  visual_review_failure_limit: number;
  disable_web_research: boolean;
  disable_image_research: boolean;
}

export interface CreateAppWorkspaceResult {
  version: 1;
  workspace_root: string;
  workspace_id: string;
  workspace_dir: string;
  title: string;
  setting: AppCreateWorkspaceSetting;
}

export type AppUploadedSourceStatus = "active" | "removed";

export interface AppUploadedSourceMaterial {
  uploaded_source_id: string;
  status: AppUploadedSourceStatus;
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

export interface AppUploadedSourceIndex {
  version: 1;
  workspace_dir: string;
  active_total_size_bytes: number;
  materials: AppUploadedSourceMaterial[];
  updated_at: string;
}

export interface UploadAppUploadedSourceInput {
  workspace_dir: string;
  filename: string;
  mime_type?: string;
  content_base64: string;
}

export interface UploadAppUploadedSourceResult {
  workspace_dir: string;
  material: AppUploadedSourceMaterial;
  index: AppUploadedSourceIndex;
  warnings: string[];
}

export interface BeginAppUploadedSourceUploadInput {
  workspace_dir: string;
  filename: string;
  mime_type?: string;
  size_bytes: number;
}

export interface BeginAppUploadedSourceUploadResult {
  workspace_dir: string;
  upload_id: string;
  upload_url: string;
  expires_at: string;
  size_bytes: number;
}

export interface CommitAppUploadedSourceUploadInput {
  workspace_dir: string;
  upload_id: string;
}

export interface CommitAppUploadedSourceUploadResult extends UploadAppUploadedSourceResult {
  upload_id: string;
}

export interface ListAppUploadedSourcesInput {
  workspace_dir: string;
  include_removed?: boolean;
}

export interface ListAppUploadedSourcesResult {
  workspace_dir: string;
  index: AppUploadedSourceIndex;
  active: AppUploadedSourceMaterial[];
  removed: AppUploadedSourceMaterial[];
  limits: {
    single_file_max_bytes: number;
    active_total_max_bytes: number;
  };
}

export interface RemoveAppUploadedSourceInput {
  workspace_dir: string;
  uploaded_source_id: string;
}

export interface RemoveAppUploadedSourceResult {
  workspace_dir: string;
  material: AppUploadedSourceMaterial;
  index: AppUploadedSourceIndex;
}

export interface AppUploadedSourceAnalysisPaths {
  root_dir: string;
  drafts_dir: string;
  factual_draft_path: string;
  visual_draft_path: string;
  analysis_path: string;
}

export interface PrepareAppUploadedSourceAnalysisWorkspaceInput {
  workspace_dir: string;
}

export interface PrepareAppUploadedSourceAnalysisWorkspaceResult extends AppUploadedSourceAnalysisPaths {
  workspace_dir: string;
  uploaded_source_index: AppUploadedSourceIndex;
  prepared_at: string;
}

export interface RecordAppUploadedSourceAnalysisDraftInput {
  workspace_dir: string;
  draft_type: "factual" | "visual";
  draft_id?: string;
  draft: unknown;
}

export interface GetAppUploadedSourceAnalysisDraftInput {
  workspace_dir: string;
  draft_type: "factual" | "visual";
  draft_id?: string;
}

export interface GetAppUploadedSourceAnalysisDraftFingerprintInput {
  workspace_dir: string;
  draft_type: "factual" | "visual";
  draft_id?: string;
}

export interface AppUploadedSourceAnalysisDraftFingerprint {
  workspace_dir: string;
  draft_type: "factual" | "visual";
  draft_id?: string;
  draft_path: string;
  exists: boolean;
  sha256?: string;
  size_bytes?: number;
}

export interface RecordAppUploadedSourceAnalysisInput {
  workspace_dir: string;
  analysis: unknown;
}

export interface GetAppUploadedSourceAnalysisInput {
  workspace_dir: string;
}

export interface AppStyleProfileIndexEntry {
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

export interface AppStyleProfileIndex {
  version: 1;
  library_dir: string;
  profiles: AppStyleProfileIndexEntry[];
  updated_at: string;
}

export interface ListAppStyleProfilesResult {
  library_dir: string;
  index: AppStyleProfileIndex;
  profiles: AppStyleProfileIndexEntry[];
}

export interface AppStyleProfileReferenceImagePreview {
  reference_image_id: string;
  file_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  order: number;
}

export interface GetAppStyleProfilePreviewInput {
  style_profile_id: string;
}

export interface GetAppStyleProfilePreviewResult {
  style_profile: AppStyleProfileIndexEntry;
  cover_image: AppStyleProfileReferenceImagePreview | null;
}

export interface GetAppStyleProfileInput {
  style_profile_id: string;
}

export interface GetAppStyleProfileResult {
  style_profile: AppStyleProfileIndexEntry;
  content: string;
  size_bytes: number;
  sha256: string;
  reference_images: AppStyleProfileReferenceImagePreview[];
}

export interface PrepareAppStyleProfileCreationInput {
  display_name?: string;
}

export interface AppStyleProfileCreationPaths {
  library_dir: string;
  creation_dir: string;
  uploads_dir: string;
  references_dir: string;
  rasterized_dir: string;
  draft_dir: string;
  draft_profile_path: string;
  manifest_path: string;
}

export interface PrepareAppStyleProfileCreationResult extends AppStyleProfileCreationPaths {
  creation_id: string;
  display_name: string;
  prepared_at: string;
}

export interface AppStyleProfileReferenceMaterial {
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

export interface AppReferenceSlideImage {
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

export interface AppStyleProfileCreationManifest {
  version: 1;
  creation_id: string;
  display_name: string;
  status: "prepared" | "uploaded" | "published";
  reference_materials: AppStyleProfileReferenceMaterial[];
  reference_images: AppReferenceSlideImage[];
  selected_reference_image_ids: string[];
  created_at: string;
  updated_at: string;
  published_style_profile_id?: string;
}

export interface CommitAppStyleProfileReferenceUploadInput {
  creation_id: string;
  upload_id: string;
  filename: string;
  mime_type?: string;
  staging_file_path: string;
  expected_size_bytes: number;
}

export interface CommitAppStyleProfileReferenceUploadResult {
  creation_id: string;
  upload_id: string;
  material: AppStyleProfileReferenceMaterial;
  manifest: AppStyleProfileCreationManifest;
  warnings: string[];
}

export interface GetAppStyleProfileCreationContextInput {
  creation_id: string;
}

export interface GetAppStyleProfileCreationContextResult extends AppStyleProfileCreationPaths {
  creation_id: string;
  manifest: AppStyleProfileCreationManifest;
  selected_reference_images: AppReferenceSlideImage[];
}

export interface AppStyleProfileDraftFingerprint {
  creation_id: string;
  draft_path: string;
  exists: boolean;
  sha256?: string;
  size_bytes?: number;
}

export interface GetAppStyleProfileDraftInput {
  creation_id: string;
}

export interface GetAppStyleProfileDraftFingerprintInput {
  creation_id: string;
}

export interface GetAppStyleProfileDraftResult {
  creation_id: string;
  draft_path: string;
  exists: boolean;
  content: string;
  size_bytes: number;
  sha256: string;
}

export interface PublishAppStyleProfileInput {
  creation_id: string;
  display_name?: string;
}

export interface PublishAppStyleProfileResult {
  style_profile: AppStyleProfileIndexEntry;
  index: AppStyleProfileIndex;
  profile_path: string;
  reference_count: number;
}

export interface SelectAppWorkspaceStyleProfileInput {
  workspace_dir: string;
  style_profile_id: string;
}

export interface AppWorkspaceStyleProfileSelection {
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

export interface SelectAppWorkspaceStyleProfileResult {
  workspace: AppWorkspaceResult;
  selection: AppWorkspaceStyleProfileSelection;
  content: string;
}

export interface GetAppWorkspaceStyleProfileInput {
  workspace_dir: string;
}

export interface GetAppWorkspaceStyleProfileResult {
  workspace_dir: string;
  selected: boolean;
  profile_path: string;
  selection_path: string;
  selection: AppWorkspaceStyleProfileSelection | null;
  content: string;
  size_bytes: number;
  sha256: string;
}

export interface ClearAppWorkspaceStyleProfileInput {
  workspace_dir: string;
}

export interface ClearAppWorkspaceStyleProfileResult {
  workspace: AppWorkspaceResult;
  cleared: boolean;
}

export interface ListAppWorkspacesResult {
  workspace_root: string;
  task_root: string;
  has_workspaces: boolean;
  has_tasks: boolean;
  latest_workspace: AppWorkspaceSummary | null;
  latest_task: AppWorkspaceSummary | null;
  workspaces: AppWorkspaceSummary[];
  tasks: AppWorkspaceSummary[];
}

export interface CreateAppWorkspaceInput {
  title?: string;
}

export interface OpenAppWorkspaceInput {
  workspace_dir: string;
}

export interface UpdateAppWorkspaceSettingsInput {
  workspace_dir: string;
  setting: AppWorkspaceSettings;
  persist_as_default?: boolean;
}

export interface PatchAppWorkspaceSettingsResult {
  workspace_dir: string;
  setting: AppWorkspaceSettings;
  persisted_as_default: boolean;
}

export interface GetAppWorkspaceDefaultsResult {
  workspace_root: string;
  setting: Record<string, unknown>;
}

export interface UpdateAppWorkspaceTitleInput {
  workspace_dir: string;
  title: string;
}

export interface GetAppWorkspaceOutlineInput {
  workspace_dir: string;
}

export interface GetAppWorkspaceRequirementsInput {
  workspace_dir: string;
}

export interface UpdateAppWorkspaceRequirementsInput {
  workspace_dir: string;
  requirements: unknown;
}

export interface ResetAppWorkspaceOutlineInput {
  workspace_dir: string;
}

export interface SaveAppWorkspaceOutlineDraftInput {
  workspace_dir: string;
  outline: {
    title: string;
    items: unknown;
  };
}

export interface ConfirmAppWorkspaceOutlineInput extends SaveAppWorkspaceOutlineDraftInput {}

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
  channel:
    | "ai-requirements"
    | "ai-requirements-interactions"
    | "ai-outline"
    | "ai-outline-interactions"
    | "ai-page-plan"
    | "ai-page-plan-interactions"
    | "ai-page-agent"
    | "ai-page-agent-interactions"
    | "ai-page-agent-stream"
    | "ai-research"
    | "ai-research-interactions"
    | "ai-theme"
    | "ai-theme-interactions";
  entry: Record<string, unknown>;
  payload_keys?: string[];
  inline_payload_max_bytes?: number;
}

export interface AppendAppWorkspaceLogResult {
  workspace_dir: string;
  log_file: string;
  appended: true;
}

export interface AppResearchPaths {
  root_dir: string;
  raw_dir: string;
  raw_web_dir: string;
  raw_images_dir: string;
  evidence_dir: string;
  evidence_pages_dir: string;
  evidence_images_dir: string;
  evidence_drafts_dir: string;
  research_plan_path: string;
  evidence_index_path: string;
  status_path: string;
}

export interface PrepareAppResearchWorkspaceInput {
  workspace_dir: string;
}

export interface PrepareAppResearchWorkspaceResult extends AppResearchPaths {
  workspace_dir: string;
  prepared_at: string;
}

export interface RecordAppResearchPlanInput {
  workspace_dir: string;
  research_plan: unknown;
}

export interface GetAppResearchPlanInput {
  workspace_dir: string;
}

export interface RecordAppResearchEvidenceInput {
  workspace_dir: string;
  evidence: unknown;
}

export interface RecordAppResearchEvidenceResult {
  workspace_dir: string;
  status: string;
  evidence_index_path: string;
  page_count: number;
  updated_at: string;
}

export interface RecordAppResearchEvidencePageInput {
  workspace_dir: string;
  page_evidence: unknown;
}

export interface RecordAppResearchEvidencePageResult {
  workspace_dir: string;
  page_id: string;
  status: string;
  evidence_index_path: string;
  page_count: number;
  updated_at: string;
}

export interface GetAppResearchEvidenceInput {
  workspace_dir: string;
}

export interface AppVisualResearchEvidence {
  id: string;
  file_path: string;
  original_raw_path?: string;
  image_url?: string;
  page_url?: string;
  sha256?: string;
  reason: string;
  visual_summary: string;
}

export interface AppResearchRejectedMaterial {
  source?: string;
  reason: string;
}

export interface FinalizeAppResearchVisualAssetsInput {
  workspace_dir: string;
  page_id: string;
  visual_assets: AppVisualResearchEvidence[];
  raw_image_index_paths?: string[];
}

export interface FinalizeAppResearchVisualAssetsResult {
  workspace_dir: string;
  page_id: string;
  visual_assets: AppVisualResearchEvidence[];
  gaps: string[];
  rejected_material: AppResearchRejectedMaterial[];
}

export interface RecordAppResearchCurationDraftInput {
  workspace_dir: string;
  page_id: string;
  draft_type: "web" | "visual";
  draft_id?: string;
  draft: unknown;
}

export interface GetAppResearchCurationDraftInput {
  workspace_dir: string;
  page_id: string;
  draft_type: "web" | "visual";
  draft_id?: string;
}

export interface GetAppResearchCurationDraftFingerprintInput {
  workspace_dir: string;
  page_id: string;
  draft_type: "web" | "visual";
  draft_id?: string;
}

export interface AppResearchCurationDraftFingerprint {
  workspace_dir: string;
  page_id: string;
  draft_type: "web" | "visual";
  draft_id?: string;
  draft_path: string;
  exists: boolean;
  sha256?: string;
  size_bytes?: number;
}

export interface RecordAppResearchEvidencePageMarkdownInput {
  workspace_dir: string;
  page_id: string;
  markdown: string;
}

export interface RecordAppResearchEvidencePageMarkdownResult {
  workspace_dir: string;
  page_id: string;
  markdown_path: string;
  updated_at: string;
}

export interface RecordAppResearchStatusInput {
  workspace_dir: string;
  status: unknown;
}

export interface RecordAppResearchStatusPageInput {
  workspace_dir: string;
  page_status: unknown;
}

export interface GetAppResearchStatusInput {
  workspace_dir: string;
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

export interface GetAppWorkspaceThemeContextInput {
  workspace_dir: string;
}

export interface AppWorkspaceThemeValidationResult {
  ok: boolean;
  errors: string[];
}

export interface AppWorkspaceThemeContext {
  workspace_dir: string;
  template_dir: string;
  token_path: string;
  schema_path: string;
  default_token_path: string;
  readme_path: string;
  schema: Record<string, unknown>;
  default_token: unknown;
  current_token: unknown | null;
  current_token_validation: AppWorkspaceThemeValidationResult | null;
  readme: string;
}

export interface ValidateAppWorkspaceThemeTokenInput {
  workspace_dir: string;
  token: unknown;
}

export interface RecordAppWorkspaceThemeTokenInput {
  workspace_dir: string;
  token?: unknown;
  use_default?: boolean;
}

export interface RecordAppWorkspaceThemeTokenResult {
  workspace: AppWorkspaceResult;
  workspace_dir: string;
  token_path: string;
  fallback_used: boolean;
  validation: AppWorkspaceThemeValidationResult;
  token: unknown;
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
  content_plan?: AppPageContentPlan;
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

export interface PrepareAppDeckRefinementPageFilesInput {
  workspace_dir: string;
  new_page_ids?: string[];
}

export interface PrepareAppDeckRefinementPageFilesResult extends PrepareAppPageFilesResult {
  new_page_ids: string[];
}

export interface GetAppWorkspacePageFileFingerprintsInput {
  workspace_dir: string;
  slide_path: string;
  data_path: string;
}

export interface AppWorkspacePageFileFingerprint {
  path: string;
  sha256: string;
  size_bytes: number;
}

export interface GetAppWorkspacePageFileFingerprintsResult {
  workspace_dir: string;
  slide: AppWorkspacePageFileFingerprint;
  data: AppWorkspacePageFileFingerprint;
}

export interface AppPageProgressItem {
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

export type AppPageProgressRecoveryRunKind =
  | "deck-generation"
  | "page-generation-retry"
  | "page-refinement"
  | "deck-refinement"
  | "final-deck-render";

export type AppPageProgressRecoveryStatus =
  | "idle"
  | "running"
  | "interrupted"
  | "failed"
  | "completed";

export interface AppPageProgressRecoveryState {
  status: AppPageProgressRecoveryStatus;
  run_kind: AppPageProgressRecoveryRunKind | null;
  step: string | null;
  target_page_ids: string[];
  page_refinement_request: string | null;
  page_refinement_requests: Record<string, string>;
  deck_refinement_review?: unknown | null;
  error: string | null;
  updated_at: string | null;
}

export type AppFinalDeckRenderStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "interrupted";

export interface AppFinalDeckRenderState {
  status: AppFinalDeckRenderStatus;
  message: string | null;
  error: string | null;
  output_dir: string | null;
  deck_html_path: string | null;
  rendered_at: string | null;
  updated_at: string | null;
}

export interface AppPageProgress {
  version: 1;
  status: string;
  recovery: AppPageProgressRecoveryState;
  final_deck_render: AppFinalDeckRenderState;
  research_discovery?: unknown;
  pages: AppPageProgressItem[];
  updated_at: string | null;
}

export interface GetAppPageProgressInput {
  workspace_dir: string;
}

export interface RecordAppPageProgressInput {
  workspace_dir: string;
  page_id?: string;
  patch: Record<string, unknown>;
}

export interface RenderAppWorkspacePagePreviewInput {
  workspace_dir: string;
  page_id: string;
}

export interface RenderAppWorkspacePagePreviewResult {
  workspace_dir: string;
  manifest_path: string;
  html_path: string;
  preview_url?: string;
  screenshot_path: string;
  screenshot_url?: string;
  page_index: number;
  page_number: number;
  slide_id: string;
  layout_id: string;
  title: string;
  rendered_at: string;
}

export interface RecordAppWorkspaceStyleGuideInput {
  workspace_dir: string;
  staging_file_path: string;
  expected_size_bytes: number;
}

export interface RecordAppWorkspaceStyleGuideResult {
  workspace_dir: string;
  style_guide_path: string;
  size_bytes: number;
  sha256: string;
  updated_at: string;
}

export interface GetAppWorkspaceStyleGuideStatusInput {
  workspace_dir: string;
}

export interface GetAppWorkspaceStyleGuideStatusResult {
  workspace_dir: string;
  style_guide_path: string;
  exists: boolean;
  non_empty: boolean;
  size_bytes: number;
  sha256?: string;
}

export interface InitializeAppPageProgressInput {
  workspace_dir: string;
}

export interface AppWorkspacePageItem {
  page_id: string;
  index: number;
  title: string;
  layout_id: string;
  html_path: string;
  screenshot_path?: string;
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
    screenshot_path: string;
    screenshot_url?: string;
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

export type AppPptxExportStatus =
  | "idle"
  | "preparing_model"
  | "model_ready"
  | "generating_pptx"
  | "completed"
  | "failed";

export interface AppPptxExportJob {
  version: 1;
  job_id: string;
  status: AppPptxExportStatus;
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

export interface StartAppPptxExportModelInput {
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

export interface GetAppExportArtifactInput {
  workspace_dir: string;
  artifact_type: "pptx" | "pdf";
}

export interface AppExportArtifactInfo {
  workspace_dir: string;
  workspace_id: string;
  title: string;
  artifact_type: "pptx" | "pdf";
  path: string;
  filename: string;
  updated_at: string | null;
}
