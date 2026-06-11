import React from "react";
import * as z from "zod";

import RedBlueCanvas from "../components/RedBlueCanvas.tsx";
import RedBlueCoverBackdrop from "../components/RedBlueCoverBackdrop.tsx";
import RedBlueInsightCard from "../components/RedBlueInsightCard.tsx";
import RedBlueStatHero from "../components/RedBlueStatHero.tsx";
import { redBlueTheme } from "../theme/tokens.ts";

export const Schema = z.object({
  title: z.string().max(52).default(""),
  subtitle: z.string().max(96).default(""),
  statistic: z.string().min(1).max(16).default("3"),
  statisticLabel: z.string().min(2).max(40).default("Key decisions"),
  statisticDescription: z.string().min(4).max(120).default("Close with the actions, owners, or decisions that should follow from the analysis."),
  contactTitle: z.string().min(2).max(40).default("Next step"),
  contactText: z.string().min(4).max(140).default("Align on the evidence gaps and confirm the recommendation path."),
});

export const layoutId = "closing-summary";
export const layoutName = "Closing Summary";
export const layoutDescription = "Closing page with a central number and next-step card.";
export const layoutTags = ["closing", "summary", "red-blue"];
export const layoutRole = "closing";
export const contentElements = ["title", "number-callout", "insight"];
export const useCases = ["closing", "executive-brief", "next-steps"];
export const suitableFor = "Suitable for decision summaries or final next steps.";
export const avoidFor = "Avoid for evidence-heavy middle pages.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

export const sampleData = {
  title: "",
  subtitle: "",
  statistic: "3",
  statisticLabel: "Priority decisions",
  statisticDescription:
    "Close with the decisions, owners, or evidence gaps that should follow from the comparison.",
  contactTitle: "Next step",
  contactText:
    "Confirm the comparison scope, validate source data, and align on the recommended strategic path.",
} satisfies z.infer<typeof Schema>;

const ClosingSummary = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <RedBlueCanvas showGrid={false} showDecorations={false}>
      <RedBlueCoverBackdrop variant="thank-you" />
      {parsed.title || parsed.subtitle ? (
        <div className="absolute left-[82px] top-[70px]">
          {parsed.title ? (
            <div className="text-[58px] font-black leading-none" style={{ color: redBlueTheme.colors.backgroundText, fontFamily: redBlueTheme.fonts.heading }}>
              {parsed.title}
            </div>
          ) : null}
          {parsed.subtitle ? (
            <div className="mt-[12px] text-[22px] font-semibold" style={{ color: redBlueTheme.colors.mutedText }}>
              {parsed.subtitle}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="absolute inset-x-[220px] top-[96px] bottom-[110px]">
        <RedBlueStatHero statistic={parsed.statistic} subtitle={parsed.statisticLabel} description={parsed.statisticDescription} />
      </div>
      <div className="absolute bottom-[72px] left-[410px] w-[460px]">
        <RedBlueInsightCard title={parsed.contactTitle} text={parsed.contactText} tone="purple" />
      </div>
    </RedBlueCanvas>
  );
};

export default ClosingSummary;
