import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  branchTaskProject,
  advanceTaskState,
  listTaskCheckpoints,
  rewindTaskState,
  type AdvanceTaskStateInput,
  type BranchTaskProjectInput,
  type RewindTaskStateInput,
} from "../actions/checkpoint.js";
import {
  createTaskProject,
  openTaskProject,
  type CreateTaskProjectInput,
  type OpenTaskProjectInput,
} from "../actions/project.js";
import {
  getRecommendedActionResult,
  getTaskStateQueryResult,
  type TaskStateQueryResult,
} from "../actions/query.js";
import {
  recordOutline,
  recordPagePlan,
  recordRequirements,
  type RecordOutlineInput,
  type RecordPagePlanInput,
  type RecordRequirementsInput,
} from "../actions/plan.js";
import {
  recordPageProgress,
  startPageIteration,
  type RecordPageProgressInput,
  type StartPageIterationInput,
} from "../actions/page.js";
import { recoverTaskProject, validateTaskProject } from "../recovery/index.js";

const FILE_TRANSPORT_DIRNAME = ".executa-file-transport";
const FILE_TRANSPORT_FALLBACK_DIR = path.join(
  os.tmpdir(),
  "presenton-template-engine-executa",
  "file-transport",
);

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcSuccessResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number | string | null;
  result: {
    success: true;
    data: T;
    tool: string;
  };
}

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  error: {
    code: number;
    message: string;
  };
}

export interface RpcToolResult {
  tool: string;
  data: unknown;
  forceFileTransport?: boolean;
}

type TransFileResponse = {
  jsonrpc: "2.0";
  id: number | string | null;
  __trans_file__: string;
};

function makeSuccessResponse<T>(id: JsonRpcRequest["id"], tool: string, data: T): JsonRpcSuccessResponse<T> {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    result: {
      success: true,
      data,
      tool,
    },
  };
}

function makeErrorResponse(
  id: JsonRpcRequest["id"],
  code: number,
  message: string,
): JsonRpcErrorResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readRequiredString(params: Record<string, unknown> | undefined, name: string): string {
  const value = params?.[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required parameter: ${name}`);
  }
  return value;
}

function readOptionalString(params: Record<string, unknown> | undefined, name: string): string | undefined {
  const value = params?.[name];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Parameter must be a non-empty string: ${name}`);
  }
  return value;
}

function readOptionalBoolean(
  params: Record<string, unknown> | undefined,
  name: string,
): boolean | undefined {
  const value = params?.[name];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`Parameter must be a boolean: ${name}`);
  }
  return value;
}

function readOptionalInteger(
  params: Record<string, unknown> | undefined,
  name: string,
): number | undefined {
  const value = params?.[name];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Parameter must be an integer: ${name}`);
  }
  return value;
}

async function writeLargeResponseToFile<T>(response: JsonRpcSuccessResponse<T>): Promise<string> {
  await mkdir(FILE_TRANSPORT_FALLBACK_DIR, { recursive: true });
  const filePath = path.join(
    FILE_TRANSPORT_FALLBACK_DIR,
    `executa-resp-${Date.now()}-${randomUUID()}.json`,
  );
  await writeFile(filePath, `${JSON.stringify(response, null, 2)}\n`, "utf8");
  return filePath;
}

async function maybeWrapResponse<T>(
  response: JsonRpcSuccessResponse<T>,
): Promise<JsonRpcSuccessResponse<T> | TransFileResponse> {
  const raw = JSON.stringify(response);
  if (Buffer.byteLength(raw, "utf8") <= 512 * 1024) {
    return response;
  }

  const filePath = await writeLargeResponseToFile(response);
  return {
    jsonrpc: "2.0",
    id: response.id,
    __trans_file__: filePath,
  };
}

export async function describeTaskStateMachine(): Promise<Record<string, unknown>> {
  return {
    name: "task-state-machine",
    display_name: "Task State Machine",
    version: "1.0.0",
    description: "Manage PPT task projects, page state, checkpoints, and recovery.",
    author: "OpenAI",
    tools: [
      {
        name: "create_task_project",
        description: "Create a new task project and initialize task-state files.",
        parameters: [
          { name: "project_dir", type: "string", required: true, description: "Absolute project directory." },
          { name: "title", type: "string", required: false, description: "Optional project title." },
          { name: "initial_request", type: "string", required: false, description: "Optional seed request." },
        ],
      },
      {
        name: "open_task_project",
        description: "Open an existing task project and read current task-state data.",
        parameters: [
          { name: "project_dir", type: "string", required: true, description: "Absolute project directory." },
        ],
      },
      {
        name: "query_task_state",
        description: "Query current state and recommended next action.",
        parameters: [
          { name: "project_dir", type: "string", required: true, description: "Absolute project directory." },
        ],
      },
      {
        name: "record_requirements",
        description: "Persist user requirements.",
        parameters: [
          { name: "project_dir", type: "string", required: true, description: "Absolute project directory." },
          { name: "requirements", type: "object", required: true, description: "Requirements payload." },
          { name: "source", type: "string", required: false, description: "Source of the requirements." },
        ],
      },
      {
        name: "record_outline",
        description: "Persist the content outline.",
        parameters: [
          { name: "project_dir", type: "string", required: true, description: "Absolute project directory." },
          { name: "outline", type: "object", required: true, description: "Outline payload." },
        ],
      },
      {
        name: "record_page_plan",
        description: "Persist or patch the page plan.",
        parameters: [
          { name: "project_dir", type: "string", required: true, description: "Absolute project directory." },
          { name: "mode", type: "string", required: true, description: "replace_all or update_page." },
          { name: "page_plan", type: "object", required: true, description: "Page plan payload." },
        ],
      },
      {
        name: "start_page_iteration",
        description: "Select a page and begin page-level authoring.",
        parameters: [
          { name: "project_dir", type: "string", required: true, description: "Absolute project directory." },
          { name: "page_id", type: "string", required: true, description: "Target page id." },
          { name: "page_number", type: "integer", required: false, description: "Optional page number." },
        ],
      },
      {
        name: "record_page_progress",
        description: "Persist one page progress state transition.",
        parameters: [
          { name: "project_dir", type: "string", required: true, description: "Absolute project directory." },
          { name: "page_id", type: "string", required: true, description: "Target page id." },
          { name: "page_state", type: "string", required: true, description: "Page state." },
          { name: "summary", type: "string", required: true, description: "Progress summary." },
          { name: "review_notes", type: "string", required: false, description: "Review notes." },
        ],
      },
      {
        name: "advance_task_state",
        description: "Advance deck state and create a checkpoint.",
        parameters: [
          { name: "project_dir", type: "string", required: true, description: "Absolute project directory." },
          { name: "target_deck_state", type: "string", required: false, description: "Target deck state." },
          { name: "target_page_state", type: "string", required: false, description: "Target page state." },
          { name: "reason", type: "string", required: true, description: "Advance reason." },
        ],
      },
      {
        name: "rewind_task_state",
        description: "Rewind to a prior checkpoint or safe deck state.",
        parameters: [
          { name: "project_dir", type: "string", required: true, description: "Absolute project directory." },
          { name: "target_state", type: "string", required: false, description: "Target deck state." },
          { name: "checkpoint_id", type: "string", required: false, description: "Checkpoint id." },
          { name: "reason", type: "string", required: true, description: "Rewind reason." },
        ],
      },
      {
        name: "branch_task_project",
        description: "Create a project branch from the current or specified checkpoint.",
        parameters: [
          { name: "project_dir", type: "string", required: true, description: "Absolute project directory." },
          { name: "checkpoint_id", type: "string", required: false, description: "Checkpoint id." },
          { name: "branch_name", type: "string", required: false, description: "Branch name." },
          { name: "reason", type: "string", required: true, description: "Branch reason." },
        ],
      },
      {
        name: "list_task_checkpoints",
        description: "List checkpoints and branches.",
        parameters: [
          { name: "project_dir", type: "string", required: true, description: "Absolute project directory." },
          { name: "include_branches", type: "boolean", required: false, description: "Whether to include branches." },
        ],
      },
      {
        name: "recover_task_project",
        description: "Recover a project by rebuilding missing or broken task-state files.",
        parameters: [
          { name: "project_dir", type: "string", required: true, description: "Absolute project directory." },
        ],
      },
      {
        name: "validate_task_project",
        description: "Validate task-state files without modifying them.",
        parameters: [
          { name: "project_dir", type: "string", required: true, description: "Absolute project directory." },
        ],
      },
    ],
    runtime: {
      type: "binary",
      min_version: "1.0.0",
    },
  };
}

async function handleCreateTaskProject(args: Record<string, unknown>) {
  return createTaskProject({
    projectDir: readRequiredString(args, "project_dir"),
    title: readOptionalString(args, "title"),
    initialRequest: readOptionalString(args, "initial_request"),
  } satisfies CreateTaskProjectInput);
}

async function handleOpenTaskProject(args: Record<string, unknown>) {
  return openTaskProject({
    projectDir: readRequiredString(args, "project_dir"),
  } satisfies OpenTaskProjectInput);
}

async function handleQueryTaskState(args: Record<string, unknown>) {
  const opened = await openTaskProject({
    projectDir: readRequiredString(args, "project_dir"),
  });
  return {
    snapshot: getTaskStateQueryResult(opened),
    recommendation: getRecommendedActionResult(opened),
  };
}

async function handleRecordRequirements(args: Record<string, unknown>) {
  return recordRequirements({
    projectDir: readRequiredString(args, "project_dir"),
    requirements: args.requirements as RecordRequirementsInput["requirements"],
    source: readOptionalString(args, "source"),
  });
}

async function handleRecordOutline(args: Record<string, unknown>) {
  return recordOutline({
    projectDir: readRequiredString(args, "project_dir"),
    outline: args.outline as RecordOutlineInput["outline"],
  });
}

async function handleRecordPagePlan(args: Record<string, unknown>) {
  return recordPagePlan({
    projectDir: readRequiredString(args, "project_dir"),
    mode: readRequiredString(args, "mode") as RecordPagePlanInput["mode"],
    pagePlan: args.page_plan as RecordPagePlanInput["pagePlan"],
  });
}

async function handleStartPageIteration(args: Record<string, unknown>) {
  return startPageIteration({
    projectDir: readRequiredString(args, "project_dir"),
    pageId: readRequiredString(args, "page_id"),
    pageNumber: readOptionalInteger(args, "page_number"),
  } satisfies StartPageIterationInput);
}

async function handleRecordPageProgress(args: Record<string, unknown>) {
  return recordPageProgress({
    projectDir: readRequiredString(args, "project_dir"),
    pageId: readRequiredString(args, "page_id"),
    pageState: readRequiredString(args, "page_state") as RecordPageProgressInput["pageState"],
    summary: readRequiredString(args, "summary"),
    reviewNotes: readOptionalString(args, "review_notes"),
    changedFiles: Array.isArray(args.changed_files) ? (args.changed_files as string[]) : undefined,
    renderedHtmlPath: readOptionalString(args, "rendered_html_path"),
    renderedPngPath: readOptionalString(args, "rendered_png_path"),
  } satisfies RecordPageProgressInput);
}

async function handleAdvanceTaskState(args: Record<string, unknown>) {
  return advanceTaskState({
    projectDir: readRequiredString(args, "project_dir"),
    targetDeckState: readOptionalString(args, "target_deck_state") as AdvanceTaskStateInput["targetDeckState"],
    targetPageState: readOptionalString(args, "target_page_state") as AdvanceTaskStateInput["targetPageState"],
    reason: readRequiredString(args, "reason"),
  });
}

async function handleRewindTaskState(args: Record<string, unknown>) {
  return rewindTaskState({
    projectDir: readRequiredString(args, "project_dir"),
    targetState: readOptionalString(args, "target_state") as RewindTaskStateInput["targetState"],
    checkpointId: readOptionalString(args, "checkpoint_id"),
    reason: readRequiredString(args, "reason"),
  });
}

async function handleBranchTaskProject(args: Record<string, unknown>) {
  return branchTaskProject({
    projectDir: readRequiredString(args, "project_dir"),
    checkpointId: readOptionalString(args, "checkpoint_id"),
    branchName: readOptionalString(args, "branch_name"),
    reason: readRequiredString(args, "reason"),
  } satisfies BranchTaskProjectInput);
}

async function handleListTaskCheckpoints(args: Record<string, unknown>) {
  return listTaskCheckpoints({
    projectDir: readRequiredString(args, "project_dir"),
    includeBranches: readOptionalBoolean(args, "include_branches"),
  });
}

async function handleRecoverTaskProject(args: Record<string, unknown>) {
  return recoverTaskProject(readRequiredString(args, "project_dir"));
}

async function handleValidateTaskProject(args: Record<string, unknown>) {
  return validateTaskProject(readRequiredString(args, "project_dir"));
}

const TOOL_DISPATCH = {
  create_task_project: handleCreateTaskProject,
  open_task_project: handleOpenTaskProject,
  query_task_state: handleQueryTaskState,
  record_requirements: handleRecordRequirements,
  record_outline: handleRecordOutline,
  record_page_plan: handleRecordPagePlan,
  start_page_iteration: handleStartPageIteration,
  record_page_progress: handleRecordPageProgress,
  advance_task_state: handleAdvanceTaskState,
  rewind_task_state: handleRewindTaskState,
  branch_task_project: handleBranchTaskProject,
  list_task_checkpoints: handleListTaskCheckpoints,
  recover_task_project: handleRecoverTaskProject,
  validate_task_project: handleValidateTaskProject,
};

export async function invokeTaskStateMachine(
  request: JsonRpcRequest,
): Promise<JsonRpcSuccessResponse<unknown> | JsonRpcErrorResponse | TransFileResponse> {
  if (!request || request.method !== "invoke") {
    return makeErrorResponse(request?.id, -32600, "Invalid request");
  }

  const params = request.params;
  if (!isRecord(params)) {
    return makeErrorResponse(request.id, -32602, "Missing params");
  }

  const tool = params.tool;
  if (typeof tool !== "string" || tool.length === 0) {
    return makeErrorResponse(request.id, -32602, "Missing required parameter: tool");
  }

  const handler = TOOL_DISPATCH[tool as keyof typeof TOOL_DISPATCH];
  if (!handler) {
    return makeErrorResponse(request.id, -32601, `Method not found: ${tool}`);
  }

  const argumentsValue = params.arguments;
  if (!isRecord(argumentsValue)) {
    return makeErrorResponse(request.id, -32602, "Missing required parameter: arguments");
  }

  try {
    const data = await handler(argumentsValue);
    const response = makeSuccessResponse(request.id, tool, data);
    return await maybeWrapResponse(response);
  } catch (error) {
    return makeErrorResponse(
      request.id,
      error instanceof Error && /missing|required|must be|invalid/i.test(error.message)
        ? -32602
        : -32603,
      error instanceof Error ? error.message : "Internal error",
    );
  }
}
