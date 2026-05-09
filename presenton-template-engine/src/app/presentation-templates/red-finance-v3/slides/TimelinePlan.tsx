import React from "react";
import * as z from "zod";

import FinanceContentFrame from "../components/FinanceContentFrame.js";
import FinanceSectionHeading from "../components/FinanceSectionHeading.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import InsightCallout from "../components/InsightCallout.js";
import KpiMetricItem from "../components/KpiMetricItem.js";
import TimelineBoard, { type TimelineBoardItem } from "../components/TimelineBoard.js";
import VerticalMilestoneTimeline, { type VerticalMilestoneTimelineItem } from "../components/VerticalMilestoneTimeline.js";

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
  footerText: z.string().min(6).max(80).default("Red Finance V3 | Timeline Plan"),
  pageNumber: z.string().min(1).max(4).default("07"),
  variant: z.enum(["horizontal-roadmap", "vertical-milestones"]).default("horizontal-roadmap"),
  density: z.enum(["low", "medium", "high"]).default("medium"),
  heading: z.string().min(2).max(30).default("路线图"),
  subtitle: z.string().min(8).max(96).default("按阶段表达演进路径、实施节奏或里程碑。"),
  phases: z.array(PhaseSchema).min(3).max(6).default([
    { label: "01", title: "Assess", items: ["识别问题", "定义范围"] },
    { label: "02", title: "Design", items: ["设计方案", "对齐依赖"] },
    { label: "03", title: "Deliver", items: ["落地执行", "跟踪结果"] },
  ]),
  milestones: z.array(MilestoneSchema).min(3).max(6).default([
    {
      period: "2022",
      stage: "Start",
      title: "Policy kickoff",
      description: "起点阶段，用于表达行业或项目的启动节点。",
      icon: "calendar",
      tone: "default",
      tag: "start",
    },
    {
      period: "2024",
      stage: "Scale",
      title: "Operational expansion",
      description: "中期阶段，通常是扩张或整合的关键窗口。",
      icon: "route",
      tone: "accent",
      tag: "scale",
    },
    {
      period: "2026",
      stage: "Next",
      title: "Future state",
      description: "下一步目标，用来承接规划和建议。",
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
  summary: z.string().min(8).max(120).default("适合有明显阶段和节奏的规划页面。"),
});

export const layoutId = "timeline-plan";
export const layoutName = "Timeline Plan";
export const layoutDescription =
  "A blueprint-first slide for roadmap, milestone, or phase-based planning narratives.";
export const layoutTags = ["timeline", "roadmap", "milestone", "blueprint-first"];
export const layoutRole = "content";
export const contentElements = ["timeline", "context", "metrics", "callout"];
export const useCases = ["roadmap", "milestones", "sequence", "implementation"];
export const suitableFor = "Suitable for phases, roadmaps, and sequences that must read in order.";
export const avoidFor = "Avoid using this layout for unordered classifications or multi-axis comparisons.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const TimelinePlan = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
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
