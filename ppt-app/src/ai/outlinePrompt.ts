import type { AnnaLlmCompleteInput } from "../runtime/annaRuntime";
import type { WorkspaceSettings } from "../api/types";
import type { ContextRow } from "../features/deck-workspace/types";
import type { Locale } from "../i18n/messages";
import type { OutlineDetail } from "../data/mockDeck";
import {
  buildGenerateOutlineUserPrompt,
  buildOutlineRepairPrompt,
  buildOutlineSystemPrompt,
  buildReviseOutlineUserPrompt,
  type PromptLanguage,
} from "./outlinePromptMessages";

interface GenerateOutlinePromptInput {
  prompt: string;
  contextRows: ContextRow[];
  locale: Locale;
  setting?: WorkspaceSettings;
}

interface ReviseOutlinePromptInput {
  title?: string;
  outline: OutlineDetail[];
  feedback: string;
  locale: Locale;
  setting?: WorkspaceSettings;
}

function readSettingString(setting: WorkspaceSettings | undefined, key: string): string {
  const value = setting?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export function getExpectedSlideCount(setting?: WorkspaceSettings): number | null {
  const rawSlideCount = readSettingString(setting, "slide_count");
  if (!rawSlideCount || rawSlideCount.toLowerCase() === "auto") {
    return null;
  }

  const parsed = Number.parseInt(rawSlideCount, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildSettingSummary(setting?: WorkspaceSettings): Record<string, string> {
  return {
    audience: readSettingString(setting, "audience"),
    goal: readSettingString(setting, "goal"),
    style_notes: readSettingString(setting, "style_notes"),
    language: readSettingString(setting, "language"),
    output_language: readSettingString(setting, "output_language"),
    slide_count: readSettingString(setting, "slide_count") || "auto",
    text_density: readSettingString(setting, "text_density"),
    visual_tone: readSettingString(setting, "visual_tone"),
    aspect_ratio: readSettingString(setting, "aspect_ratio"),
  };
}

function getPromptLanguage(
  setting: WorkspaceSettings | undefined,
  locale: Locale
): PromptLanguage {
  const configuredLanguage = [
    readSettingString(setting, "output_language"),
    readSettingString(setting, "language"),
  ]
    .join(" ")
    .toLowerCase();

  if (
    configuredLanguage.includes("中文") ||
    configuredLanguage.includes("chinese") ||
    configuredLanguage.includes("zh")
  ) {
    return "zh";
  }

  if (
    configuredLanguage.includes("英文") ||
    configuredLanguage.includes("english") ||
    configuredLanguage.includes("en")
  ) {
    return "en";
  }

  return locale === "zh" ? "zh" : "en";
}

function buildGenerateUserPrompt(
  input: GenerateOutlinePromptInput,
  language: PromptLanguage
): string {
  return buildGenerateOutlineUserPrompt(language, {
    expectedSlideCount: getExpectedSlideCount(input.setting),
    locale: input.locale,
    settingSummaryJson: JSON.stringify(buildSettingSummary(input.setting)),
    prompt: input.prompt,
    contextRowsJson: JSON.stringify(input.contextRows),
  });
}

function buildReviseUserPrompt(
  input: ReviseOutlinePromptInput,
  language: PromptLanguage
): string {
  return buildReviseOutlineUserPrompt(language, {
    expectedSlideCount: getExpectedSlideCount(input.setting),
    locale: input.locale,
    settingSummaryJson: JSON.stringify(buildSettingSummary(input.setting)),
    title: input.title,
    feedback: input.feedback,
    outlineJson: JSON.stringify(input.outline),
  });
}

export function buildGenerateOutlineLlmRequest(
  input: GenerateOutlinePromptInput
): AnnaLlmCompleteInput {
  const language = getPromptLanguage(input.setting, input.locale);
  return {
    messages: [
      {
        role: "system",
        content: {
          type: "text",
          text: buildOutlineSystemPrompt(language),
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: buildGenerateUserPrompt(input, language),
        },
      },
    ],
    maxTokens: 1800,
  };
}

export function buildReviseOutlineLlmRequest(
  input: ReviseOutlinePromptInput
): AnnaLlmCompleteInput {
  const language = getPromptLanguage(input.setting, input.locale);
  return {
    messages: [
      {
        role: "system",
        content: {
          type: "text",
          text: buildOutlineSystemPrompt(language),
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: buildReviseUserPrompt(input, language),
        },
      },
    ],
    maxTokens: 1800,
  };
}

function getRepairPromptLanguage(request: AnnaLlmCompleteInput): PromptLanguage {
  const systemText = request.messages.find((message) => message.role === "system")
    ?.content.text;
  return systemText?.includes("资深演示文稿策划专家") ? "zh" : "en";
}

export function buildOutlineRepairRequest(
  previousRequest: AnnaLlmCompleteInput,
  rawResponse: string,
  errors: string[]
): AnnaLlmCompleteInput {
  const language = getRepairPromptLanguage(previousRequest);
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
          text: buildOutlineRepairPrompt(language, errors),
        },
      },
    ],
  };
}
