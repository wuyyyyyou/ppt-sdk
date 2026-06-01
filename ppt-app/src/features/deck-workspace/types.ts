import type { OutlineDetail, Slide } from "../../data/mockDeck";
import type {
  ListWorkspacesResult,
  PageProgress,
  RenderDeckHtmlResult,
  TemplateSummary,
  WorkspaceResult,
  WorkspaceSettings
} from "../../api/types";
import type {
  DeckGenerationProgress,
  DeckGenerationStreamSnapshot
} from "../deck-generation";

export type MainStage = "brief" | "outline" | "generating" | "deck";
export type PageId = "main" | "library" | "review" | "refine" | "export";
export type PanelMode = "visible" | "minimized" | "closed";
export type RefineScope = "deck" | "slide";
export type PreviewMode = "grid" | "organize" | "present";
export type LoadingKind =
  | "none"
  | "template"
  | "deck"
  | "outline"
  | "deckFromOutline"
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

export interface ContextRow {
  id: string;
  label: string;
  value: string;
  type?: "text" | "select" | "attachment";
  options?: string[];
}

export interface DeckWorkspaceState {
  panelMode: PanelMode;
  page: PageId;
  stage: MainStage;
  toast: string;
  prompt: string;
  reviewOutlineFirst: boolean;
  contextRows: ContextRow[];
  deckTitle: string;
  deck: Slide[];
  outline: OutlineDetail[];
  outlineDraft: OutlineDetail[];
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
  exportStatus: string;
  exportArtifact: ExportArtifact | null;
  currentStatus: string;
  workspaceScan: ListWorkspacesResult | null;
  currentWorkspace: WorkspaceResult | null;
  workspaceLoading: boolean;
  workspaceError: string;
  workspaceSettingsSaving: boolean;
  templateGroups: TemplateSummary[];
  selectedTemplateGroupId: string | null;
}

export type { WorkspaceSettings };

export type GenerationStreamSnapshot = DeckGenerationStreamSnapshot;
