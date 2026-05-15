export const WORKFLOW_STAGES = [
  { id: "task", label: "Task" },
  { id: "requirements", label: "Requirements" },
  { id: "templates", label: "Templates" },
  { id: "outline", label: "Outline" },
  { id: "pages", label: "Pages" },
  { id: "review", label: "Review" },
  { id: "export", label: "Export" }
] as const;

export type WorkflowStageId = (typeof WORKFLOW_STAGES)[number]["id"];
