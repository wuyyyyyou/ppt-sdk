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
  type PromptLanguage,
} from "./outlinePromptMessages";

interface GenerateOutlinePromptInput {
  prompt: string;
  contextRows: LlmContextRow[];
  locale: Locale;
  setting?: WorkspaceSettings;
}

interface ReviseOutlinePromptInput {
  title?: string;
  outline: OutlineDetail[];
  feedback: string;
  locale: Locale;
  setting?: WorkspaceSettings;
  contextRows?: LlmContextRow[];
}

function readSettingString(setting: WorkspaceSettings | undefined, key: string): string {
  const value = setting?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function readContextRowString(contextRows: LlmContextRow[] | undefined, id: string): string {
  const row = contextRows?.find((item) => item.id === id);
  return typeof row?.value === "string" ? row.value.trim() : "";
}

function parseChineseInteger(value: string): number | null {
  const digits: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };

  if (value === "十") return 10;
  if (value.startsWith("十")) {
    const tail = value.slice(1);
    return 10 + (digits[tail] ?? 0);
  }
  if (value.endsWith("十")) {
    const head = value.slice(0, -1);
    return (digits[head] ?? 0) * 10;
  }
  if (value.includes("十")) {
    const [head, tail] = value.split("十");
    return (digits[head] ?? 0) * 10 + (digits[tail] ?? 0);
  }

  return digits[value] ?? null;
}

function parseExplicitSlideCount(text?: string): number | null {
  if (!text) return null;

  const digitMatch = text.match(/(?:^|[^\d])(\d{1,2})\s*(?:页|张|slides?|pages?)/i);
  if (digitMatch) {
    const parsed = Number.parseInt(digitMatch[1], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  const chineseMatch = text.match(/([一二两三四五六七八九十]{1,3})\s*(?:页|张)/);
  if (chineseMatch) {
    return parseChineseInteger(chineseMatch[1]);
  }

  return null;
}

export function getExpectedSlideCount(
  setting?: WorkspaceSettings,
  explicitCountText?: string,
  contextRows?: LlmContextRow[]
): number | null {
  const rawSlideCount = readContextRowString(contextRows, "slides");
  if (!rawSlideCount || rawSlideCount.toLowerCase() === "auto") {
    return parseExplicitSlideCount(explicitCountText);
  }

  const parsed = Number.parseInt(rawSlideCount, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getExpectedSlideCountForRevision(
  setting?: WorkspaceSettings,
  feedback?: string,
  contextRows?: LlmContextRow[]
): number | null {
  return parseExplicitSlideCount(feedback) ?? getExpectedSlideCount(setting, undefined, contextRows);
}

function buildSettingSummary(
  setting?: WorkspaceSettings,
  contextRows?: LlmContextRow[]
): Record<string, string> {
  return {
    language: readSettingString(setting, "language"),
    output_language: readSettingString(setting, "output_language"),
    slide_count: readContextRowString(contextRows, "slides") || "auto",
    text_density: readSettingString(setting, "text_density"),
    visual_tone: readSettingString(setting, "visual_tone"),
    typography: readSettingString(setting, "typography"),
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
    expectedSlideCount: getExpectedSlideCount(input.setting, input.prompt, input.contextRows),
    locale: input.locale,
    settingSummaryJson: JSON.stringify(buildSettingSummary(input.setting, input.contextRows)),
    prompt: input.prompt,
    contextRowsJson: JSON.stringify(input.contextRows),
  });
}

function buildReviseUserPrompt(
  input: ReviseOutlinePromptInput,
  language: PromptLanguage
): string {
  return buildReviseOutlineUserPrompt(language, {
    expectedSlideCount: getExpectedSlideCountForRevision(input.setting, input.feedback, input.contextRows),
    locale: input.locale,
    settingSummaryJson: JSON.stringify(buildSettingSummary(input.setting, input.contextRows)),
    contextRowsJson: JSON.stringify(input.contextRows ?? []),
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
