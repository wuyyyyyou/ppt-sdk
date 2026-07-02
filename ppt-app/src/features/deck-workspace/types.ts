import type { OutlineDetail, Slide } from "../../data/mockDeck";
import type {
  ListWorkspacesResult,
  PageProgress,
  RenderDeckHtmlResult,
  TemplateSummary,
  UploadedSourceMaterial,
  WorkspaceResult,
  WorkspaceSettings
} from "../../api/types";
import type {
  DeckGenerationProgress,
  DeckGenerationStreamSnapshot
} from "../deck-generation";
import type { ActiveGenerationRun, GenerationViewState } from "./generationViewState";
import type { PageReviewSettings } from "./reviewSettings";

export type MainStage = "brief" | "outline" | "generating" | "deck";
export type PageId = "main" | "library" | "review" | "refine" | "export";
export type PanelMode = "visible" | "minimized" | "closed";
export type RefineScope = "deck" | "slide";
export type PreviewMode = "grid" | "organize" | "present";
export type LoadingKind =
  | "none"
  | "template"
  | "context"
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
