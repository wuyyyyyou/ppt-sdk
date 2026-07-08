import {
  TASK_STATE_MACHINE_ARTIFACTS_FILE_NAME,
  TASK_STATE_MACHINE_CURRENT_PAGE_FILE_NAME,
  TASK_STATE_MACHINE_EVENTS_FILE_NAME,
  TASK_STATE_MACHINE_OUTLINE_FILE_NAME,
  TASK_STATE_MACHINE_PAGE_PLAN_FILE_NAME,
  TASK_STATE_MACHINE_PAGE_PROGRESS_FILE_NAME,
  TASK_STATE_MACHINE_REQUIREMENTS_FILE_NAME,
  TASK_STATE_MACHINE_STATE_FILE_NAME,
  TASK_STATE_MACHINE_TASK_FILE_NAME,
} from "../constants.js";
import type {
  TaskArtifactIndexRecord,
  TaskCurrentPageRecord,
  TaskOutlineRecord,
  TaskPagePlanRecord,
  TaskPageProgressRecord,
  TaskRequirementsRecord,
  TaskRuntimeStateRecord,
  TaskStateRecord,
} from "../types.js";
import {
  readJsonObject,
  readOptionalJsonObject,
  writeJsonObject,
} from "./json.js";
import { appendEventRecord, readEventRecords } from "./events.js";
import {
  resolveTaskStateFilePath,
} from "./paths.js";
import type { TaskStateMachineEventRecord } from "../types.js";

export function getTaskFilePath(projectDir: string): string {
  return resolveTaskStateFilePath(projectDir, TASK_STATE_MACHINE_TASK_FILE_NAME);
}

export function getStateFilePath(projectDir: string): string {
  return resolveTaskStateFilePath(projectDir, TASK_STATE_MACHINE_STATE_FILE_NAME);
}

export function getCurrentPageFilePath(projectDir: string): string {
  return resolveTaskStateFilePath(projectDir, TASK_STATE_MACHINE_CURRENT_PAGE_FILE_NAME);
}

export function getPagePlanFilePath(projectDir: string): string {
  return resolveTaskStateFilePath(projectDir, TASK_STATE_MACHINE_PAGE_PLAN_FILE_NAME);
}

export function getPageProgressFilePath(projectDir: string): string {
  return resolveTaskStateFilePath(projectDir, TASK_STATE_MACHINE_PAGE_PROGRESS_FILE_NAME);
}

export function getRequirementsFilePath(projectDir: string): string {
  return resolveTaskStateFilePath(projectDir, TASK_STATE_MACHINE_REQUIREMENTS_FILE_NAME);
}

export function getOutlineFilePath(projectDir: string): string {
  return resolveTaskStateFilePath(projectDir, TASK_STATE_MACHINE_OUTLINE_FILE_NAME);
}

export function getArtifactsFilePath(projectDir: string): string {
  return resolveTaskStateFilePath(projectDir, TASK_STATE_MACHINE_ARTIFACTS_FILE_NAME);
}

export function getEventsFilePath(projectDir: string): string {
  return resolveTaskStateFilePath(projectDir, TASK_STATE_MACHINE_EVENTS_FILE_NAME);
}

export async function readTaskRecord(projectDir: string): Promise<TaskStateRecord> {
  return readJsonObject<TaskStateRecord>(getTaskFilePath(projectDir));
}

export async function readOptionalTaskRecord(projectDir: string): Promise<TaskStateRecord | null> {
  return readOptionalJsonObject<TaskStateRecord>(getTaskFilePath(projectDir));
}

export async function writeTaskRecord(projectDir: string, record: TaskStateRecord): Promise<void> {
  await writeJsonObject(getTaskFilePath(projectDir), record);
}

export async function readStateRecord(projectDir: string): Promise<TaskRuntimeStateRecord> {
  return readJsonObject<TaskRuntimeStateRecord>(getStateFilePath(projectDir));
}

export async function readOptionalStateRecord(
  projectDir: string,
): Promise<TaskRuntimeStateRecord | null> {
  return readOptionalJsonObject<TaskRuntimeStateRecord>(getStateFilePath(projectDir));
}

export async function writeStateRecord(
  projectDir: string,
  record: TaskRuntimeStateRecord,
): Promise<void> {
  await writeJsonObject(getStateFilePath(projectDir), record);
}

export async function readCurrentPageRecord(
  projectDir: string,
): Promise<TaskCurrentPageRecord> {
  return readJsonObject<TaskCurrentPageRecord>(getCurrentPageFilePath(projectDir));
}

export async function readOptionalCurrentPageRecord(
  projectDir: string,
): Promise<TaskCurrentPageRecord | null> {
  return readOptionalJsonObject<TaskCurrentPageRecord>(getCurrentPageFilePath(projectDir));
}

export async function writeCurrentPageRecord(
  projectDir: string,
  record: TaskCurrentPageRecord,
): Promise<void> {
  await writeJsonObject(getCurrentPageFilePath(projectDir), record);
}

export async function readPagePlanRecord(
  projectDir: string,
): Promise<TaskPagePlanRecord> {
  return readJsonObject<TaskPagePlanRecord>(getPagePlanFilePath(projectDir));
}

export async function readOptionalPagePlanRecord(
  projectDir: string,
): Promise<TaskPagePlanRecord | null> {
  return readOptionalJsonObject<TaskPagePlanRecord>(getPagePlanFilePath(projectDir));
}

export async function writePagePlanRecord(
  projectDir: string,
  record: TaskPagePlanRecord,
): Promise<void> {
  await writeJsonObject(getPagePlanFilePath(projectDir), record);
}

export async function readPageProgressRecord(
  projectDir: string,
): Promise<TaskPageProgressRecord> {
  return readJsonObject<TaskPageProgressRecord>(getPageProgressFilePath(projectDir));
}

export async function readOptionalPageProgressRecord(
  projectDir: string,
): Promise<TaskPageProgressRecord | null> {
  return readOptionalJsonObject<TaskPageProgressRecord>(getPageProgressFilePath(projectDir));
}

export async function writePageProgressRecord(
  projectDir: string,
  record: TaskPageProgressRecord,
): Promise<void> {
  await writeJsonObject(getPageProgressFilePath(projectDir), record);
}

export async function readRequirementsRecord(
  projectDir: string,
): Promise<TaskRequirementsRecord> {
  return readJsonObject<TaskRequirementsRecord>(getRequirementsFilePath(projectDir));
}

export async function readOptionalRequirementsRecord(
  projectDir: string,
): Promise<TaskRequirementsRecord | null> {
  return readOptionalJsonObject<TaskRequirementsRecord>(getRequirementsFilePath(projectDir));
}

export async function writeRequirementsRecord(
  projectDir: string,
  record: TaskRequirementsRecord,
): Promise<void> {
  await writeJsonObject(getRequirementsFilePath(projectDir), record);
}

export async function readOutlineRecord(
  projectDir: string,
): Promise<TaskOutlineRecord> {
  return readJsonObject<TaskOutlineRecord>(getOutlineFilePath(projectDir));
}

export async function readOptionalOutlineRecord(
  projectDir: string,
): Promise<TaskOutlineRecord | null> {
  return readOptionalJsonObject<TaskOutlineRecord>(getOutlineFilePath(projectDir));
}

export async function writeOutlineRecord(
  projectDir: string,
  record: TaskOutlineRecord,
): Promise<void> {
  await writeJsonObject(getOutlineFilePath(projectDir), record);
}

export async function readArtifactsRecord(
  projectDir: string,
): Promise<TaskArtifactIndexRecord> {
  return readJsonObject<TaskArtifactIndexRecord>(getArtifactsFilePath(projectDir));
}

export async function readOptionalArtifactsRecord(
  projectDir: string,
): Promise<TaskArtifactIndexRecord | null> {
  return readOptionalJsonObject<TaskArtifactIndexRecord>(getArtifactsFilePath(projectDir));
}

export async function writeArtifactsRecord(
  projectDir: string,
  record: TaskArtifactIndexRecord,
): Promise<void> {
  await writeJsonObject(getArtifactsFilePath(projectDir), record);
}

export async function appendTaskEvent(
  projectDir: string,
  record: TaskStateMachineEventRecord,
): Promise<void> {
  await appendEventRecord(getEventsFilePath(projectDir), record);
}

export async function readTaskEvents(
  projectDir: string,
): Promise<TaskStateMachineEventRecord[]> {
  return readEventRecords(getEventsFilePath(projectDir));
}
