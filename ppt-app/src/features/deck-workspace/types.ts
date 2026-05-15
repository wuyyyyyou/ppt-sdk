import type { OutlineDetail, Slide } from "../../data/mockDeck";

export type MainStage = "brief" | "outline" | "deck";
export type PageId = "main" | "library" | "review" | "refine" | "export";
export type PanelMode = "visible" | "minimized" | "closed";
export type RefineScope = "deck" | "slide";
export type PreviewMode = "grid" | "organize" | "present";
export type LoadingKind =
  | "none"
  | "deck"
  | "outline"
  | "deckFromOutline"
  | "refineDeck"
  | "refineSlide"
  | "export";

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
  selectedLookId: string | null;
  lookPickerOpen: boolean;
  deckTitle: string;
  deck: Slide[];
  outline: OutlineDetail[];
  generated: boolean;
  currentSlide: number;
  expandedOutline: number | null;
  outlineFeedback: string;
  previewMode: PreviewMode;
  refineScope: RefineScope;
  loading: LoadingKind;
  exportStatus: string;
  currentStatus: string;
}
