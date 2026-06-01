import React from "react";
import * as z from "zod";

import ComparisonPanel from "../components/ComparisonPanel.tsx";
import FinanceContentFrame from "../components/FinanceContentFrame.tsx";
import FinanceSectionHeading from "../components/FinanceSectionHeading.tsx";
import { FinanceIcon, type FinanceIconName } from "../components/FinanceIcons.tsx";
import InsightCallout from "../components/InsightCallout.tsx";
import StableMatrixGrid from "../components/StableMatrixGrid.tsx";

const CellSchema = z.object({
  lead: z.string().min(1).max(48),
  support: z.string().max(80).optional(),
});

const ColumnSchema = z.object({
  label: z.string().min(1).max(24),
  width: z.union([z.number(), z.string()]).optional(),
});

const RowSchema = z.object({
  header: z.string().min(1).max(24),
  cells: z.array(CellSchema).min(2).max(6),
});

const SectionSchema = z.object({
  badge: z.string().min(1).max(8),
  title: z.string().min(2).max(24),
  description: z.string().min(8).max(96),
});

export const Schema = z.object({
  title: z.string().min(2).max(28).default("Comparison Matrix"),
  metaLabel: z.string().min(2).max(48).default("BLUEPRINT / MATRIX"),
  footerText: z.string().min(6).max(80).default("Business Professional | Comparison Matrix"),
  pageNumber: z.string().min(1).max(4).default("06"),
  variant: z.enum(["entity-first", "dimension-first"]).default("entity-first"),
  density: z.enum(["medium", "high"]).default("medium"),
  matrixTitle: z.string().min(2).max(28).default("Comparison matrix"),
  rowHeaderLabel: z.string().min(2).max(20).default("Dimension"),
  columns: z.array(ColumnSchema).min(2).max(5).default([
    { label: "China" },
    { label: "US" },
    { label: "Gap" },
  ]),
  rows: z.array(RowSchema).min(2).max(6).default([
    {
      header: "Scale",
      cells: [
        { lead: "Large", support: "broad ecosystem" },
        { lead: "Large", support: "deep market" },
        { lead: "Medium", support: "different structure" },
      ],
    },
    {
      header: "Data",
      cells: [
        { lead: "Strong", support: "platform depth" },
        { lead: "Strong", support: "capital depth" },
        { lead: "High", support: "different stack" },
      ],
    },
    {
      header: "Regulation",
      cells: [
        { lead: "Tight", support: "policy-led" },
        { lead: "Mixed", support: "multi-agency" },
        { lead: "High", support: "compliance focus" },
      ],
    },
  ]),
  sections: z.array(SectionSchema).min(1).max(4).default([
    {
      badge: "01",
      title: "Key takeaway",
      description: "A matrix slide should explain a few key differences, not become a large table.",
    },
    {
      badge: "02",
      title: "Use case",
      description: "Useful for market, capability, option, or scoring comparisons.",
    },
  ]),
  summary: z.string().min(8).max(120).default("Best for multi-dimensional comparison; avoid using it for a single argument."),
});

export const layoutId = "comparison-matrix";
export const layoutName = "Comparison Matrix";
export const layoutDescription =
  "A tsx-first slide for structured comparisons across entities or dimensions.";
export const layoutTags = ["matrix", "comparison", "benchmark", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["matrix", "comparison-context", "callout"];
export const useCases = ["comparison", "evaluation", "tradeoff", "benchmark"];
export const suitableFor = "Suitable for comparison pages with several rows and a handful of comparison dimensions.";
export const avoidFor = "Avoid using this layout for single-topic narrative or timeline-based storytelling.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const ComparisonMatrix = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const density = parsed.density === "high" ? "dense" : "compact";
  const sections =
    parsed.variant === "dimension-first"
      ? parsed.sections.slice().reverse()
      : parsed.sections;

  return (
    <FinanceContentFrame
      title={parsed.title}
      metaIcon={<FinanceIcon name="grid" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={156}
      contentBottomInset={12}
    >
      <div className="flex h-full min-h-0 flex-col gap-[14px]">
        <FinanceSectionHeading title={parsed.matrixTitle} subtitle="structured comparison" />
        <div className="grid flex-1 min-h-0 grid-cols-[1.25fr_1fr] gap-[18px]">
          <StableMatrixGrid
            rowHeaderLabel={parsed.rowHeaderLabel}
            rowHeaderWidth={128}
            columns={parsed.columns}
            rows={parsed.rows}
            density={density}
          />
          <div className="flex flex-col gap-[14px]">
            <ComparisonPanel
              title="Interpretation"
              icon={<FinanceIcon name="chart-column" className="h-[18px] w-[18px]" />}
              sections={sections}
              density={parsed.density === "high" ? "compact" : "normal"}
            />
            <InsightCallout text={parsed.summary} density={parsed.density === "high" ? "compact" : "normal"} />
          </div>
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default ComparisonMatrix;
