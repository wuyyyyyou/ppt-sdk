import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import AnalyticsCanvas from "../components/AnalyticsCanvas.tsx";
import ComparisonHeroTitle from "../components/ComparisonHeroTitle.tsx";
import DarkAnalyticsBackdrop from "../components/DarkAnalyticsBackdrop.tsx";
import ExpandedLabel from "../components/ExpandedLabel.tsx";
import ReportMetaFooter from "../components/ReportMetaFooter.tsx";

export const Schema = z.object({
  seriesLabel: z.string().min(2).max(64).default("Global Intelligence Series"),
  backgroundImageUrl: z
    .string()
    .url()
    .default("https://page.talentsecsite.com/slides_images/6722217b327d461901b4f6677362a773.webp"),
  backgroundImageAlt: z.string().min(2).max(80).default("City skyline background"),
  primarySubject: z.string().min(2).max(18).default("CHINA"),
  comparisonLabel: z.string().min(1).max(12).default("vs"),
  secondarySubject: z.string().min(2).max(18).default("JAPAN"),
  subtitle: z.string().min(4).max(64).default("Strategic Comparison Report"),
  scope: z.string().min(4).max(96).default("Economic Shifts - Demographics - Technology - Culture"),
  publisherLabel: z.string().min(2).max(32).default("Analysis By"),
  publisher: z.string().min(2).max(64).default("Talentsec AI Analytics"),
  dateLabel: z.string().min(2).max(32).default("Published"),
  reportDate: z.string().min(4).max(32).default("March 03, 2026"),
  showBackgroundImage: z.boolean().default(true),
  showDecoration: z.boolean().default(true),
});

export const layoutId = "cover-analytics";
export const layoutName = "Cover Analytics";
export const layoutDescription =
  "A dark analytics comparison report cover with a background image wash, geometric ring decoration, oversized entity headline, scope line, publisher, and date.";
export const layoutTags = ["cover", "analytics", "comparison", "dark", "background-image", "tsx-first"];
export const layoutRole = "cover";
export const contentElements = ["background-image", "headline", "subtitle", "scope", "footer-meta", "decoration"];
export const useCases = ["cover", "opening", "comparison-report", "executive-dashboard"];
export const suitableFor =
  "Suitable for opening a data-heavy comparison, market intelligence, country benchmark, or executive dashboard deck.";
export const avoidFor = "Avoid using this layout for body analysis, dense charts, agendas, or closing pages.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";


const CoverRings = () => (
  <div className="absolute inset-0 z-[1] pointer-events-none">
    <div className="absolute left-[820px] top-[0px] h-[360px] w-[360px] rounded-full border border-white/10" />
    <div className="absolute left-[902px] top-[0px] h-[300px] w-[300px] rounded-full border border-blue-500/20" />
    <div className="absolute left-[0px] top-[385px] h-[335px] w-[335px] rounded-full border border-white/10" />
  </div>
);

const CoverAnalytics = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);

  return (
    <AnalyticsCanvas>
      <DarkAnalyticsBackdrop
        imageAlt={parsed.backgroundImageAlt}
        imageUrl={parsed.backgroundImageUrl}
        showImage={parsed.showBackgroundImage}
      />

      {parsed.showDecoration ? <CoverRings /> : null}

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-[64px] pb-[52px] text-center">
        <div className="mb-[32px]">
          <ExpandedLabel text={parsed.seriesLabel} />
        </div>

        <ComparisonHeroTitle
          dividerLabel={parsed.comparisonLabel}
          primary={parsed.primarySubject}
          secondary={parsed.secondarySubject}
        />

        <div className="mt-[42px] max-w-[820px]">
          <div className="text-[26px] font-light leading-[1.25] tracking-wide text-slate-100">{parsed.subtitle}</div>
          <div className="mt-[10px] text-[18px] font-light leading-[1.35] text-slate-400">{parsed.scope}</div>
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

export default CoverAnalytics;
