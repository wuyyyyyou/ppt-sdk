import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import FinanceContentFrame from "../components/FinanceContentFrame.tsx";
import { FinanceIcon } from "../components/FinanceIcons.tsx";
import { redFinanceTheme } from "../theme/tokens.ts";

export const Schema = z.object({
  title: z.string().min(2).max(30).default("Content Canvas"),
  metaLabel: z.string().min(2).max(48).default("COMPONENT-FIRST"),
  footerText: z.string().min(4).max(80).default("Red Finance Canvas | Component-first Workspace"),
  pageNumber: z.string().min(1).max(4).default("02"),
  guideTitle: z.string().min(2).max(48).default("Compose page-specific components here"),
  guideText: z
    .string()
    .min(8)
    .max(140)
    .default("Read components/README.md, choose the right component families, and replace this guide with the final TSX composition."),
  showSlotGuides: z.boolean().default(true),
});

export const sampleData = Schema.parse({});

export const layoutId = "content-canvas";
export const layoutName = "Content Canvas";
export const layoutDescription =
  "A minimal red finance content frame with title, meta, footer, and a large composition area for custom slide layouts.";
export const layoutTags = ["content", "canvas", "finance", "component-first", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["page-title", "meta", "content-slot", "footer-meta"];
export const useCases = ["analysis", "overview", "custom-composition", "component-layout"];
export const suitableFor =
  "Suitable as the default starting frame for ordinary content pages that should be composed from finance components based on the actual page intent.";
export const avoidFor =
  "Avoid using it unchanged as a final page; the content slot must be replaced with concrete component composition.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const ContentCanvas = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);

  return (
    <FinanceContentFrame
      title={parsed.title}
      metaIcon={<FinanceIcon name="grid" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentClassName="flex items-center justify-center"
    >
      {parsed.showSlotGuides ? (
        <div
          className="flex h-full w-full items-center justify-center rounded-[8px]"
          style={{
            border: `1px dashed ${redFinanceTheme.colors.accentBorder}`,
            backgroundColor: redFinanceTheme.colors.accentTint,
          }}
        >
          <div className="w-[560px] text-center">
            <div className="text-[26px] font-black leading-none" style={{ color: redFinanceTheme.colors.primary }}>
              {parsed.guideTitle}
            </div>
            <div className="mt-[18px] text-[18px] font-medium leading-[1.5]" style={{ color: redFinanceTheme.colors.mutedText }}>
              {parsed.guideText}
            </div>
          </div>
        </div>
      ) : null}
    </FinanceContentFrame>
  );
};

export default ContentCanvas;
