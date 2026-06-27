import React from "react";
import * as z from "zod";

import AnalyticsCanvas from "../components/AnalyticsCanvas.tsx";
import DarkAnalyticsBackdrop from "../components/DarkAnalyticsBackdrop.tsx";
import ExpandedLabel from "../components/ExpandedLabel.tsx";
import ReportMetaFooter from "../components/ReportMetaFooter.tsx";
import { chartAnalyticsTheme } from "../theme/tokens.ts";

export const Schema = z.object({
  seriesLabel: z.string().min(2).max(64).default("Global Intelligence Series"),
  backgroundImageUrl: z
    .string()
    .url()
    .default("https://page.talentsecsite.com/slides_images/6722217b327d461901b4f6677362a773.webp"),
  backgroundImageAlt: z.string().min(2).max(80).default("City skyline background"),
  headline: z.string().min(2).max(34).default("Thank You"),
  subtitle: z.string().min(4).max(80).default("Questions, decisions, and next steps"),
  closingMessage: z
    .string()
    .min(8)
    .max(180)
    .default("Use this closing page to restate the key decision, request feedback, or point the audience to the next action."),
  primaryLabel: z.string().min(2).max(28).default("Next Step"),
  primaryValue: z.string().min(2).max(56).default("Align on priority actions"),
  secondaryLabel: z.string().min(2).max(28).default("Follow-up"),
  secondaryValue: z.string().min(2).max(56).default("Share supporting evidence pack"),
  contactLabel: z.string().min(2).max(32).default("Contact"),
  contactValue: z.string().min(2).max(64).default("Talentsec AI Analytics"),
  dateLabel: z.string().min(2).max(32).default("Report Date"),
  reportDate: z.string().min(4).max(32).default("March 03, 2026"),
  showBackgroundImage: z.boolean().default(true),
});

export const layoutId = "closing-analytics";
export const layoutName = "Closing Analytics";
export const layoutDescription =
  "A dark analytics closing page with a concise thank-you headline, two next-step callouts, contact metadata, and report date.";
export const layoutTags = ["closing", "thank-you", "next-steps", "analytics", "dark", "tsx-first"];
export const layoutRole = "closing";
export const contentElements = ["headline", "closing-message", "next-step-callouts", "contact-meta", "date-meta"];
export const useCases = ["closing", "thank-you", "decision-request", "next-steps"];
export const suitableFor = "Suitable for the final page of an analytics deck when the presenter needs a polished close and clear next steps.";
export const avoidFor = "Avoid using this layout for body analysis, chart-heavy pages, agendas, or dense evidence summaries.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const readData = (data: Partial<z.infer<typeof Schema>>): z.infer<typeof Schema> => Schema.parse(data ?? {});

const ClosingCallout = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-[8px] border border-white/10 bg-white/[0.06] px-[24px] py-[18px] text-left">
    <div className="text-[11px] font-bold uppercase leading-[1.2]" style={{ color: "#60A5FA" }}>
      {label}
    </div>
    <div className="mt-[8px] truncate text-[18px] font-bold leading-[1.25] text-white">{value}</div>
  </div>
);

const ClosingAnalytics = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readData(data);

  return (
    <AnalyticsCanvas>
      <DarkAnalyticsBackdrop
        imageAlt={parsed.backgroundImageAlt}
        imageUrl={parsed.backgroundImageUrl}
        showImage={parsed.showBackgroundImage}
      />

      <div className="absolute left-[68px] top-[58px] z-[1]">
        <ExpandedLabel text={parsed.seriesLabel} />
      </div>

      <div className="relative z-10 flex h-full flex-col justify-center px-[68px] pb-[112px] pt-[116px]">
        <div className="max-w-[880px]">
          <div
            className="text-[98px] font-black leading-none tracking-normal text-white"
            style={{ fontFamily: chartAnalyticsTheme.fonts.display }}
          >
            {parsed.headline}
          </div>
          <div className="mt-[24px] text-[28px] font-light leading-[1.2] text-slate-100">{parsed.subtitle}</div>
          <div className="mt-[18px] max-w-[720px] text-[17px] leading-[1.5] text-slate-400">{parsed.closingMessage}</div>
        </div>

        <div className="mt-[42px] grid w-[760px] grid-cols-2 gap-[18px]">
          <ClosingCallout label={parsed.primaryLabel} value={parsed.primaryValue} />
          <ClosingCallout label={parsed.secondaryLabel} value={parsed.secondaryValue} />
        </div>
      </div>

      <ReportMetaFooter
        leftLabel={parsed.contactLabel}
        leftValue={parsed.contactValue}
        rightLabel={parsed.dateLabel}
        rightValue={parsed.reportDate}
      />
    </AnalyticsCanvas>
  );
};

export default ClosingAnalytics;
