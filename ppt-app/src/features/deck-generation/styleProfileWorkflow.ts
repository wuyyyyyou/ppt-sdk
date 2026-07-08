import type { AgentClient, AgentRunSummary } from "../../agent/agentClient";
import type { PptBackend } from "../../api/pptBackend";
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
  agentClient: AgentClient;
  displayName?: string;
  files: File[];
  isCancelled?: () => boolean;
  signal?: AbortSignal;
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

async function uploadStyleProfileReferenceFile(
  backend: PptBackend,
  creationId: string,
  file: File,
) {
  const session = await backend.beginStyleProfileReferenceUpload({
    creation_id: creationId,
    filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  });
  const response = await fetch(session.upload_url, {
    method: "PUT",
    body: file,
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Style Profile reference HTTP upload failed: HTTP ${response.status}`);
  }
  return backend.commitStyleProfileReferenceUpload({
    creation_id: creationId,
    upload_id: session.upload_id,
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
  if (input.files.length === 0) {
    throw new Error("At least one PPTX or image file is required to create a Style Profile.");
  }

  const prepared = await input.backend.prepareStyleProfileCreation({
    display_name: input.displayName,
  });
  for (const file of input.files) {
    if (input.isCancelled?.()) throw new Error("Style Profile creation cancelled.");
    await uploadStyleProfileReferenceFile(input.backend, prepared.creation_id, file);
  }

  const context = await input.backend.getStyleProfileCreationContext({
    creation_id: prepared.creation_id,
  });
  if (context.selected_reference_images.length === 0) {
    throw new Error("No Reference Slide Images were created from the uploaded files.");
  }

  const attempts: CreateStyleProfileResult["attempts"] = [];
  let retryGateError = "";
  let previousSummary: AgentRunSummary | undefined;

  for (let attempt = 1; attempt <= STYLE_PROFILE_CREATION_ATTEMPT_LIMIT; attempt += 1) {
    if (input.isCancelled?.()) throw new Error("Style Profile creation cancelled.");
    const before = await input.backend.getStyleProfileDraftFingerprint({
      creation_id: prepared.creation_id,
    });
    const prompt = buildStyleProfileCreationPrompt({
      context,
      displayName: input.displayName || prepared.display_name,
      retryGateError,
      previousSummary,
    });
    const summary = await input.agentClient.runAuthoringPrompt(prompt, {
      signal: input.signal,
      isCancelled: input.isCancelled,
    });
    const after = await input.backend.getStyleProfileDraftFingerprint({
      creation_id: prepared.creation_id,
    });

    try {
      validateDraftFingerprint(before, after);
      attempts.push({ attempt, summary, fingerprint: after });
      const publishResult = await input.backend.publishStyleProfile({
        creation_id: prepared.creation_id,
        display_name: input.displayName,
      });
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
        throw error;
      }
    }
  }

  throw new Error("Style Profile creation failed.");
}
