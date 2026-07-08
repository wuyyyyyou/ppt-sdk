import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import AnalyticsCanvas from "../components/AnalyticsCanvas.tsx";
import DarkAnalyticsBackdrop from "../components/DarkAnalyticsBackdrop.tsx";
import ExpandedLabel from "../components/ExpandedLabel.tsx";
import ReportMetaFooter from "../components/ReportMetaFooter.tsx";
import { chartAnalyticsTheme } from "../theme/tokens.ts";

export const Schema = z.object({
  seriesLabel: z.string().min(2).max(64).default("Analytics Canvas Series"),
  headline: z.string().min(2).max(42).default("Build the Analysis Opening"),
  subtitle: z
    .string()
    .min(4)
    .max(96)
    .default("Start with the dark analytics visual language, then compose the final cover from reusable components."),
  scope: z.string().min(4).max(120).default("Evidence scope - audience frame - decision context"),
  publisherLabel: z.string().min(2).max(32).default("Prepared By"),
  publisher: z.string().min(2).max(64).default("Analytics Authoring Workspace"),
  dateLabel: z.string().min(2).max(32).default("Report Date"),
  reportDate: z.string().min(4).max(32).default("2026"),
  backgroundImageUrl: z.string().url().optional(),
  backgroundImageAlt: z.string().min(2).max(80).default("Analytics background"),
  showBackgroundImage: z.boolean().default(false),
  showSlotGuides: z.boolean().default(true),
});

export const sampleData = Schema.parse({});

export const layoutId = "cover-canvas";
export const layoutName = "Cover Canvas";
export const layoutDescription =
  "An open dark analytics cover canvas with series label, headline, scope, footer metadata, and a visual composition slot.";
export const layoutTags = ["cover", "canvas", "analytics", "dark", "component-first", "tsx-first"];
export const layoutRole = "cover";
export const contentElements = ["series-label", "headline", "subtitle", "scope", "visual-slot", "footer-meta"];
export const useCases = ["cover", "opening", "analytics-report", "custom-composition"];
export const suitableFor = "Suitable as a branded opening canvas before composing a specific analytics cover.";
export const avoidFor = "Avoid using it unchanged as a final page or for dense analytical body pages.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const CoverCanvas = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);

  return (
    <AnalyticsCanvas>
      <DarkAnalyticsBackdrop
        imageAlt={parsed.backgroundImageAlt}
        imageUrl={parsed.backgroundImageUrl}
        showImage={parsed.showBackgroundImage}
      />

      <div
        className="absolute left-[820px] top-[0px] z-[1] h-[360px] w-[360px] rounded-full border"
        style={{ borderColor: chartAnalyticsTheme.colors.darkBorder }}
      />
      <div
        className="absolute left-[904px] top-[0px] z-[1] h-[300px] w-[300px] rounded-full border"
        style={{ borderColor: chartAnalyticsTheme.alpha.signalPrimary(0.2) }}
      />
      <div
        className="absolute left-[0px] top-[392px] z-[1] h-[328px] w-[328px] rounded-full border"
        style={{ borderColor: chartAnalyticsTheme.colors.darkBorder }}
      />

      <div className="relative z-10 flex h-full flex-col justify-center px-[78px] pb-[92px] pt-[74px]">
        <ExpandedLabel text={parsed.seriesLabel} />

        <div className="mt-[72px] grid grid-cols-[690px_minmax(0,1fr)] gap-[58px]">
          <div>
            <div
              className="text-[72px] font-black leading-[0.98]"
              style={{ color: chartAnalyticsTheme.colors.textInverse, fontFamily: chartAnalyticsTheme.fonts.display }}
            >
              {parsed.headline}
            </div>
            <div className="mt-[28px] w-[620px] text-[25px] font-light leading-[1.32]" style={{ color: chartAnalyticsTheme.colors.darkText }}>
              {parsed.subtitle}
            </div>
            <div className="mt-[16px] w-[620px] text-[17px] leading-[1.35]" style={{ color: chartAnalyticsTheme.colors.darkMutedText }}>
              {parsed.scope}
            </div>
          </div>

          {parsed.showSlotGuides ? (
            <div
              className="flex h-[310px] items-center justify-center rounded-[8px] border border-dashed px-[38px] text-center"
              style={{
                borderColor: chartAnalyticsTheme.alpha.signalPrimary(0.42),
                backgroundColor: chartAnalyticsTheme.colors.darkCallout,
              }}
            >
              <div className="text-[18px] font-bold uppercase leading-[1.45]" style={{ color: chartAnalyticsTheme.colors.signalPrimary }}>
                Compose cover visual, evidence cue, or compact metric cluster here
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <ReportMetaFooter
        leftLabel={parsed.publisherLabel}
        leftValue={parsed.publisher}
        rightLabel={parsed.dateLabel}
        rightValue={parsed.reportDate}
      />
    </AnalyticsCanvas>
  );
};

export default CoverCanvas;
