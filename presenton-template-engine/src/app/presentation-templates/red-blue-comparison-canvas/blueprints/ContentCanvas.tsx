import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import { BalancedComparisonDecorations } from "../components/ComparisonDecorations.tsx";
import ThemeContentFrame from "../components/ThemeContentFrame.tsx";
import ThemePanelShell from "../components/ThemePanelShell.tsx";
import ThemePill from "../components/ThemePill.tsx";
import { redBlueComparisonTheme } from "../theme/tokens.ts";

export const Schema = z.object({
  titlePrefix: z.string().min(2).max(34).default("Content"),
  titleHighlight: z.string().min(2).max(34).default("Canvas"),
  subtitle: z
    .string()
    .min(8)
    .max(120)
    .default("Use the open body area for page-specific component composition."),
  metaLabel: z.string().min(2).max(28).default("COMPONENT-FIRST"),
  footerText: z.string().min(4).max(80).default("Red Blue Comparison Canvas | Content"),
  pageNumber: z.string().min(1).max(4).default("02"),
  guideTitle: z.string().min(2).max(56).default("Compose the final page structure here"),
  guideText: z
    .string()
    .min(8)
    .max(150)
    .default("Replace this guide with reusable cards, metrics, images, charts, tables, or narrative blocks from components/."),
  showSlotGuides: z.boolean().default(true),
  showDecorations: z.boolean().default(true),
});

export const sampleData = Schema.parse({});

export const layoutId = "content-canvas";
export const layoutName = "Content Canvas";
export const layoutDescription =
  "A general red-blue comparison content frame with title, meta, footer, and a large open composition slot.";
export const layoutTags = ["content", "canvas", "comparison", "component-first", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["page-title", "subtitle", "meta", "content-slot", "footer-meta"];
export const useCases = ["overview", "analysis", "evidence", "custom-composition"];
export const suitableFor =
  "Suitable as the default starting point for ordinary pages that need a custom component composition.";
export const avoidFor =
  "Avoid using it unchanged as a final page, or for covers and closing pages.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const ContentCanvas = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);

  return (
    <ThemeContentFrame
      titlePrefix={parsed.titlePrefix}
      titleHighlight={parsed.titleHighlight}
      subtitle={parsed.subtitle}
      meta={<ThemePill tone="purple" width={190}>{parsed.metaLabel}</ThemePill>}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      tone="purple"
      contentClassName="flex items-center justify-center"
    >
      {parsed.showDecorations ? <BalancedComparisonDecorations /> : null}
      {parsed.showSlotGuides ? (
        <ThemePanelShell
          className="relative z-10 flex h-full w-full items-center justify-center"
          borderColor={redBlueComparisonTheme.tone.purple.border}
          backgroundColor="rgba(245,243,255,0.72)"
          shadow="none"
        >
          <div className="w-[620px] text-center">
            <div className="text-[28px] font-black leading-none" style={{ color: redBlueComparisonTheme.colors.primary }}>
              {parsed.guideTitle}
            </div>
            <div className="mt-[18px] text-[18px] font-medium leading-[1.5]" style={{ color: redBlueComparisonTheme.colors.mutedText }}>
              {parsed.guideText}
            </div>
          </div>
        </ThemePanelShell>
      ) : null}
    </ThemeContentFrame>
  );
};

export default ContentCanvas;
