import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import FinanceContentFrame from "../components/FinanceContentFrame.tsx";
import FinanceSectionHeading from "../components/FinanceSectionHeading.tsx";
import { FinanceIcon } from "../components/FinanceIcons.tsx";
import IconTextCard from "../components/IconTextCard.tsx";
import InfoListItem from "../components/InfoListItem.tsx";
import InsightCallout from "../components/InsightCallout.tsx";
import { redFinanceTheme } from "../theme/tokens.ts";

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

const NarrativeItemSchema = z.object({
  icon: IconSchema,
  title: z.string().min(2).max(28),
  description: z.string().min(8).max(96),
});

const EvidenceCardSchema = z.object({
  icon: IconSchema,
  title: z.string().min(2).max(24),
  description: z.string().min(8).max(84),
  tag: z.string().min(2).max(18).default("evidence"),
});

export const Schema = z.object({
  title: z.string().min(2).max(28).default("Two Column Insight"),
  metaLabel: z.string().min(2).max(48).default("BLUEPRINT / TWO COLUMN"),
  footerText: z.string().min(6).max(80).default("Business Professional | Two Column Insight"),
  pageNumber: z.string().min(1).max(4).default("03"),
  variant: z.enum(["narrative-left-evidence-right", "evidence-left-narrative-right"]).default(
    "narrative-left-evidence-right",
  ),
  density: z.enum(["low", "medium", "high"]).default("medium"),
  narrativeTitle: z.string().min(2).max(28).default("Core judgment"),
  narrativeSummary: z.string().min(8).max(96).default("Use one side for the main argument and the other for compact supporting evidence."),
  narrativeItems: z.array(NarrativeItemSchema).min(2).max(4).default([
    {
      icon: "lightbulb",
      title: "Lead with the answer",
      description: "State the judgment first, then explain it through structured evidence.",
    },
    {
      icon: "shield",
      title: "Evidence discipline",
      description: "Keep evidence selective so the two columns do not become dense tables.",
    },
    {
      icon: "route",
      title: "Clear handoff",
      description: "Close with a concise callout that naturally leads into the next slide.",
    },
  ]),
  evidenceTitle: z.string().min(2).max(28).default("Supporting evidence"),
  evidenceSubtitle: z.string().max(72).optional(),
  evidenceCards: z.array(EvidenceCardSchema).min(2).max(4).default([
    {
      icon: "chart-column",
      title: "Scale shift",
      description: "Use compact metric cards to show movement and relative position.",
      tag: "scale",
    },
    {
      icon: "bank",
      title: "Structural gap",
      description: "Break complex facts into two to four lightweight evidence cards.",
      tag: "structure",
    },
    {
      icon: "coins",
      title: "Operating signal",
      description: "Keep key judgments editable instead of burying them in long prose.",
      tag: "signal",
    },
  ]),
  conclusion: z.string().min(8).max(120).default("Use this page to explain one argument and support it with a few focused facts."),
});

export const layoutId = "two-column-insight";
export const layoutName = "Two Column Insight";
export const layoutDescription =
  "A tsx-first two-column slide with a primary narrative side and a compact evidence side.";
export const layoutTags = ["two-column", "insight", "analysis", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["headline", "narrative-list", "evidence-cards", "callout"];
export const useCases = ["overview", "insight", "analysis", "explanation"];
export const suitableFor = "Suitable for pages that need one main argument and a small set of supporting facts.";
export const avoidFor = "Avoid using this layout for timelines, full comparison matrices, or pure KPI dashboards.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const TwoColumnInsight = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);
  const isEvidenceFirst = parsed.variant === "evidence-left-narrative-right";
  const density = parsed.density === "low" ? "compact" : parsed.density === "high" ? "dense" : "normal";
  const cardColumns = parsed.density === "high" ? "grid-cols-2" : "grid-cols-1";

  const narrativePane = (
    <div className="flex h-full min-h-0 flex-col gap-[12px]">
      <FinanceSectionHeading
        title={parsed.narrativeTitle}
        subtitle={parsed.narrativeSummary}
        marginBottom={0}
        subtitleLayout="stacked"
      />
      <div
        className="grid min-h-0 flex-1"
        style={{
          gridTemplateRows: `repeat(${parsed.narrativeItems.length}, minmax(0, 1fr))`,
        }}
      >
        {parsed.narrativeItems.map((item, index) => (
          <InfoListItem
            key={`${item.title}-${index}`}
            icon={item.icon}
            title={item.title}
            description={item.description}
            showDivider={index < parsed.narrativeItems.length - 1}
            density={density}
            textScale={parsed.density === "high" ? "small" : "normal"}
            descriptionMaxLines={parsed.density === "high" ? 2 : 3}
            fillHeight
            verticalAlign="center"
          />
        ))}
      </div>
      <div className="flex-none">
        <InsightCallout text={parsed.conclusion} density={density} icon="lightbulb" />
      </div>
    </div>
  );

  const evidencePane = (
    <div className="flex h-full min-h-0 flex-col gap-[12px]">
      <FinanceSectionHeading
        title={parsed.evidenceTitle}
        subtitle={parsed.evidenceSubtitle}
        marginBottom={0}
      />
      <div
        className={`grid min-h-0 flex-1 ${cardColumns} gap-[12px]`}
        style={{
          gridTemplateRows:
            parsed.density === "high"
              ? undefined
              : `repeat(${parsed.evidenceCards.length}, minmax(0, 1fr))`,
        }}
      >
        {parsed.evidenceCards.map((card) => (
          <IconTextCard
            key={card.title}
            icon={card.icon}
            title={card.title}
            description={card.description}
            variant="compact"
            density={parsed.density === "high" ? "compact" : "normal"}
            align="left"
            descriptionMaxLines={3}
            cardPaddingX={14}
            cardPaddingTop={14}
            cardPaddingBottom={12}
            minHeight={118}
            iconBackgroundColor={redFinanceTheme.colors.paleRed}
          />
        ))}
      </div>
    </div>
  );

  return (
    <FinanceContentFrame
      title={parsed.title}
      metaIcon={<FinanceIcon name="bank" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={160}
      contentBottomInset={12}
    >
      <div className={`grid h-full min-h-0 gap-[24px] ${isEvidenceFirst ? "grid-cols-[1.08fr_0.92fr]" : "grid-cols-[0.98fr_1.02fr]"}`}>
        {isEvidenceFirst ? evidencePane : narrativePane}
        {isEvidenceFirst ? narrativePane : evidencePane}
      </div>
    </FinanceContentFrame>
  );
};

export default TwoColumnInsight;
