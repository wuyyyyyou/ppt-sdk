import type { AnnaLlmCompleteInput } from "../runtime/annaRuntime";
import type { WorkspaceSettings } from "../api/types";
import type { Locale } from "../i18n/messages";
import type { OutlineDetail } from "../data/mockDeck";
import type { LlmContextRow } from "./types";
import {
  buildGenerateOutlineUserPrompt,
  buildOutlineRepairPrompt,
  buildOutlineSystemPrompt,
  buildReviseOutlineUserPrompt,
} from "./outlinePromptMessages";

interface GenerateOutlinePromptInput {
  prompt: string;
  contextRows: LlmContextRow[];
  locale: Locale;
  setting?: WorkspaceSettings;
  uploadedSourceAnalysisContext?: unknown;
}

interface ReviseOutlinePromptInput {
  title?: string;
  outline: OutlineDetail[];
  feedback: string;
  locale: Locale;
  setting?: WorkspaceSettings;
  contextRows?: LlmContextRow[];
  uploadedSourceAnalysisContext?: unknown;
}

function readSettingString(setting: WorkspaceSettings | undefined, key: string): string {
  const value = setting?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function readContextRowString(contextRows: LlmContextRow[] | undefined, id: string): string {
  const row = contextRows?.find((item) => item.id === id);
  return typeof row?.value === "string" ? row.value.trim() : "";
}

export function getExpectedSlideCount(
  setting?: WorkspaceSettings,
  explicitCountText?: string,
  contextRows?: LlmContextRow[]
): number | null {
  void setting;
  void explicitCountText;
  void contextRows;
  return null;
}

export function getExpectedSlideCountForRevision(
  setting?: WorkspaceSettings,
  feedback?: string,
  contextRows?: LlmContextRow[]
): number | null {
  return getExpectedSlideCount(setting, undefined, contextRows);
}

function buildSettingSummary(
  setting?: WorkspaceSettings,
  contextRows?: LlmContextRow[]
): Record<string, string> {
  return {
    output_language: readSettingString(setting, "output_language"),
    slide_count: readContextRowString(contextRows, "slides") || "auto",
    text_density: readSettingString(setting, "text_density"),
    visual_tone: readSettingString(setting, "visual_tone"),
  };
}

function buildSlideCountContext(contextRows?: LlmContextRow[]): string {
  return readContextRowString(contextRows, "slides") || "auto";
}

function buildGenerateUserPrompt(input: GenerateOutlinePromptInput): string {
  return buildGenerateOutlineUserPrompt({
    slideCountContext: buildSlideCountContext(input.contextRows),
    locale: input.locale,
    settingSummaryJson: JSON.stringify(buildSettingSummary(input.setting, input.contextRows)),
    prompt: input.prompt,
    contextRowsJson: JSON.stringify(input.contextRows),
    uploadedSourceAnalysisContextJson: JSON.stringify(input.uploadedSourceAnalysisContext ?? null),
  });
}

function buildReviseUserPrompt(input: ReviseOutlinePromptInput): string {
  return buildReviseOutlineUserPrompt({
    slideCountContext: buildSlideCountContext(input.contextRows),
    locale: input.locale,
    settingSummaryJson: JSON.stringify(buildSettingSummary(input.setting, input.contextRows)),
    contextRowsJson: JSON.stringify(input.contextRows ?? []),
    uploadedSourceAnalysisContextJson: JSON.stringify(input.uploadedSourceAnalysisContext ?? null),
    title: input.title,
    feedback: input.feedback,
    outlineJson: JSON.stringify(input.outline),
  });
}

export function buildGenerateOutlineLlmRequest(
  input: GenerateOutlinePromptInput
): AnnaLlmCompleteInput {
  return {
    messages: [
      {
        role: "system",
        content: {
          type: "text",
          text: buildOutlineSystemPrompt(),
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: buildGenerateUserPrompt(input),
        },
      },
    ],
  };
}

export function buildReviseOutlineLlmRequest(
  input: ReviseOutlinePromptInput
): AnnaLlmCompleteInput {
  return {
    messages: [
      {
        role: "system",
        content: {
          type: "text",
          text: buildOutlineSystemPrompt(),
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: buildReviseUserPrompt(input),
        },
      },
    ],
  };
}

export function buildOutlineRepairRequest(
  previousRequest: AnnaLlmCompleteInput,
  rawResponse: string,
  errors: string[]
): AnnaLlmCompleteInput {
  return {
    ...previousRequest,
    messages: [
      ...previousRequest.messages,
      {
        role: "assistant",
        content: {
          type: "text",
          text: rawResponse,
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: buildOutlineRepairPrompt(errors),
        },
      },
    ],
  };
}
