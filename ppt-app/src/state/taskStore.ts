import type { WorkflowStageId } from "../app/routes";

export interface TaskViewState {
  projectDir?: string;
  activeStage: WorkflowStageId;
}

export const initialTaskViewState: TaskViewState = {
  activeStage: "task"
};
