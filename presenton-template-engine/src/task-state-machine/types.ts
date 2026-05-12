export const TASK_STATE_MACHINE_DECK_STATES = [
  "initialized",
  "project_ready",
  "requirements_collected",
  "template_selected",
  "project_forked",
  "outline_ready",
  "page_plan_ready",
  "page_iteration_active",
  "deck_html_ready",
  "deck_review_pending",
  "deck_reviewed",
  "model_ready",
  "pptx_ready",
  "completed",
  "failed",
] as const;

export const TASK_STATE_MACHINE_PAGE_STATES = [
  "page_selected",
  "page_authoring",
  "page_review",
  "page_fix_required",
  "page_accepted",
  "page_locked",
] as const;

export const TASK_STATE_MACHINE_EVENT_TYPES = [
  "project_created",
  "project_opened",
  "requirements_recorded",
  "template_group_selected",
  "template_group_forked",
  "outline_recorded",
  "page_plan_recorded",
  "page_iteration_started",
  "page_selected",
  "page_authoring_started",
  "page_rendered",
  "page_reviewed",
  "page_fixed",
  "page_accepted",
  "page_locked",
  "artifact_recorded",
  "approval_recorded",
  "deck_review_feedback_recorded",
  "state_advanced",
  "state_rewound",
  "branch_created",
  "checkpoint_created",
  "project_completed",
  "error_recorded",
] as const;

export type TaskStateMachineDeckState = typeof TASK_STATE_MACHINE_DECK_STATES[number];
export type TaskStateMachinePageState = typeof TASK_STATE_MACHINE_PAGE_STATES[number];
export type TaskStateMachineEventType = typeof TASK_STATE_MACHINE_EVENT_TYPES[number];

export interface TaskStateMachineProjectPaths {
  projectDir: string;
  stateDir: string;
  templateDir: string;
  outputDir: string;
  notesDir: string;
}

export interface TaskStateMachineModuleContext {
  projectId: string;
  projectDir: string;
}

export interface TaskStateRecord {
  projectId: string;
  projectDir: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  status: TaskStateMachineDeckState;
  activeRevision: string;
  currentPageId?: string;
  completed: boolean;
}

export interface TaskRuntimeStateRecord {
  projectId: string;
  updatedAt: string;
  deckState: TaskStateMachineDeckState;
  pageState?: TaskStateMachinePageState;
  currentPageId?: string;
  selectedTemplateGroupId?: string;
  selectedTemplateGroupName?: string;
  blockedBy: string[];
  allowedTransitions: Array<TaskStateMachineDeckState | TaskStateMachinePageState>;
  allPagesLocked: boolean;
  recoverable: boolean;
}

export interface TaskCurrentPageRecord {
  projectId: string;
  updatedAt: string;
  pageId: string;
  pageNumber?: number;
  pageState: TaskStateMachinePageState;
  locked: boolean;
  lastRenderedHtmlPath?: string;
  lastRenderedPngPath?: string;
}

export interface TaskPageProgressItem {
  pageId: string;
  pageNumber?: number;
  pageState: TaskStateMachinePageState;
  locked: boolean;
  summary?: string;
  reviewNotes?: string;
  lastRenderedHtmlPath?: string;
  lastRenderedPngPath?: string;
  updatedAt: string;
}

export interface TaskPageProgressRecord {
  projectId: string;
  updatedAt: string;
  pages: TaskPageProgressItem[];
}

export interface TaskPagePlanItem {
  pageId: string;
  pageNumber: number;
  title: string;
  goal: string;
  coreMessage: string;
  dataPath?: string;
  suggestedExpression?: string;
  candidateComponentFamilies?: string[];
  openQuestions?: string[];
  blueprintId?: string;
  slidePath?: string;
  notes?: string[];
}

export interface TaskPagePlanRecord {
  projectId: string;
  updatedAt: string;
  pages: TaskPagePlanItem[];
}

export interface TaskRequirementsRecord {
  projectId: string;
  updatedAt: string;
  requirements: {
    topic: string;
    audience: string;
    scenario: string;
    pageCount: number;
    tone?: string;
    language?: string;
    mustCover?: string[];
  };
  source?: string;
}

export interface TaskOutlineRecord {
  projectId: string;
  updatedAt: string;
  outline: {
    narrative: string;
    sections: string[];
    pages: Array<{
      pageId: string;
      pageNumber: number;
      title: string;
      goal: string;
      coreMessage: string;
    }>;
  };
}

export interface TaskArtifactRecord {
  artifactId: string;
  type: string;
  path: string;
  pageId?: string | null;
  stage: string;
  revision?: string;
  valid: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface TaskArtifactIndexRecord {
  projectId: string;
  updatedAt: string;
  artifacts: TaskArtifactRecord[];
}

export type TaskPromoteKind = "deck" | "page" | "recovery";
export type TaskPromoteFreshness = "fresh" | "stale";

export interface TaskPromoteDocumentReference {
  kind: TaskPromoteKind;
  version: string;
  freshness: TaskPromoteFreshness;
  readBeforeAction: true;
  stage: string;
  path: string;
  entryPath: string;
  manifestPath: string;
  pageId?: string;
  pageNumber?: number;
}

export interface TaskPromoteManifestRecord {
  projectId: string;
  updatedAt: string;
  version: string;
  kind: TaskPromoteKind;
  deckState: TaskStateMachineDeckState;
  pageState?: TaskStateMachinePageState;
  currentPageId?: string;
  currentPath: string;
  documentPath: string;
  manifestPath: string;
  sourceUpdatedAt: string;
  sourceFiles: Record<string, string>;
}

export interface TaskStateMachineEventRecord {
  eventId: string;
  eventType: TaskStateMachineEventType;
  projectId: string;
  timestamp: string;
  actor: "agent" | "user" | "system" | string;
  payload: Record<string, unknown>;
}
