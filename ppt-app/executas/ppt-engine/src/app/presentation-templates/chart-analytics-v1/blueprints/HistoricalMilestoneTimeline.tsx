import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import AnalyticsCanvas from "../components/AnalyticsCanvas.tsx";
import AnalyticsSourceFooter from "../components/AnalyticsSourceFooter.tsx";
import ExecutiveHeader from "../components/ExecutiveHeader.tsx";
import HorizontalMilestoneTimeline, { type MilestoneTimelineItem } from "../components/HorizontalMilestoneTimeline.tsx";
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

const MilestoneSchema = z.object({
  period: z.string().min(2).max(12),
  title: z.string().min(2).max(34),
  description: z.string().min(8).max(170),
  icon: IconSchema.default("chart-column"),
  color: z.string().min(3).max(64).optional(),
});

const DEFAULT_MILESTONES: z.infer<typeof MilestoneSchema>[] = [
  {
    period: "Phase 1",
    title: "Opening Window",
    description: "Use this milestone to introduce the starting condition, first catalyst, or earliest period in the timeline.",
    icon: "broadcast",
  },
  {
    period: "Phase 2",
    title: "Formal Alignment",
    description: "Describe the agreement, policy shift, launch moment, or public commitment that reset the relationship.",
    icon: "users",
  },
  {
    period: "Phase 3",
    title: "Institutional Build",
    description: "Capture the treaty, operating model, platform, or repeated mechanism that converted intent into structure.",
    icon: "file-signature",
  },
  {
    period: "Phase 4",
    title: "Strategic Expansion",
    description: "Summarize the period when cooperation, scale, or geographic reach broadened beyond the initial scope.",
    icon: "chart-line",
  },
  {
    period: "Phase 5",
    title: "Pressure Point",
    description: "Use this card for a dispute, market shock, execution risk, or turning point that changed the trajectory.",
    icon: "shield",
  },
  {
    period: "Current",
    title: "New Equilibrium",
    description: "Close with the present operating balance, unresolved tension, next action window, or strategic implication.",
    icon: "gauge",
  },
];

export const Schema = z.object({
  eyebrow: z.string().min(2).max(40).default("Historical Context"),
  title: z.string().min(4).max(78).default("Key Milestones Timeline"),
  headerMetaLabel: z.string().min(2).max(24).default("Timeline"),
  headerMetaValue: z.string().min(2).max(40).default("Phase 1 - Current"),
  headerIcon: IconSchema.default("chart-line"),
  milestones: z.array(MilestoneSchema).min(4).max(6).default(DEFAULT_MILESTONES),
  footerSource: z.string().min(4).max(140).default("Sources: public records, research notes, and analyst synthesis"),
  confidentialityLabel: z.string().min(2).max(32).default("CONFIDENTIAL"),
  slideLabel: z.string().min(2).max(18).default("SLIDE 10"),
});

export const layoutId = "historical-milestone-timeline";
export const layoutName = "Historical Milestone Timeline";
export const layoutDescription =
  "A TSX-first horizontal milestone timeline with a dark analytics header, six editable period nodes, connected axis, milestone cards, and a source footer.";
export const layoutTags = ["timeline", "milestones", "history", "roadmap", "context", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["header", "horizontal-axis", "milestone-nodes", "milestone-cards", "source-footer"];
export const useCases = ["historical-context", "milestone-analysis", "policy-timeline", "project-roadmap", "relationship-history"];
export const suitableFor =
  "Suitable for explaining four to six chronological milestones such as historical relations, policy evolution, product roadmaps, project phases, or strategic turning points.";
export const avoidFor =
  "Avoid using this layout for dense event chronologies with more than six entries, quantitative trend analysis needing a chart axis, or pages requiring long narrative paragraphs.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";


const HistoricalMilestoneTimeline = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
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

      <div className="h-[582px] px-[48px] py-[30px]" style={{ backgroundColor: chartAnalyticsTheme.colors.surface }}>
        <HorizontalMilestoneTimeline items={parsed.milestones as MilestoneTimelineItem[]} />
      </div>

      <AnalyticsSourceFooter
        source={parsed.footerSource}
        slideLabel={parsed.slideLabel}
        confidentialityLabel={parsed.confidentialityLabel}
      />
    </AnalyticsCanvas>
  );
};

export default HistoricalMilestoneTimeline;
