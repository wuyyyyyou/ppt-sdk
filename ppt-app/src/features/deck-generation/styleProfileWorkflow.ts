import { isAgentRunCancelledError, type AgentClient, type AgentRunSummary, type AgentStreamEvent } from "../../agent/agentClient";
import type { PptBackend } from "../../api/pptBackend";
import type { AppHostUploadClient } from "../../runtime/appHostUploadClient";
import type {
  GetStyleProfileCreationContextResult,
  PublishStyleProfileResult,
  StyleProfileDraftFingerprint,
} from "../../api/types";
import {
  createAgentFileToolPathContext,
  describeAgentFileToolPathContext,
  formatAgentFileToolPathBlock,
  toAgentFileToolPath,
} from "./agentFileToolPaths";

const STYLE_PROFILE_CREATION_ATTEMPT_LIMIT = 3;
const STYLE_PROFILE_DRAFT_MIN_BYTES = 200;
const STYLE_PROFILE_DRAFT_MAX_BYTES = 8 * 1024;

export interface CreateStyleProfileInput {
  backend: PptBackend;
  hostUploadClient: AppHostUploadClient;
  agentClient: AgentClient;
  displayName?: string;
  files: File[];
  creationId?: string;
  skipUpload?: boolean;
  isCancelled?: () => boolean;
  signal?: AbortSignal;
  onProgress?: (event: CreateStyleProfileWorkflowEvent) => void;
}

export interface CreateStyleProfileResult {
  creationContext: GetStyleProfileCreationContextResult;
  publishResult: PublishStyleProfileResult;
  attempts: Array<{
    attempt: number;
    summary: AgentRunSummary;
    fingerprint: StyleProfileDraftFingerprint;
    gate_error?: string;
    }>;
}

export type StyleProfileCreationPhase = "prepare" | "analyze" | "publish";

export type CreateStyleProfileWorkflowEvent =
  | { type: "phase-start"; phase: StyleProfileCreationPhase; message: string }
  | { type: "phase-complete"; phase: StyleProfileCreationPhase; message: string }
  | { type: "phase-error"; phase: StyleProfileCreationPhase; message: string }
  | { type: "creation-prepared"; creationId: string; displayName: string }
  | { type: "stream"; phase: "analyze"; event: AgentStreamEvent }
  | { type: "attempt"; phase: "analyze"; attempt: number; message: string };

export class StyleProfileCreationCancelledError extends Error {
  constructor() {
    super("Style Profile creation cancelled.");
    this.name = "StyleProfileCreationCancelledError";
  }
}

export function isStyleProfileCreationCancelledError(error: unknown): error is StyleProfileCreationCancelledError {
  return error instanceof StyleProfileCreationCancelledError;
}

function throwIfCancelled(input: Pick<CreateStyleProfileInput, "isCancelled" | "signal">) {
  if (input.isCancelled?.() || input.signal?.aborted) {
    throw new StyleProfileCreationCancelledError();
  }
}

async function uploadStyleProfileReferenceFile(
  backend: PptBackend,
  hostUploadClient: AppHostUploadClient,
  creationId: string,
  file: File,
) {
  const hostUpload = await hostUploadClient.uploadFile(file, {
    purpose: "image_reference",
    filename: file.name,
    mimeType: file.type || undefined,
    metadata: {
      source: "ppt-app.style-profile-reference",
      creation_id: creationId,
    },
  });
  return backend.commitStyleProfileReferenceHostUpload({
    creation_id: creationId,
    filename: file.name,
    mime_type: hostUpload.mime_type,
    size_bytes: file.size,
    host_upload: hostUpload,
  });
}

function fingerprintChanged(
  before: StyleProfileDraftFingerprint,
  after: StyleProfileDraftFingerprint,
) {
  if (!after.exists || !after.sha256 || !after.size_bytes) return false;
  if (!before.exists) return true;
  return before.sha256 !== after.sha256 || before.size_bytes !== after.size_bytes;
}

function validateDraftFingerprint(
  before: StyleProfileDraftFingerprint,
  after: StyleProfileDraftFingerprint,
) {
  if (!after.exists) {
    throw new Error("Agent did not create draft/profile.md.");
  }
  if (!fingerprintChanged(before, after)) {
    throw new Error("Agent completed but draft/profile.md did not change.");
  }
  const sizeBytes = after.size_bytes ?? 0;
  if (sizeBytes < STYLE_PROFILE_DRAFT_MIN_BYTES) {
    throw new Error(`draft/profile.md is too short: ${sizeBytes} bytes.`);
  }
  if (sizeBytes > STYLE_PROFILE_DRAFT_MAX_BYTES) {
    throw new Error(`draft/profile.md is too long: ${sizeBytes} bytes.`);
  }
}

function dirnamePath(value: string) {
  const normalized = value.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized || normalized === "/") return normalized || "";
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? "/" : normalized.slice(0, index);
}

function buildStyleProfileCreationPrompt(input: {
  context: GetStyleProfileCreationContextResult;
  displayName: string;
  retryGateError?: string;
  previousSummary?: AgentRunSummary;
}) {
  const agentPathContext = createAgentFileToolPathContext({
    workspaceRoot: dirnamePath(input.context.library_dir),
    workspaceDir: input.context.creation_dir,
  });
  const images = input.context.selected_reference_images
    .map((image, index) => [
      `Reference image ${index + 1}:`,
      `- reference_image_id: ${image.reference_image_id}`,
      `- page_number: ${image.page_number ?? "image"}`,
      `- dimensions: ${image.width ?? "unknown"} x ${image.height ?? "unknown"}`,
      formatAgentFileToolPathBlock({
        label: "Image file",
        path: toAgentFileToolPath(agentPathContext, image.file_path),
      }),
    ].join("\n"));
  const draftPathBlock = formatAgentFileToolPathBlock({
    label: "Draft profile Markdown path to write",
    path: toAgentFileToolPath(agentPathContext, input.context.draft_profile_path),
  });

  return [
    "You are creating a reusable PPT visual Style Profile from reference slide images.",
    "Analyze only visual style. Do not preserve, summarize, or reuse facts, claims, numbers, chart data, source names, business conclusions, or page text from the images.",
    "For each reference image below, call `upload_local_file` with the Agent file-tool path, then call `analyze_image` on the uploaded image.",
    "Write a concise Markdown style guide to the draft profile Markdown path below. Use the Agent file-tool path when calling fs_write_file. Do not write JSON or frontmatter.",
    "",
    describeAgentFileToolPathContext(agentPathContext),
    "",
    `Display name: ${input.displayName}`,
    `Creation directory: ${input.context.creation_dir}`,
    "",
    draftPathBlock,
    "",
    "Reference images selected for analysis:",
    images.join("\n\n"),
    "",
    "The Markdown must be 200 bytes to 8 KB and should cover:",
    "- Color palette and contrast behavior",
    "- Typography tone and hierarchy",
    "- Layout rhythm, density, spacing, and alignment",
    "- Shape, line, icon, and graphic language",
    "- Chart/table visual treatment",
    "- Image treatment and background behavior",
    "- Practical do/don't guidance for future slide authoring",
    "",
    input.retryGateError
      ? [
          "Previous attempt failed the local gate:",
          input.retryGateError,
          input.previousSummary ? `Previous Agent summary: ${input.previousSummary.summary}` : "",
          "Revise draft/profile.md now and satisfy the gate.",
        ].filter(Boolean).join("\n")
      : "",
    "Return only a JSON object after writing the file:",
    JSON.stringify({
      status: "ready_for_render",
      changed_files: ["draft/profile.md"],
      summary: "Wrote Style Profile markdown.",
      needs_render: false,
      notes: [],
    }, null, 2),
  ].filter(Boolean).join("\n");
}

export async function createStyleProfile(
  input: CreateStyleProfileInput,
): Promise<CreateStyleProfileResult> {
  if (!input.skipUpload && input.files.length === 0) {
    throw new Error("At least one PPTX or image file is required to create a Style Profile.");
  }

  let creationId = input.creationId ?? "";
  let preparedDisplayName = input.displayName ?? "";
  if (!input.skipUpload) {
    input.onProgress?.({ type: "phase-start", phase: "prepare", message: "准备参考资料" });
    try {
      throwIfCancelled(input);
      const prepared = creationId
        ? await input.backend.getStyleProfileCreationContext({ creation_id: creationId })
        : await input.backend.prepareStyleProfileCreation({
            display_name: input.displayName,
          });
      creationId = prepared.creation_id;
      preparedDisplayName = input.displayName ||
        ("display_name" in prepared ? prepared.display_name : prepared.manifest.display_name);
      input.onProgress?.({
        type: "creation-prepared",
        creationId,
        displayName: preparedDisplayName,
      });
      for (const file of input.files) {
        throwIfCancelled(input);
        await uploadStyleProfileReferenceFile(input.backend, input.hostUploadClient, creationId, file);
      }
      input.onProgress?.({ type: "phase-complete", phase: "prepare", message: "参考资料已准备" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      input.onProgress?.({ type: "phase-error", phase: "prepare", message });
      throw error;
    }
  } else {
    if (!creationId) {
      throw new Error("creationId is required when skipUpload is true.");
    }
    preparedDisplayName = input.displayName ?? "";
  }

  const context = await input.backend.getStyleProfileCreationContext({
    creation_id: creationId,
  });
  if (context.selected_reference_images.length === 0) {
    throw new Error("No Reference Slide Images were created from the uploaded files.");
  }

  const attempts: CreateStyleProfileResult["attempts"] = [];
  let retryGateError = "";
  let previousSummary: AgentRunSummary | undefined;

  input.onProgress?.({ type: "phase-start", phase: "analyze", message: "分析视觉风格" });
  for (let attempt = 1; attempt <= STYLE_PROFILE_CREATION_ATTEMPT_LIMIT; attempt += 1) {
    throwIfCancelled(input);
    input.onProgress?.({
      type: "attempt",
      phase: "analyze",
      attempt,
      message: attempt === 1 ? "开始分析视觉风格" : "重试分析视觉风格",
    });
    const before = await input.backend.getStyleProfileDraftFingerprint({
      creation_id: creationId,
    });
    const prompt = buildStyleProfileCreationPrompt({
      context,
      displayName: input.displayName || preparedDisplayName || context.manifest.display_name,
      retryGateError,
      previousSummary,
    });
    let summary: AgentRunSummary;
    try {
      summary = await input.agentClient.runAuthoringPrompt(prompt, {
        signal: input.signal,
        isCancelled: input.isCancelled,
        onStreamEvent: (event) => input.onProgress?.({ type: "stream", phase: "analyze", event }),
      });
    } catch (error) {
      if (isAgentRunCancelledError(error)) {
        throw new StyleProfileCreationCancelledError();
      }
      const message = error instanceof Error ? error.message : String(error);
      input.onProgress?.({ type: "phase-error", phase: "analyze", message });
      throw error;
    }
    const after = await input.backend.getStyleProfileDraftFingerprint({
      creation_id: creationId,
    });

    try {
      validateDraftFingerprint(before, after);
      attempts.push({ attempt, summary, fingerprint: after });
      input.onProgress?.({ type: "phase-complete", phase: "analyze", message: "视觉风格分析完成" });
      input.onProgress?.({ type: "phase-start", phase: "publish", message: "发布风格画像" });
      let publishResult: PublishStyleProfileResult;
      try {
        publishResult = await input.backend.publishStyleProfile({
          creation_id: creationId,
          display_name: input.displayName,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        input.onProgress?.({ type: "phase-error", phase: "publish", message });
        throw error;
      }
      input.onProgress?.({ type: "phase-complete", phase: "publish", message: "风格画像已发布" });
      return {
        creationContext: context,
        publishResult,
        attempts,
      };
    } catch (error) {
      retryGateError = error instanceof Error ? error.message : String(error);
      previousSummary = summary;
      attempts.push({ attempt, summary, fingerprint: after, gate_error: retryGateError });
      if (attempt === STYLE_PROFILE_CREATION_ATTEMPT_LIMIT) {
        input.onProgress?.({ type: "phase-error", phase: "analyze", message: retryGateError });
        throw error;
      }
    }
  }

  throw new Error("Style Profile creation failed.");
}
