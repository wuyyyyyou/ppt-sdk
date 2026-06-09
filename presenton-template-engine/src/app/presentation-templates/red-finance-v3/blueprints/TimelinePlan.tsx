import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import FinanceContentFrame from "../components/FinanceContentFrame.tsx";
import FinanceSectionHeading from "../components/FinanceSectionHeading.tsx";
import { FinanceIcon } from "../components/FinanceIcons.tsx";
import InsightCallout from "../components/InsightCallout.tsx";
import KpiMetricItem from "../components/KpiMetricItem.tsx";
import TimelineBoard, { type TimelineBoardItem } from "../components/TimelineBoard.tsx";
import VerticalMilestoneTimeline, { type VerticalMilestoneTimelineItem } from "../components/VerticalMilestoneTimeline.tsx";

const PhaseSchema = z.object({
  label: z.string().min(1).max(8),
  title: z.string().min(2).max(28),
  items: z.array(z.string().min(4).max(80)).min(1).max(4),
});

const MilestoneSchema = z.object({
  period: z.string().min(2).max(24),
  stage: z.string().min(2).max(24),
  title: z.string().min(2).max(32),
  description: z.string().min(8).max(96),
  icon: z.enum(["route", "shield", "lightbulb", "chart-line", "bank", "gavel", "calendar", "wallet"]),
  tone: z.enum(["default", "accent", "future"]).default("default"),
  tag: z.string().min(2).max(18).default("milestone"),
});

export const Schema = z.object({
  title: z.string().min(2).max(28).default("Timeline Plan"),
  metaLabel: z.string().min(2).max(48).default("BLUEPRINT / TIMELINE"),
  footerText: z.string().min(6).max(80).default("Business Professional | Timeline Plan"),
  pageNumber: z.string().min(1).max(4).default("07"),
  variant: z.enum(["horizontal-roadmap", "vertical-milestones"]).default("horizontal-roadmap"),
  density: z.enum(["low", "medium", "high"]).default("medium"),
  heading: z.string().min(2).max(30).default("Roadmap"),
  subtitle: z.string().min(8).max(96).default("Show evolution, implementation cadence, or milestones by phase."),
  phases: z.array(PhaseSchema).min(3).max(6).default([
    { label: "01", title: "Assess", items: ["Identify issues", "Define scope"] },
    { label: "02", title: "Design", items: ["Design solution", "Align dependencies"] },
    { label: "03", title: "Deliver", items: ["Execute rollout", "Track outcomes"] },
  ]),
  milestones: z.array(MilestoneSchema).min(3).max(6).default([
    {
      period: "2022",
      stage: "Start",
      title: "Policy kickoff",
      description: "Starting point for an industry shift or project kickoff.",
      icon: "calendar",
      tone: "default",
      tag: "start",
    },
    {
      period: "2024",
      stage: "Scale",
      title: "Operational expansion",
      description: "Mid-stage window for expansion, integration, or scaling.",
      icon: "route",
      tone: "accent",
      tag: "scale",
    },
    {
      period: "2026",
      stage: "Next",
      title: "Future state",
      description: "Future-state target that connects planning to recommendations.",
      icon: "lightbulb",
      tone: "future",
      tag: "future",
    },
  ]),
  metrics: z.array(z.object({ value: z.string().min(1).max(24), label: z.string().min(2).max(24) })).min(1).max(4).default([
    { value: "3", label: "phases" },
    { value: "6", label: "months" },
    { value: "12", label: "milestones" },
  ]),
  summary: z.string().min(8).max(120).default("Best for plans with clear phases, cadence, and milestones."),
});

export const layoutId = "timeline-plan";
export const layoutName = "Timeline Plan";
export const layoutDescription =
  "A tsx-first slide for roadmap, milestone, or phase-based planning narratives.";
export const layoutTags = ["timeline", "roadmap", "milestone", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["timeline", "context", "metrics", "callout"];
export const useCases = ["roadmap", "milestones", "sequence", "implementation"];
export const suitableFor = "Suitable for phases, roadmaps, and sequences that must read in order.";
export const avoidFor = "Avoid using this layout for unordered classifications or multi-axis comparisons.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const TimelinePlan = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);
  const isVertical = parsed.variant === "vertical-milestones";
  const density = parsed.density === "low" ? "compact" : "normal";

  return (
    <FinanceContentFrame
      title={parsed.title}
      metaIcon={<FinanceIcon name="route" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={156}
      contentBottomInset={12}
    >
      <div className="flex h-full min-h-0 flex-col gap-[14px]">
        <FinanceSectionHeading title={parsed.heading} subtitle={parsed.subtitle} />

        <div className={isVertical ? "grid flex-1 min-h-0 grid-cols-[1.1fr_0.9fr] gap-[18px]" : "flex flex-1 min-h-0 flex-col gap-[16px]"}>
          {isVertical ? (
            <>
              <VerticalMilestoneTimeline
                items={parsed.milestones as VerticalMilestoneTimelineItem[]}
                density={density}
              />
              <div className="flex flex-col gap-[14px]">
                <div className="grid grid-cols-3 gap-[10px]">
                  {parsed.metrics.map((metric) => (
                    <div key={metric.label} className="rounded-[8px] border bg-white px-[14px] py-[12px]">
                      <KpiMetricItem value={metric.value} label={metric.label} />
                    </div>
                  ))}
                </div>
                <InsightCallout text={parsed.summary} density={parsed.density === "high" ? "compact" : "normal"} />
              </div>
            </>
          ) : (
            <>
              <TimelineBoard phases={parsed.phases as TimelineBoardItem[]} density={density} />
              <div className="grid grid-cols-3 gap-[10px]">
                {parsed.metrics.map((metric) => (
                  <div key={metric.label} className="rounded-[8px] border bg-white px-[14px] py-[12px]">
                    <KpiMetricItem value={metric.value} label={metric.label} />
                  </div>
                ))}
              </div>
              <InsightCallout text={parsed.summary} density={parsed.density === "high" ? "compact" : "normal"} />
            </>
          )}
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default TimelinePlan;
