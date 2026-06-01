import React from "react";
import * as z from "zod";

import FinanceContentFrame from "../components/FinanceContentFrame.tsx";
import FinanceSectionHeading from "../components/FinanceSectionHeading.tsx";
import { FinanceIcon } from "../components/FinanceIcons.tsx";
import HorizontalFeatureCard from "../components/HorizontalFeatureCard.tsx";
import InfoListItem from "../components/InfoListItem.tsx";
import InsightCallout from "../components/InsightCallout.tsx";

const IconSchema = z.enum([
  "bank",
  "bolt",
  "brain",
  "chart-column",
  "chart-line",
  "chart-pie",
  "coins",
  "compass",
  "database",
  "document",
  "gavel",
  "grid",
  "laptop-code",
  "lightbulb",
  "microchip",
  "route",
  "shield",
  "wallet",
]);

const ActionSchema = z.object({
  icon: IconSchema,
  title: z.string().min(2).max(28),
  description: z.string().min(8).max(96),
});

export const Schema = z.object({
  title: z.string().min(2).max(28).default("Closing Actions"),
  metaLabel: z.string().min(2).max(48).default("BLUEPRINT / CLOSING"),
  footerText: z.string().min(6).max(80).default("Business Professional | Closing Actions"),
  pageNumber: z.string().min(1).max(4).default("09"),
  variant: z.enum(["conclusion-plus-actions", "decision-ask-focus"]).default("conclusion-plus-actions"),
  density: z.enum(["medium", "high"]).default("medium"),
  heading: z.string().min(2).max(32).default("Conclusion and actions"),
  finalTitle: z.string().min(2).max(32).default("Final judgment"),
  finalText: z.string().min(8).max(120).default("Close the deck with a concise conclusion and clear actions."),
  actions: z.array(ActionSchema).min(3).max(5).default([
    { icon: "route", title: "Prioritize", description: "Define priorities and the focus for the next 30 days."},
    { icon: "shield", title: "Validate", description: "Check risks, assumptions, and critical dependencies."},
    { icon: "lightbulb", title: "Decide", description: "Clarify what needs confirmation or authorization."},
  ]),
  decisionAsk: z.string().max(120).optional(),
  summary: z.string().min(8).max(120).default("A closing slide should make next steps explicit, not just repeat a slogan."),
});

export const layoutId = "closing-actions";
export const layoutName = "Closing Actions";
export const layoutDescription =
  "A tsx-first closing slide for conclusions, actions, and decision requests.";
export const layoutTags = ["closing", "actions", "decision", "tsx-first"];
export const layoutRole = "closing";
export const contentElements = ["final-message", "action-list", "decision-ask"];
export const useCases = ["conclusion", "recommendation", "next-actions", "decision"];
export const suitableFor = "Suitable for the final page of a deck when the agent needs to state conclusions and actions.";
export const avoidFor = "Avoid using this layout for section transitions or analytical deep dives.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const ClosingActions = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const actionDensity = parsed.density === "high" ? "dense" : "compact";
  const decisionAsk = parsed.decisionAsk ?? parsed.summary;

  return (
    <FinanceContentFrame
      title={parsed.title}
      metaIcon={<FinanceIcon name="flag" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={156}
      contentBottomInset={12}
    >
      <div className="grid h-full min-h-0 grid-cols-[0.96fr_1.04fr] gap-[18px]">
        <div className="flex h-full flex-col gap-[14px]">
          <FinanceSectionHeading title={parsed.heading} subtitle="final wrap-up" />
          <InsightCallout text={parsed.finalText} density={parsed.density === "high" ? "compact" : "normal"} icon="flag" />
          <div className="rounded-[8px] border bg-white p-[14px]">
            <div className="mb-[10px] text-[13px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--primary-color,#B71C1C)" }}>
              {parsed.finalTitle}
            </div>
            <div className="text-[14px] leading-[1.55]" style={{ color: "var(--background-text,#212121)" }}>
              {parsed.summary}
            </div>
          </div>
          {parsed.variant === "decision-ask-focus" ? (
            <div className="rounded-[8px] border bg-white p-[14px]">
              <div className="mb-[8px] text-[13px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--primary-color,#B71C1C)" }}>
                Decision ask
              </div>
              <div className="text-[14px] leading-[1.55]" style={{ color: "var(--background-text,#212121)" }}>
                {decisionAsk}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex h-full flex-col gap-[12px]">
          {parsed.actions.map((action, index) => (
            <HorizontalFeatureCard
              key={`${action.title}-${index}`}
              iconName={action.icon}
              title={action.title}
              description={action.description}
              tone={index === 0 ? "accent" : "default"}
              density={actionDensity}
              minHeight={96}
              titleFontSize={16}
              descriptionFontSize={13}
              descriptionLineHeight={1.45}
            />
          ))}
          {parsed.variant === "conclusion-plus-actions" ? (
            <InfoListItem
              icon="lightbulb"
              title="Next step"
              description={decisionAsk}
              showDivider={false}
              density={parsed.density === "high" ? "dense" : "compact"}
              textScale={parsed.density === "high" ? "small" : "normal"}
              descriptionMaxLines={3}
            />
          ) : null}
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default ClosingActions;
