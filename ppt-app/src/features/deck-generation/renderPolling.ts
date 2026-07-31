import type {
  PageProgress,
  RenderDeckHtmlSubmissionResult,
  RenderWorkspacePagePreviewResult,
  RenderWorkspacePagePreviewSubmissionResult,
} from "../../api/types";
import type { PptBackend } from "../../api/pptBackend";

const RENDER_POLL_INTERVAL_MS = 1_200;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function waitForWorkspacePagePreview(input: {
  backend: PptBackend;
  workspaceDir: string;
  submission: RenderWorkspacePagePreviewSubmissionResult;
  isCancelled?: () => boolean;
  onProgress?: (progress: PageProgress) => void;
}): Promise<RenderWorkspacePagePreviewResult | null> {
  while (true) {
    if (input.isCancelled?.()) return null;
    let progress: PageProgress;
    try {
      progress = await input.backend.getPageProgress({ workspace_dir: input.workspaceDir });
    } catch {
      await sleep(RENDER_POLL_INTERVAL_MS);
      continue;
    }
    input.onProgress?.(progress);
    const page = progress.pages.find((item) => item.page_id === input.submission.slide_id);
    if (!page) throw new Error(`Page progress is missing for page "${input.submission.slide_id}".`);
    if (page.render_attempts !== input.submission.render_attempt) {
      throw new Error(`Page render was superseded for page "${input.submission.slide_id}".`);
    }
    if (page.render_source_sha256 && page.render_source_sha256 !== input.submission.source_sha256) {
      throw new Error(`Page source changed while rendering page "${input.submission.slide_id}".`);
    }
    if (["rendered", "accepted", "visual_review"].includes(page.status)) {
      if (!page.last_html_path || !page.last_screenshot_path) {
        throw new Error(`Page render completed without HTML and screenshot artifacts for "${input.submission.slide_id}".`);
      }
      return {
        workspace_dir: input.submission.workspace_dir,
        manifest_path: input.submission.manifest_path,
        html_path: page.last_html_path,
        screenshot_path: page.last_screenshot_path,
        page_index: input.submission.page_index,
        page_number: input.submission.page_number,
        slide_id: input.submission.slide_id,
        layout_id: input.submission.layout_id,
        title: input.submission.title,
        rendered_at: page.updated_at ?? input.submission.submitted_at,
      };
    }
    if (["render_failed", "agent_failed"].includes(page.status)) {
      throw new Error(page.last_error || `Page render failed for "${input.submission.slide_id}".`);
    }
    if (page.status === "interrupted") {
      throw new Error(page.last_error || `Page render was interrupted for "${input.submission.slide_id}".`);
    }
    await sleep(RENDER_POLL_INTERVAL_MS);
  }
}

export async function waitForFinalDeckRender(input: {
  backend: PptBackend;
  workspaceDir: string;
  submission: RenderDeckHtmlSubmissionResult;
  isCancelled?: () => boolean;
  onProgress?: (progress: PageProgress) => void;
}): Promise<PageProgress | null> {
  while (true) {
    if (input.isCancelled?.()) return null;
    let progress: PageProgress;
    try {
      progress = await input.backend.getPageProgress({ workspace_dir: input.workspaceDir });
    } catch {
      await sleep(RENDER_POLL_INTERVAL_MS);
      continue;
    }
    input.onProgress?.(progress);
    const finalRender = progress.final_deck_render;
    if (finalRender?.source_fingerprint && finalRender.source_fingerprint !== input.submission.source_fingerprint) {
      throw new Error("Final Deck render was superseded by a newer render request.");
    }
    if (finalRender?.status === "completed") return progress;
    if (finalRender?.status === "failed") {
      throw new Error(finalRender.error || finalRender.message || "Final Deck render failed.");
    }
    if (finalRender?.status === "interrupted") {
      throw new Error(finalRender.error || finalRender.message || "Final Deck render was interrupted.");
    }
    await sleep(RENDER_POLL_INTERVAL_MS);
  }
}
