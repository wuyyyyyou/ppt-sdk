import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import AnalyticsCanvas from "../components/AnalyticsCanvas.tsx";
import ComparisonMatrixBoard from "../components/ComparisonMatrixBoard.tsx";
import ExecutiveHeader from "../components/ExecutiveHeader.tsx";
import { AnalyticsIcon } from "../components/AnalyticsIcons.tsx";
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

const EntitySchema = z.object({
  name: z.string().min(1).max(24),
  tagline: z.string().min(2).max(32),
  accentColor: z.string().min(3).max(64),
  tintColor: z.string().min(3).max(64),
  icon: IconSchema.default("chart-column"),
});

const MatrixCellSchema = z.object({
  icon: IconSchema.default("bolt"),
  title: z.string().min(2).max(36),
  description: z.string().min(8).max(132),
});

const MatrixRowSchema = z.object({
  dimension: z.string().min(2).max(28),
  icon: IconSchema.default("grid"),
  left: MatrixCellSchema,
  right: MatrixCellSchema,
});

const DEFAULT_ENTITIES: z.infer<typeof EntitySchema>[] = [
  {
    name: "Entity A",
    tagline: "Speed & Scale",
    accentColor: chartAnalyticsTheme.colors.primary,
    tintColor: "#EFF6FF",
    icon: "chart-line",
  },
  {
    name: "Entity B",
    tagline: "Quality & Control",
    accentColor: chartAnalyticsTheme.colors.accentTeal,
    tintColor: "#F0FDFA",
    icon: "scale",
  },
];

const DEFAULT_ROWS: z.infer<typeof MatrixRowSchema>[] = [
  {
    dimension: "Decision Model",
    icon: "scale",
    left: {
      icon: "bolt",
      title: "Fast Leadership Call",
      description: "A small leadership group makes tradeoffs quickly and adapts direction as new signals appear.",
    },
    right: {
      icon: "users",
      title: "Consensus Alignment",
      description: "Stakeholders align before commitment so execution is coordinated once the decision is made.",
    },
  },
  {
    dimension: "Risk Posture",
    icon: "gauge",
    left: {
      icon: "chart-line",
      title: "Pilot and Iterate",
      description: "Teams move with a good-enough first version, then use operating feedback to improve the offer.",
    },
    right: {
      icon: "shield",
      title: "Validate Before Scale",
      description: "Teams test thoroughly before launch to reduce defects, reputation risk, and downstream rework.",
    },
  },
  {
    dimension: "Trust Basis",
    icon: "users",
    left: {
      icon: "grid",
      title: "Personal Networks",
      description: "Individual relationships and informal channels help accelerate access, trust, and coordination.",
    },
    right: {
      icon: "broadcast",
      title: "Institutional Reliability",
      description: "Trust accumulates through organizational reputation, proven delivery, and long-term partnership.",
    },
  },
  {
    dimension: "Agreement Style",
    icon: "file-signature",
    left: {
      icon: "bolt",
      title: "Adaptive Terms",
      description: "Contracts frame the current understanding and may be revisited when conditions materially change.",
    },
    right: {
      icon: "file-signature",
      title: "Strict Commitment",
      description: "Detailed specifications and agreed terms set clear obligations that teams are expected to honor.",
    },
  },
  {
    dimension: "Communication",
    icon: "broadcast",
    left: {
      icon: "chart-line",
      title: "Outcome Directness",
      description: "Communication can be high-context, but practical results often justify direct escalation.",
    },
    right: {
      icon: "users",
      title: "Context Sensitivity",
      description: "Signals, silence, and face-saving norms shape how disagreement and concern are surfaced.",
    },
  },
];

export const Schema = z.object({
  eyebrow: z.string().min(2).max(36).default("Business Practices"),
  title: z.string().min(4).max(78).default("Business Practice Differences: Entity A vs Entity B"),
  headerMetaLabel: z.string().min(2).max(24).default("Focus Area"),
  headerMetaValue: z.string().min(2).max(40).default("Values & Behavior"),
  headerIcon: IconSchema.default("scale"),
  dimensionLabel: z.string().min(2).max(22).default("Dimension"),
  entities: z.array(EntitySchema).min(2).max(2).default(DEFAULT_ENTITIES),
  rows: z.array(MatrixRowSchema).min(3).max(6).default(DEFAULT_ROWS),
  implicationLabel: z.string().min(2).max(24).default("Implication"),
  implicationText: z.string().min(8).max(160).default("Use the matrix to choose different engagement styles for each entity instead of forcing one operating model."),
  implicationIcon: IconSchema.default("bolt"),
  implicationAccentColor: z.string().min(3).max(64).default(chartAnalyticsTheme.colors.accentIndigo),
  slideLabel: z.string().min(2).max(18).default("SLIDE 09"),
});

export const layoutId = "business-practice-matrix";
export const layoutName = "Business Practice Matrix";
export const layoutDescription =
  "A TSX-first two-entity business practice comparison matrix with a dark analytics header, entity lanes, dimension icons, row-level contrast points, and an implication bar.";
export const layoutTags = ["comparison", "matrix", "business-practices", "culture", "two-entity", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["header", "entity-comparison-headers", "dimension-matrix", "row-contrast-points", "implication-bar"];
export const useCases = ["business-culture-comparison", "operating-model-benchmark", "partner-due-diligence", "market-entry-playbook", "practice-comparison"];
export const suitableFor =
  "Suitable for comparing two entities across three to six qualitative dimensions, especially business culture, operating model, risk posture, and engagement practices.";
export const avoidFor =
  "Avoid using this layout for numeric time-series analysis, single-entity narratives, more than two compared entities, or tables requiring long paragraphs in each cell.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";


const BusinessPracticeMatrix = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);
  const entities = parsed.entities as [z.infer<typeof EntitySchema>, z.infer<typeof EntitySchema>];

  return (
    <AnalyticsCanvas variant="light">
      <ExecutiveHeader
        eyebrow={parsed.eyebrow}
        title={parsed.title}
        metaLabel={parsed.headerMetaLabel}
        metaValue={parsed.headerMetaValue}
        icon={parsed.headerIcon}
      />

      <div className="flex h-[620px] flex-col px-[48px] pb-[22px] pt-[22px]" style={{ backgroundColor: chartAnalyticsTheme.colors.surface }}>
        <div className="min-h-0 flex-1">
          <ComparisonMatrixBoard dimensionLabel={parsed.dimensionLabel} entities={entities} rows={parsed.rows} />
        </div>

        <div
          className="mt-[16px] flex h-[54px] flex-none items-center justify-between rounded-[8px] px-[18px]"
          style={{
            backgroundColor: chartAnalyticsTheme.colors.darkPanel,
            boxShadow: "0 10px 18px rgba(15,23,42,0.16)",
          }}
        >
          <div className="flex min-w-0 items-center gap-[14px]">
            <div className="flex h-[32px] w-[32px] flex-none items-center justify-center rounded-[6px]" style={{ backgroundColor: parsed.implicationAccentColor }}>
              <AnalyticsIcon name={parsed.implicationIcon} className="h-[17px] w-[17px]" stroke="#FFFFFF" />
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-[8px]">
              <div className="flex-none text-[14px] font-bold uppercase leading-[1.25]" style={{ color: "#C4B5FD" }}>
                {parsed.implicationLabel}:
              </div>
              <div className="min-w-0 flex-1 text-[14px] font-medium leading-[1.25]" style={{ color: chartAnalyticsTheme.colors.darkMutedText }}>
                {parsed.implicationText}
              </div>
            </div>
          </div>
          <div className="ml-[24px] flex-none text-[11px] font-bold" style={{ color: chartAnalyticsTheme.colors.darkMutedText }}>
            {parsed.slideLabel}
          </div>
        </div>
      </div>
    </AnalyticsCanvas>
  );
};

export default BusinessPracticeMatrix;
