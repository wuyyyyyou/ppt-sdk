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
  headline: z.string().min(2).max(34).default("Thank You"),
  subtitle: z.string().min(4).max(80).default("Decisions, questions, and next steps"),
  closingMessage: z
    .string()
    .min(8)
    .max(180)
    .default("Use this low-density closing canvas for contact details, a decision request, or follow-up actions."),
  primaryLabel: z.string().min(2).max(28).default("Next Step"),
  primaryValue: z.string().min(2).max(56).default("Confirm decision path"),
  secondaryLabel: z.string().min(2).max(28).default("Follow-up"),
  secondaryValue: z.string().min(2).max(56).default("Share source appendix"),
  contactLabel: z.string().min(2).max(32).default("Contact"),
  contactValue: z.string().min(2).max(64).default("Analytics Authoring Workspace"),
  dateLabel: z.string().min(2).max(32).default("Report Date"),
  reportDate: z.string().min(4).max(32).default("2026"),
});

export const sampleData = Schema.parse({});

export const layoutId = "closing-canvas";
export const layoutName = "Closing Canvas";
export const layoutDescription =
  "A low-density dark analytics closing canvas with headline, message, two short next-step callouts, and footer metadata.";
export const layoutTags = ["closing", "thank-you", "canvas", "analytics", "component-first", "tsx-first"];
export const layoutRole = "closing";
export const contentElements = ["headline", "closing-message", "next-step-callouts", "footer-meta"];
export const useCases = ["closing", "thank-you", "contact", "next-steps"];
export const suitableFor = "Suitable for final thank-you, contact, or next-step slides.";
export const avoidFor = "Avoid for analytical conclusions that still need charts, matrices, or dense recommendations.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const ClosingCallout = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-[8px] border border-white/10 bg-white/[0.06] px-[24px] py-[18px] text-left">
    <div className="text-[11px] font-bold uppercase leading-[1.2]" style={{ color: "#60A5FA" }}>
      {label}
    </div>
    <div className="mt-[8px] truncate text-[18px] font-bold leading-[1.25] text-white">{value}</div>
  </div>
);

const ClosingCanvas = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);

  return (
    <AnalyticsCanvas>
      <DarkAnalyticsBackdrop showImage={false} />

      <div className="absolute left-[68px] top-[58px] z-[1]">
        <ExpandedLabel text={parsed.seriesLabel} />
      </div>

      <div className="relative z-10 flex h-full flex-col justify-center px-[68px] pb-[112px] pt-[116px]">
        <div className="max-w-[880px]">
          <div
            className="text-[96px] font-black leading-none text-white"
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

export default ClosingCanvas;
