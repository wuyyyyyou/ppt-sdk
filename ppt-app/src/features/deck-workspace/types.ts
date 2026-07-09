import type { OutlineDetail, Slide } from "../../data/mockDeck";
import type {
  ListWorkspacesResult,
  PageProgress,
  GetStyleProfileResult,
  GetStyleProfilePreviewResult,
  StyleProfileIndexEntry,
  RenderDeckHtmlResult,
  TemplateSummary,
  UploadedSourceMaterial,
  WorkspaceStyleProfileSelection,
  WorkspaceResult,
  WorkspaceSettings
} from "../../api/types";
import type {
  DeckGenerationProgress,
  DeckGenerationStreamSnapshot
} from "../deck-generation";
import type { ActiveGenerationRun, GenerationViewState } from "./generationViewState";
import type { PageReviewSettings } from "./reviewSettings";
import type { ResearchSearchControlSettings } from "./researchSearchControl";

export type MainStage = "brief" | "uploaded-source-analysis" | "outline" | "generating" | "deck";
export type PageId = "main" | "library" | "review" | "refine" | "export" | "style-profile-creation";
export type PanelMode = "visible" | "minimized" | "closed";
export type RefineScope = "deck" | "slide";
export type PreviewMode = "grid" | "organize" | "present";
export type LoadingKind =
  | "none"
  | "template"
  | "context"
  | "theme"
  | "uploadedSourceAnalysis"
  | "deck"
  | "outline"
  | "deckFromOutline"
  | "upload"
  | "review"
  | "refineDeck"
  | "refineSlide"
  | "export";

export interface DeckReviewRenderState {
  status: "idle" | "loading" | "ready" | "error";
  result: RenderDeckHtmlResult | null;
  error: string;
  renderKey: string;
}

export interface ExportArtifact {
  type: "PPTX" | "PDF";
  path: string;
  href: string;
  fileName?: string;
}

export interface ExportProgressState {
  type: "PPTX" | "PDF" | null;
  mode: "idle" | "determinate" | "indeterminate" | "complete" | "error";
  message: string;
  percent: number;
  active: boolean;
}

export interface ContextRow {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "select" | "attachment";
  options?: string[];
  allowCustomValue?: boolean;
}

export interface DeckWorkspaceState {
  panelMode: PanelMode;
  page: PageId;
  stage: MainStage;
  toast: string;
  prompt: string;
  reviewOutlineFirst: boolean;
  pageReviewSettings: PageReviewSettings;
  researchSearchControlSettings: ResearchSearchControlSettings;
  contextRows: ContextRow[];
  deckTitle: string;
  deck: Slide[];
  outline: OutlineDetail[];
  outlineDraft: OutlineDetail[];
  outlineOutputLanguage: string;
  outlineDraftOutputLanguage: string;
  outlineEditMode: boolean;
  generated: boolean;
  currentSlide: number;
  outlineFeedback: string;
  previewMode: PreviewMode;
  reviewRender: DeckReviewRenderState;
  createDeckProgress: DeckGenerationProgress | null;
  uploadedSourceAnalysisProgress: UploadedSourceAnalysisProgress;
  generationHistory: GenerationStreamSnapshot[];
  pageProgress: PageProgress | null;
  refineScope: RefineScope;
  loading: LoadingKind;
  activeGenerationRun: ActiveGenerationRun | null;
  generationViewState: GenerationViewState;
  exportProgress: ExportProgressState;
  exportArtifact: ExportArtifact | null;
  currentStatus: string;
  workspaceScan: ListWorkspacesResult | null;
  currentWorkspace: WorkspaceResult | null;
  uploadedSources: UploadedSourceMaterial[];
  uploadedSourceAnalysisState: UploadedSourceAnalysisViewState;
  workspaceLoading: boolean;
  workspaceError: string;
  workspaceSettingsSaving: boolean;
  templateGroups: TemplateSummary[];
  selectedTemplateGroupId: string | null;
  styleProfiles: StyleProfileIndexEntry[];
  styleProfilePreviews: Record<string, GetStyleProfilePreviewResult | undefined>;
  selectedStyleProfile: WorkspaceStyleProfileSelection | null;
  styleProfileLibraryLoading: boolean;
  styleProfileLibraryError: string;
  styleProfileCreation: StyleProfileCreationViewState;
  styleProfileDetail: StyleProfileDetailState;
}

export type { WorkspaceSettings };

export type GenerationStreamSnapshot = DeckGenerationStreamSnapshot;

export type UploadedSourceAnalysisViewStatus =
  | "hidden"
  | "pending"
  | "stale"
  | "analyzing"
  | "ready"
  | "gap"
  | "blocked"
  | "error";

export interface UploadedSourceAnalysisViewState {
  status: UploadedSourceAnalysisViewStatus;
  sourceCount: number;
  factCount: number | null;
  visualAssetCount: number | null;
  gapCount: number | null;
  reason?: string;
}

export type UploadedSourceAnalysisRunStatus =
  | "idle"
  | "skipped"
  | "running"
  | "completed"
  | "blocked"
  | "failed";

export type UploadedSourceAnalysisRecordId = "prepare" | "factual" | "visual" | "merge";

export type UploadedSourceAnalysisRecordState =
  | "pending"
  | "active"
  | "completed"
  | "skipped"
  | "failed";

export interface UploadedSourceAnalysisRecord {
  id: UploadedSourceAnalysisRecordId;
  label: string;
  state: UploadedSourceAnalysisRecordState;
  activities: string[];
  lines: string[];
  summaryLines: string[];
  error?: string;
  started_at?: string;
  updated_at?: string;
}

export interface UploadedSourceAnalysisResultSummary {
  status: "ready" | "gap" | "blocked";
  factCount: number;
  visualAssetCount: number;
  gapCount: number;
  rejectedCount: number;
  reason: string;
}

export interface UploadedSourceAnalysisProgress {
  status: UploadedSourceAnalysisRunStatus;
  sourceCount: number;
  message: string;
  records: UploadedSourceAnalysisRecord[];
  resultSummary?: UploadedSourceAnalysisResultSummary;
}

export type StyleProfileCreationRunStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "stopped";

export type StyleProfileCreationStageId = "prepare" | "analyze" | "publish";

export interface StyleProfileCreationStageRecord {
  id: StyleProfileCreationStageId;
  label: string;
  state: "pending" | "active" | "completed" | "failed" | "stopped";
  summaryLines: string[];
  activities: string[];
  lines: string[];
  error?: string;
}

export interface StyleProfileCreationViewState {
  status: StyleProfileCreationRunStatus;
  displayName: string;
  files: File[];
  creationId: string;
  canRetryAnalysis: boolean;
  message: string;
  stages: StyleProfileCreationStageRecord[];
  createdStyleProfileId: string;
  error: string;
}

export interface StyleProfileDetailState {
  status: "closed" | "loading" | "ready" | "error";
  styleProfileId: string;
  detail: GetStyleProfileResult | null;
  error: string;
}
