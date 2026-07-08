import { randomUUID } from "node:crypto";
import path from "node:path";

import { listDiscoveredTemplateGroupSummaries } from "../../discovery/index.js";
import { forkTemplateGroup } from "../../fork/fork-template-group.js";
import type {
  TaskRuntimeStateRecord,
} from "../types.js";
import {
  appendTaskEvent,
  readOptionalStateRecord,
  readOptionalTaskRecord,
  writeStateRecord,
} from "../storage/records.js";

export interface RecordTemplateSelectionInput {
  projectDir: string;
  templateGroup: string;
  selectionReason?: string;
  source?: string;
}

export interface RecordTemplateSelectionResult {
  projectId: string;
  path: string;
  deckState: TaskRuntimeStateRecord["deckState"];
  selectedTemplateGroupId: string;
  selectedTemplateGroupName?: string;
  templateDir: string;
  manifestPath?: string;
  catalogJsonPath?: string;
  dataDirPath?: string;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function readTemplateGroup(input: RecordTemplateSelectionInput): string {
  const templateGroup = input.templateGroup.trim();
  if (templateGroup.length === 0) {
    throw new Error("Missing required parameter: template_group");
  }
  return templateGroup;
}

export async function recordTemplateSelection(
  input: RecordTemplateSelectionInput,
): Promise<RecordTemplateSelectionResult> {
  const task = await readOptionalTaskRecord(input.projectDir);
  if (!task) {
    throw new Error(`task.json not found in ${input.projectDir}`);
  }

  const state = await readOptionalStateRecord(input.projectDir);
  if (!state) {
    throw new Error(`state.json not found in ${input.projectDir}`);
  }

  const templateGroup = readTemplateGroup(input);
  const availableGroups = await listDiscoveredTemplateGroupSummaries({ include_builtin: true });
  const selectedGroup = availableGroups.find((group) => group.group_id === templateGroup);
  if (!selectedGroup) {
    throw new Error(`Template group not found: ${templateGroup}`);
  }

  const templateDir = path.join(input.projectDir, "template");
  const forkResult = await forkTemplateGroup({
    templateGroup: selectedGroup.group_id,
    outDir: templateDir,
    manifestTitle: task.title ?? selectedGroup.group_name,
    overwrite: true,
  });

  const updatedAt = nowIso();
  const nextState: TaskRuntimeStateRecord = {
    ...state,
    updatedAt,
    deckState: "project_forked",
    selectedTemplateGroupId: selectedGroup.group_id,
    selectedTemplateGroupName: selectedGroup.group_name,
    allowedTransitions: ["outline_ready"],
    blockedBy: [],
    recoverable: true,
  };
  await writeStateRecord(input.projectDir, nextState);

  await appendTaskEvent(input.projectDir, {
    eventId: randomUUID(),
    eventType: "template_group_selected",
    projectId: task.projectId,
    timestamp: updatedAt,
    actor: "agent",
    payload: {
      templateGroup: selectedGroup.group_id,
      templateGroupName: selectedGroup.group_name,
      selectionReason: input.selectionReason ?? null,
      source: input.source ?? "user",
    },
  });

  await appendTaskEvent(input.projectDir, {
    eventId: randomUUID(),
    eventType: "template_group_forked",
    projectId: task.projectId,
    timestamp: updatedAt,
    actor: "system",
    payload: {
      templateGroup: selectedGroup.group_id,
      templateGroupName: selectedGroup.group_name,
      outDir: forkResult.outDir,
      groupJsonPath: forkResult.groupJsonPath,
      manifestPath: forkResult.manifestPath,
      catalogJsonPath: forkResult.catalogJsonPath ?? null,
      dataDirPath: forkResult.dataDirPath ?? null,
      overwrite: true,
    },
  });

  return {
    projectId: task.projectId,
    path: input.projectDir,
    deckState: nextState.deckState,
    selectedTemplateGroupId: selectedGroup.group_id,
    selectedTemplateGroupName: selectedGroup.group_name,
    templateDir,
    manifestPath: forkResult.manifestPath,
    catalogJsonPath: forkResult.catalogJsonPath,
    dataDirPath: forkResult.dataDirPath,
    updatedAt,
  };
}
