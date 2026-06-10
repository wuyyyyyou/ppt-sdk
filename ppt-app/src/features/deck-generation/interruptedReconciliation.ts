import type { PageProgress } from "../../api/types";
import { isActivePageGenerationStatus } from "./pageStatusPolicy";

export interface InterruptedPageProgressPatch {
  pageId: string;
  patch: Record<string, unknown>;
}

export interface InterruptedPageProgressReconciliation {
  patches: InterruptedPageProgressPatch[];
  progress: PageProgress;
}

const INTERRUPTED_PATCH: Record<string, unknown> = {
  status: "interrupted",
  render_attempts: 0,
  visual_review_attempts: 0,
  content_review_attempts: 0,
  agent_failures: 0,
  agent_infrastructure_failures: 0,
  last_error: "",
  content_review: null,
  visual_review: null,
  review: null,
};

export function reconcileInterruptedPageProgress(
  progress: PageProgress,
): InterruptedPageProgressReconciliation {
  const patches: InterruptedPageProgressPatch[] = [];
  const pages = progress.pages.map((page) => {
    if (!isActivePageGenerationStatus(page.status)) return page;
    patches.push({
      pageId: page.page_id,
      patch: { ...INTERRUPTED_PATCH },
    });
    return {
      ...page,
      ...INTERRUPTED_PATCH,
    };
  });

  if (patches.length === 0) {
    return { patches, progress };
  }

  return {
    patches,
    progress: {
      ...progress,
      pages,
    },
  };
}
