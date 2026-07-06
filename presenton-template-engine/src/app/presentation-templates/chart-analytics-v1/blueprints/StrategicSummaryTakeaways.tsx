import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import AnalyticsCanvas from "../components/AnalyticsCanvas.tsx";
import AnalyticsSourceFooter from "../components/AnalyticsSourceFooter.tsx";
import ExecutiveHeader from "../components/ExecutiveHeader.tsx";
import SummaryInsightCard from "../components/SummaryInsightCard.tsx";
import SummaryOutcomeCard from "../components/SummaryOutcomeCard.tsx";
import { chartAnalyticsTheme } from "../theme/tokens.ts";

const IconSchema = z.enum([
  "binoculars",
  "bolt",
  "broadcast",
  "chart-column",
  "chart-line",
  "chart-pie",
  "file-signature",
  "flask",
  "gauge",
  "grid",
  "robot",
  "scale",
  "shield",
  "users",
  "wallet",
]);

const SummaryRowSchema = z.object({
  label: z.string().min(1).max(18),
  text: z.string().min(4).max(92),
  labelColor: z.string().min(3).max(64).optional(),
});

const SummaryInsightSchema = z.object({
  indexLabel: z.string().min(1).max(8),
  title: z.string().min(2).max(42),
  description: z.string().min(8).max(130),
  icon: IconSchema.default("chart-pie"),
  accentColor: z.string().min(3).max(64).optional(),
  iconTint: z.string().min(3).max(64).optional(),
  iconColor: z.string().min(3).max(64).optional(),
  rows: z.array(SummaryRowSchema).min(2).max(3),
});

const OutcomeCardSchema = z.object({
  title: z.string().min(2).max(58),
  text: z.string().min(8).max(190),
  icon: IconSchema.default("chart-line"),
  accentColor: z.string().min(3).max(64).optional(),
  iconTint: z.string().min(3).max(64).optional(),
  tags: z.array(z.string().min(2).max(20)).max(4).default([]),
  kicker: z.string().min(2).max(48).optional(),
});

const DEFAULT_TOP_CARDS: z.infer<typeof SummaryInsightSchema>[] = [
  {
    indexLabel: "01",
    title: "Scale vs. Quality",
    description: "Use this takeaway to summarize the core structural tradeoff:",
    icon: "chart-pie",
    rows: [
      { label: "Entity A", text: "Leads on aggregate scale or market reach" },
      { label: "Entity B", text: "Leads on quality, margin, or maturity" },
    ],
  },
  {
    indexLabel: "02",
    title: "Risk Timing",
    description: "Use this takeaway to distinguish shared risks by urgency:",
    icon: "users",
    rows: [
      { label: "Entity B", text: "Manages a mature, known constraint" },
      { label: "Entity A", text: "Faces a faster transition or sharper inflection" },
    ],
  },
  {
    indexLabel: "03",
    title: "Speed vs. Control",
    description: "Use this takeaway to compare operating models:",
    icon: "robot",
    rows: [
      { label: "Entity A", text: "Prioritizes rapid piloting and scale" },
      { label: "Entity B", text: "Prioritizes precision, standards, and assurance" },
    ],
  },
];

export const Schema = z.object({
  eyebrow: z.string().min(2).max(36).default("Conclusion"),
  title: z.string().min(4).max(76).default("Strategic Summary: Key Takeaways"),
  headerMetaLabel: z.string().min(2).max(24).default("Horizon"),
  headerMetaValue: z.string().min(2).max(32).default("2026 - 2030"),
  headerIcon: IconSchema.default("shield"),
  topCards: z.array(SummaryInsightSchema).min(3).max(3).default(DEFAULT_TOP_CARDS),
  interdependenceCard: OutcomeCardSchema.default({
    title: "Resilient Interdependence",
    text: "Use this card to summarize the shared dependency, partnership, or integration that remains important despite strategic friction.",
    icon: "broadcast",
    tags: ["Category A", "Category B", "Category C"],
  }),
  outlookCard: OutcomeCardSchema.default({
    title: "Forward Outlook",
    text: "Use this card to state the decisive variable that will shape the next planning horizon.",
    icon: "bolt",
    tags: [],
    kicker: "Key Differentiator: Execution",
  }),
  sourceNote: z.string().min(2).max(150).default("Summary derived from the analysis in this deck"),
  confidentialityLabel: z.string().min(2).max(24).default("CONFIDENTIAL"),
  slideLabel: z.string().min(2).max(18).default("SLIDE 13"),
});

export const layoutId = "strategic-summary-takeaways";
export const layoutName = "Strategic Summary Takeaways";
export const layoutDescription =
  "A TSX-first conclusion page with a dark executive header, three key takeaway cards, two bottom strategic outcome cards, and a source footer.";
export const layoutTags = ["summary", "takeaways", "conclusion", "insight-cards", "strategy", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["header", "takeaway-card-grid", "summary-outcome-cards", "source-footer"];
export const useCases = ["strategic-summary", "key-takeaways", "executive-conclusion", "comparison-wrap-up", "recommendation-summary"];
export const suitableFor =
  "Suitable for conclusion or synthesis pages that need to summarize three strategic takeaways and close with two short implications or outlook statements.";
export const avoidFor =
  "Avoid using this layout for chart-heavy evidence pages, long prose narratives, dense matrices, or pages needing more than three top-level takeaways.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";


const StrategicSummaryTakeaways = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);
  const cardTones = [
    chartAnalyticsTheme.tone.signalPrimary,
    chartAnalyticsTheme.tone.signalRisk,
    chartAnalyticsTheme.tone.signalTertiary,
  ];
  const entityLabelColors = [chartAnalyticsTheme.colors.entityPrimary, chartAnalyticsTheme.colors.entitySecondary];
  const topCards = parsed.topCards.map((card, cardIndex) => {
    const tone = cardTones[cardIndex % cardTones.length];

    return {
      ...card,
      accentColor: card.accentColor ?? tone.color,
      iconTint: card.iconTint ?? tone.tint,
      iconColor: card.iconColor ?? tone.color,
      rows: card.rows.map((row, rowIndex) => ({
        ...row,
        labelColor: row.labelColor ?? entityLabelColors[rowIndex % entityLabelColors.length],
      })),
    };
  });

  return (
    <AnalyticsCanvas variant="light">
      <ExecutiveHeader
        eyebrow={parsed.eyebrow}
        title={parsed.title}
        metaLabel={parsed.headerMetaLabel}
        metaValue={parsed.headerMetaValue}
        icon={parsed.headerIcon}
      />

      <div className="flex h-[620px] flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-[20px] px-[48px] py-[24px]" style={{ backgroundColor: chartAnalyticsTheme.colors.surface }}>
          <div className="grid h-[276px] grid-cols-3 gap-[24px]">
            {topCards.map((card) => (
              <SummaryInsightCard key={`${card.indexLabel}-${card.title}`} {...card} />
            ))}
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-2 gap-[24px]">
            <SummaryOutcomeCard
              {...parsed.interdependenceCard}
              accentColor={parsed.interdependenceCard.accentColor ?? chartAnalyticsTheme.colors.signalSecondary}
              iconTint={parsed.interdependenceCard.iconTint ?? chartAnalyticsTheme.colors.signalSecondaryTint}
            />
            <SummaryOutcomeCard
              {...parsed.outlookCard}
              accentColor={parsed.outlookCard.accentColor ?? chartAnalyticsTheme.colors.signalSuccess}
              iconTint={parsed.outlookCard.iconTint ?? chartAnalyticsTheme.colors.darkCallout}
              dark
            />
          </div>
        </div>

        <AnalyticsSourceFooter
          source={parsed.sourceNote}
          confidentialityLabel={parsed.confidentialityLabel}
          slideLabel={parsed.slideLabel}
          height={38}
          backgroundColor={chartAnalyticsTheme.colors.card}
        />
      </div>
    </AnalyticsCanvas>
  );
};

export default StrategicSummaryTakeaways;
