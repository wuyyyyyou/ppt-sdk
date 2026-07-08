import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import AnalyticsCanvas from "../components/AnalyticsCanvas.tsx";
import AnalyticsSourceFooter from "../components/AnalyticsSourceFooter.tsx";
import ExecutiveHeader from "../components/ExecutiveHeader.tsx";
import { chartAnalyticsTheme } from "../theme/tokens.ts";

export const Schema = z.object({
  eyebrow: z.string().min(2).max(44).default("Component-first Workspace"),
  title: z.string().min(4).max(72).default("Content Canvas"),
  headerMetaLabel: z.string().min(2).max(24).default("Mode"),
  headerMetaValue: z.string().min(2).max(36).default("Open Composition"),
  headerIcon: z.string().min(2).max(32).default("grid"),
  guideTitle: z.string().min(2).max(64).default("Compose the page-specific structure here"),
  guideText: z
    .string()
    .min(8)
    .max(170)
    .default("Replace this guide with reusable cards, metrics, charts, images, matrices, timelines, or concise narrative blocks."),
  footerSource: z.string().min(4).max(120).default("Canvas note: data provides content; TSX owns composition."),
  confidentialityLabel: z.string().min(2).max(32).default("CANVAS"),
  pageNumber: z.string().min(1).max(6).default("02"),
  showSlotGuides: z.boolean().default(true),
});

export const sampleData = Schema.parse({});

export const layoutId = "content-canvas";
export const layoutName = "Content Canvas";
export const layoutDescription =
  "A general light analytics content frame with a dark executive header, source footer, and a large open composition area.";
export const layoutTags = ["content", "canvas", "analytics", "component-first", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["header", "content-slot", "source-footer"];
export const useCases = ["overview", "analysis", "evidence", "custom-composition"];
export const suitableFor = "Suitable as the default starting frame for ordinary analytics pages.";
export const avoidFor = "Avoid for covers, final closings, or pages whose primary intent is a dedicated comparison or chart canvas.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const ContentCanvas = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);

  return (
    <AnalyticsCanvas variant="light">
      <ExecutiveHeader
        eyebrow={parsed.eyebrow}
        title={parsed.title}
        metaLabel={parsed.headerMetaLabel}
        metaValue={parsed.headerMetaValue}
        icon={parsed.headerIcon}
      />

      <div className="h-[582px] px-[48px] py-[32px]">
        {parsed.showSlotGuides ? (
          <div
            className="flex h-full w-full items-center justify-center rounded-[8px] border border-dashed"
            style={{
              borderColor: chartAnalyticsTheme.colors.signalPrimaryBorder,
              backgroundColor: chartAnalyticsTheme.colors.signalPrimaryTint,
            }}
          >
            <div className="w-[660px] text-center">
              <div className="text-[28px] font-black leading-[1.1]" style={{ color: chartAnalyticsTheme.colors.signalPrimary }}>
                {parsed.guideTitle}
              </div>
              <div className="mt-[18px] text-[18px] font-medium leading-[1.5]" style={{ color: chartAnalyticsTheme.colors.textSubtle }}>
                {parsed.guideText}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <AnalyticsSourceFooter
        source={parsed.footerSource}
        confidentialityLabel={parsed.confidentialityLabel}
        pageNumber={parsed.pageNumber}
      />
    </AnalyticsCanvas>
  );
};

export default ContentCanvas;
