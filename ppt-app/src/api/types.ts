export interface ToolIds {
  pptEngine: string;
  pptGener: string;
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

export interface WorkspaceSummary {
  workspace_id: string;
  task_id?: string;
  workspace_dir: string;
  task_dir?: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
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
}

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
    | "ai-theme"
    | "ai-theme-interactions";
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

export interface ResearchCurationDraftFingerprint {
  workspace_dir: string;
  page_id: string;
  draft_type: "web" | "visual";
  draft_id?: string;
  draft_path: string;
  exists: boolean;
  sha256?: string;
  size_bytes?: number;
}

export interface ResearchPaths {
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

export interface PrepareResearchWorkspaceResult extends ResearchPaths {
  workspace_dir: string;
  prepared_at: string;
}

export interface RecordResearchEvidenceResult {
  workspace_dir: string;
  status: string;
  evidence_index_path: string;
  page_count: number;
  updated_at: string;
}

export interface RecordResearchEvidencePageResult {
  workspace_dir: string;
  page_id: string;
  status: string;
  evidence_index_path: string;
  page_count: number;
  updated_at: string;
}

export type ResearchSourceType = "user_provided" | "web_source" | "image_source";

export interface ResearchRequirement {
  page_id: string;
  index: number;
  title: string;
  web_research_needed: boolean;
  image_research_needed: boolean;
  query_intents: string[];
  image_query_intents: string[];
  evidence_needs: string[];
  visual_needs: string[];
  gap_strategy: string;
  reason: string;
}

export interface ResearchPlan {
  version: 1;
  status: "planned" | "empty" | "stale";
  title: string;
  source: {
    outline_updated_at: string | null;
    page_plan_updated_at: string | null;
    template_group: string;
    generated_by: string;
  };
  pages: ResearchRequirement[];
  shared: {
    web_research_needed: boolean;
    image_research_needed: boolean;
    query_intents: string[];
  };
  updated_at: string;
}

export interface ResearchEvidenceFact {
  id: string;
  claim: string;
  source_type: ResearchSourceType;
  source_title?: string;
  source_url?: string;
  source_file?: string;
  retrieved_at?: string;
  excerpt?: string;
  source_note?: string;
  confidence?: "low" | "medium" | "high";
}

export interface VisualResearchEvidence {
  id: string;
  /** Final Research Evidence must use a canonical absolute path under research/evidence/images. */
  file_path: string;
  /** Original selected Raw Research Material path, usually under research/raw/images. */
  original_raw_path?: string;
  image_url?: string;
  page_url?: string;
  sha256?: string;
  reason: string;
  visual_summary: string;
}

export interface ResearchDiscoveryEvidencePool {
  version: 1;
  status: "empty" | "partial" | "curated" | "gap";
  facts: ResearchEvidenceFact[];
  derived_insights: Array<{
    id: string;
    insight: string;
    supporting_fact_ids: string[];
  }>;
  visual_assets: VisualResearchEvidence[];
  gaps: string[];
  rejected_material: ResearchCurationRejectedMaterial[];
  source_summaries: Array<{
    id: string;
    kind: "web" | "visual";
    summary: string;
    source_count?: number;
    updated_at: string;
  }>;
  iterations: ResearchDiscoveryIterationRecord[];
  updated_at: string;
}

export interface ResearchDiscoveryIterationRecord {
  id: string;
  phase: "web" | "visual";
  iteration: number;
  status: "completed" | "gap" | "error";
  decision: ResearchDiscoveryDecision;
  query_summaries: ResearchDiscoveryQuerySummary[];
  draft_page_id?: string;
  curation_run_id?: string;
  gaps: string[];
  merged_counts: {
    facts: number;
    derived_insights: number;
    visual_assets: number;
    gaps: number;
    rejected_material: number;
  };
  completed_at: string;
}

export interface ResearchDiscoveryQuerySummary {
  kind: "web" | "visual";
  query: string;
  raw_index_path?: string;
  result_count?: number;
  fetch_count?: number;
  status: "collected" | "gap" | "error" | "skipped_duplicate";
  message?: string;
}

export interface ResearchDiscoveryDecision {
  action: "stop" | "search";
  phase: "web" | "visual";
  queries: string[];
  rationale: string;
  evidence_needs: string[];
  visual_needs: string[];
  gaps: string[];
}

export interface FinalizeResearchVisualAssetsResult {
  workspace_dir: string;
  page_id: string;
  visual_assets: VisualResearchEvidence[];
  gaps: string[];
  rejected_material: ResearchCurationRejectedMaterial[];
}

export interface ResearchEvidencePage {
  page_id: string;
  status: "curated" | "gap" | "error" | "skipped";
  facts: ResearchEvidenceFact[];
  visual_assets: VisualResearchEvidence[];
  derived_insights: Array<{
    id: string;
    insight: string;
    supporting_fact_ids: string[];
  }>;
  gaps: string[];
  rejected_material: Array<{
    source?: string;
    reason: string;
  }>;
  markdown_path?: string;
  updated_at: string;
}

export type ResearchCurationDraftStatus = "curated" | "gap" | "error" | "skipped";

export interface ResearchCurationRejectedMaterial {
  source?: string;
  reason: string;
}

export interface WebResearchCurationDraft {
  version: 1;
  page_id: string;
  curation_run_id?: string;
  draft_type?: "web";
  status: ResearchCurationDraftStatus;
  facts: ResearchEvidenceFact[];
  derived_insights: Array<{
    id: string;
    insight: string;
    supporting_fact_ids: string[];
  }>;
  gaps: string[];
  rejected_material: ResearchCurationRejectedMaterial[];
  source_summary?: string;
  updated_at: string;
}

export interface VisualResearchCurationDraft {
  version: 1;
  page_id: string;
  curation_run_id?: string;
  draft_type?: "visual";
  status: ResearchCurationDraftStatus;
  visual_assets: VisualResearchEvidence[];
  gaps: string[];
  rejected_material: ResearchCurationRejectedMaterial[];
  visual_summary?: string;
  updated_at: string;
}

export interface ResearchEvidenceIndex {
  version: 1;
  status: "empty" | "partial" | "curated";
  pages: ResearchEvidencePage[];
  shared: {
    facts: ResearchEvidenceFact[];
    visual_assets: VisualResearchEvidence[];
    gaps: string[];
  };
  discovery_pool?: ResearchDiscoveryEvidencePool;
  updated_at: string;
}

export interface ResearchStatus {
  version: 1;
  status: "idle" | "planning" | "collecting" | "curating" | "ready" | "gap" | "error";
  pages: Array<{
    page_id: string;
    status: string;
    message?: string;
    evidence_path?: string;
    updated_at?: string;
  }>;
  collection_ledger?: {
    version: 1;
    pages: Array<{
      page_id: string;
      web_queries: Array<{
        key: string;
        query: string;
        collected_at: string;
        raw_index_path?: string;
      }>;
      image_queries: Array<{
        key: string;
        query: string;
        collected_at: string;
        raw_index_path?: string;
      }>;
    }>;
  };
  updated_at: string;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

export interface WebSearchResult {
  query: string;
  provider: string;
  results: SearchResultItem[];
  count: number;
}

export interface WebFetchResult {
  output_dir: string;
  index_path: string;
  format: string;
  max_chars: number;
  results: Array<Record<string, unknown>>;
  count: number;
}

export interface ImageSearchResult {
  query: string;
  provider: string;
  results: Array<{
    title: string;
    image_url: string;
    thumbnail_url?: string;
    page_url?: string;
    width?: number;
    height?: number;
    source?: string;
  }>;
  count: number;
}

export interface ImageFetchResult {
  output_dir: string;
  index_path: string;
  max_bytes: number;
  results: Array<Record<string, unknown>>;
  count: number;
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
  | "web-curation"
  | "visual-decision"
  | "visual-collection"
  | "visual-curation"
  | "evidence-page-planning";

export type ResearchDiscoveryProgressState =
  | "pending"
  | "active"
  | "completed"
  | "warning"
  | "failed";

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
  screenshot_upload: HostUploadRef;
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
  slides: Array<{
    slide_id: string;
    layout_id: string;
    title: string;
    html_path: string;
    screenshot_path?: string;
    screenshot_upload?: HostUploadRef;
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
}
