import { renderSlideHtml } from "./render-slide.js";
import { writeSlideScreenshots } from "./browser-artifacts.js";
import type { TemplateRenderThemeInput } from "./types.js";

export interface BuiltinTemplatePreviewScreenshotInput {
  templateGroup: string;
  layoutId: string;
  slideData: Record<string, unknown>;
  outputPath: string;
  title?: string | null;
  theme?: TemplateRenderThemeInput | null;
}

export async function buildBuiltinTemplatePreviewScreenshots(
  slides: BuiltinTemplatePreviewScreenshotInput[],
): Promise<void> {
  if (!Array.isArray(slides) || slides.length === 0) {
    return;
  }

  await writeSlideScreenshots(
    slides.map((slide) => ({
      html: renderSlideHtml({
        template_group: slide.templateGroup,
        layout_id: slide.layoutId,
        slide_data: slide.slideData,
        title: slide.title,
        theme: slide.theme,
      }),
      outputPath: slide.outputPath,
    })),
    "Built-in template preview screenshots",
    { requireTailwind: false, allowFailedImages: true },
  );
}
