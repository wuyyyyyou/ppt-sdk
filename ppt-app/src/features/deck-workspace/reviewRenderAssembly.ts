import type {
  GetWorkspacePageImageResult,
  RenderDeckHtmlResult,
} from "../../api/types";
import type { PptBackend } from "../../api/pptBackend";
import {
  GENERATION_PAGE_PREVIEW_CONCURRENCY,
  isGenerationPagePreviewReusable,
  type GenerationPagePreviewEntry,
  type GenerationPagePreviews,
} from "./generationPagePreviews";
import { mapWithConcurrencyLimit } from "./workspaceCovers";

export interface ReviewRenderAssemblyResult {
  result: RenderDeckHtmlResult;
  previews: GenerationPagePreviews;
  fetchedPageIds: string[];
  failedPageIds: string[];
}

export async function assembleReviewRender(input: {
  backend: Pick<PptBackend, "getWorkspacePageImage">;
  metadata: RenderDeckHtmlResult;
  workspaceDir: string;
  previews?: GenerationPagePreviews;
  nowMs?: number;
}): Promise<ReviewRenderAssemblyResult> {
  const nowMs = input.nowMs ?? Date.now();
  const previews: GenerationPagePreviews = { ...(input.previews ?? {}) };
  const uploads = new Map<string, GetWorkspacePageImageResult>();
  const missingSlides = input.metadata.slides.filter((slide) => !isGenerationPagePreviewReusable({
    entry: previews[slide.slide_id],
    previewSourceFingerprint: slide.preview_source_fingerprint,
    nowMs,
  }));
  const failedPageIds: string[] = [];

  await mapWithConcurrencyLimit(
    missingSlides,
    GENERATION_PAGE_PREVIEW_CONCURRENCY,
    async (slide) => {
      try {
        const image = await input.backend.getWorkspacePageImage({
          workspace_dir: input.workspaceDir,
          page_id: slide.slide_id,
        });
        if (
          slide.preview_source_fingerprint &&
          image.preview_source_fingerprint !== slide.preview_source_fingerprint
        ) {
          throw new Error(`Preview source changed while loading page ${slide.slide_id}`);
        }
        uploads.set(slide.slide_id, image);
      } catch {
        failedPageIds.push(slide.slide_id);
      }
    },
  );

  const slides = input.metadata.slides.map((slide, pageIndex) => {
    const fetched = uploads.get(slide.slide_id);
    if (fetched) {
      previews[slide.slide_id] = {
        pageId: slide.slide_id,
        pageIndex,
        title: slide.title,
        screenshotPath: slide.screenshot_path ?? fetched.source_path,
        renderSourceFingerprint: slide.render_source_fingerprint,
        // Deck metadata is only assembled from finished renders, so the
        // screenshot on disk is by definition the one this source produced.
        screenshotSourceFingerprint: slide.render_source_fingerprint,
        previewSourceFingerprint: fetched.preview_source_fingerprint,
        imagePath: fetched.image_path,
        imageUpload: fetched.image_upload,
        receivedAtMs: nowMs,
        status: "ready",
      };
      return { ...slide, screenshot_upload: fetched.image_upload };
    }

    const cached = previews[slide.slide_id] as GenerationPagePreviewEntry | undefined;
    if (cached && isGenerationPagePreviewReusable({
      entry: cached,
      previewSourceFingerprint: slide.preview_source_fingerprint,
      nowMs,
    })) {
      previews[slide.slide_id] = {
        ...cached,
        pageIndex,
        title: slide.title,
        screenshotPath: slide.screenshot_path ?? cached.screenshotPath,
        renderSourceFingerprint: slide.render_source_fingerprint,
        screenshotSourceFingerprint: slide.render_source_fingerprint,
      };
      return { ...slide, screenshot_upload: cached.imageUpload };
    }
    return { ...slide, screenshot_upload: undefined };
  });

  const finalPageIds = new Set(input.metadata.slides.map((slide) => slide.slide_id));
  Object.keys(previews).forEach((pageId) => {
    if (!finalPageIds.has(pageId)) delete previews[pageId];
  });

  return {
    result: { ...input.metadata, workspace_dir: input.workspaceDir, slides },
    previews,
    fetchedPageIds: [...uploads.keys()],
    failedPageIds,
  };
}
