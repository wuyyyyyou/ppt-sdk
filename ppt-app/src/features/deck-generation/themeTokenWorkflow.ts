import type { AiClient, LlmContextRow } from "../../ai/aiClient";
import type { AiInteractionLogger, AiOperationLogContext } from "../../ai/interactionLog";
import type { PptBackend } from "../../api/pptBackend";
import type {
  RecordWorkspaceThemeTokenResult,
  WorkspaceResult,
  WorkspaceThemeValidationResult,
} from "../../api/types";
import type { Locale } from "../../i18n/messages";

const THEME_TOKEN_ATTEMPT_LIMIT = 3;

export interface EnsureWorkspaceThemeTokenInput {
  backend: PptBackend;
  aiClient: AiClient;
  aiLogger?: AiInteractionLogger | null;
  workspace: WorkspaceResult;
  prompt: string;
  contextRows: LlmContextRow[];
  locale: Locale;
  runKind: "deck-generation" | "deck-refinement";
  refinementRequest?: string;
}

export interface EnsureWorkspaceThemeTokenResult {
  workspace: WorkspaceResult;
  record: RecordWorkspaceThemeTokenResult;
  fallbackUsed: boolean;
}

function buildThemeLogContext(input: EnsureWorkspaceThemeTokenInput): AiOperationLogContext | undefined {
  if (!input.aiLogger) return undefined;
  const operation = "generate_theme_token";
  return {
    logger: input.aiLogger,
    workspace_dir: input.workspace.workspace_dir,
    domain: "theme",
    operation,
    operation_id: input.aiLogger.createOperationId("theme", operation),
    kind: input.runKind,
    provider: "anna",
    runtime_mode: "anna",
  };
}

async function appendThemeLog(input: {
  backend: PptBackend;
  workspaceDir: string;
  logContext?: AiOperationLogContext;
  entry: Record<string, unknown>;
}) {
  try {
    await input.backend.appendWorkspaceLog({
      workspace_dir: input.workspaceDir,
      channel: "ai-theme",
      entry: {
        event: "ai.theme.generate_theme_token.attempt",
        schema_version: 1,
        operation_id: input.logContext?.operation_id,
        interaction_ids: input.logContext?.interaction_ids ?? [],
        operation: "generate_theme_token",
        ...input.entry,
      },
    });
  } catch (error) {
    console.warn(
      "Failed to append theme AI log",
      error instanceof Error ? error.message : error,
    );
  }
}

function validationErrorMessages(validation: WorkspaceThemeValidationResult) {
  return validation.errors.length > 0
    ? validation.errors
    : ["Workspace Theme Token did not satisfy the template theme contract."];
}

export async function ensureWorkspaceThemeToken(
  input: EnsureWorkspaceThemeTokenInput,
): Promise<EnsureWorkspaceThemeTokenResult> {
  const logContext = buildThemeLogContext(input);
  const themeContext = await input.backend.getWorkspaceThemeContext({
    workspace_dir: input.workspace.workspace_dir,
  });
  const selectedStyleProfileResult = await input.backend.getWorkspaceStyleProfile({
    workspace_dir: input.workspace.workspace_dir,
  });
  const selectedStyleProfile = selectedStyleProfileResult.selected
    ? {
        displayName: selectedStyleProfileResult.selection?.display_name,
        profilePath: selectedStyleProfileResult.profile_path,
        content: selectedStyleProfileResult.content,
      }
    : null;
  const currentToken =
    input.runKind === "deck-refinement"
      ? themeContext.current_token_validation?.ok
        ? themeContext.current_token
        : themeContext.default_token
      : undefined;
  let previousResponse: unknown;
  let validationErrors: string[] = [];

  for (let attempt = 1; attempt <= THEME_TOKEN_ATTEMPT_LIMIT; attempt += 1) {
    try {
      const token = await input.aiClient.generateThemeToken({
        prompt: input.prompt,
        contextRows: input.contextRows,
        locale: input.locale,
        themeContext,
        refinementRequest: input.refinementRequest,
        currentToken,
        previousResponse,
        validationErrors,
        selectedStyleProfile,
        logContext,
      });
      const validation = await input.backend.validateWorkspaceThemeToken({
        workspace_dir: input.workspace.workspace_dir,
        token,
      });
      if (validation.ok) {
        const record = await input.backend.recordWorkspaceThemeToken({
          workspace_dir: input.workspace.workspace_dir,
          token,
        });
        await appendThemeLog({
          backend: input.backend,
          workspaceDir: input.workspace.workspace_dir,
          logContext,
          entry: {
            run_kind: input.runKind,
            attempt,
            status: "success",
            validation,
            fallback_used: false,
          },
        });
        return {
          workspace: record.workspace,
          record,
          fallbackUsed: false,
        };
      }

      previousResponse = token;
      validationErrors = validationErrorMessages(validation);
      await appendThemeLog({
        backend: input.backend,
        workspaceDir: input.workspace.workspace_dir,
        logContext,
        entry: {
          run_kind: input.runKind,
          attempt,
          status: attempt < THEME_TOKEN_ATTEMPT_LIMIT ? "retry" : "error",
          validation,
          fallback_used: false,
        },
      });
    } catch (error) {
      validationErrors = [error instanceof Error ? error.message : String(error)];
      await appendThemeLog({
        backend: input.backend,
        workspaceDir: input.workspace.workspace_dir,
        logContext,
        entry: {
          run_kind: input.runKind,
          attempt,
          status: attempt < THEME_TOKEN_ATTEMPT_LIMIT ? "retry" : "error",
          error: {
            message: validationErrors[0],
          },
          fallback_used: false,
        },
      });
    }
  }

  const fallbackRecord = await input.backend.recordWorkspaceThemeToken({
    workspace_dir: input.workspace.workspace_dir,
    use_default: true,
  });
  await appendThemeLog({
    backend: input.backend,
    workspaceDir: input.workspace.workspace_dir,
    logContext,
    entry: {
      run_kind: input.runKind,
      attempt: THEME_TOKEN_ATTEMPT_LIMIT + 1,
      status: "fallback",
      validation: fallbackRecord.validation,
      fallback_used: true,
      errors: validationErrors,
    },
  });

  return {
    workspace: fallbackRecord.workspace,
    record: fallbackRecord,
    fallbackUsed: true,
  };
}
