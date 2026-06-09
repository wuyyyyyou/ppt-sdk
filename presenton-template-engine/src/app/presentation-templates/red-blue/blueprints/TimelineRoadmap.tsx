import React from "react";
import * as z from "zod";

import RedBlueContentFrame from "../components/RedBlueContentFrame.tsx";
import RedBlueInsightCard from "../components/RedBlueInsightCard.tsx";
import RedBlueTimeline from "../components/RedBlueTimeline.tsx";
import { redBlueTheme } from "../theme/tokens.ts";

const TimelineItemSchema = z.object({
  date: z.string().min(1).max(12),
  title: z.string().min(2).max(28),
  description: z.string().min(6).max(96),
});

export const Schema = z.object({
  title: z.string().min(2).max(52).default("Timeline Roadmap"),
  subtitle: z.string().min(2).max(96).default("Show sequence, process, or implementation phases with a clear concluding note."),
  footerText: z.string().min(2).max(80).default("Red Blue Professional"),
  pageNumber: z.string().min(1).max(4).default("06"),
  items: z.array(TimelineItemSchema).min(3).max(5).default([
    { date: "01", title: "Frame", description: "Define the comparison lens." },
    { date: "02", title: "Analyze", description: "Build evidence across KPI categories." },
    { date: "03", title: "Decide", description: "Translate findings into action." },
  ]),
  insightTitle: z.string().min(2).max(40).default("Roadmap note"),
  insightText: z.string().min(8).max(160).default("This layout works best when each phase has a short verb-led title and one concise implication."),
});

export const layoutId = "timeline-roadmap";
export const layoutName = "Timeline Roadmap";
export const layoutDescription = "Horizontal timeline blueprint for process, phase, or historical sequence pages.";
export const layoutTags = ["timeline", "roadmap", "process", "red-blue"];
export const layoutRole = "content";
export const contentElements = ["heading", "timeline", "insight"];
export const useCases = ["implementation-plan", "market-history", "process"];
export const suitableFor = "Suitable for three to five chronological or sequential points.";
export const avoidFor = "Avoid for non-sequential comparisons.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const TimelineRoadmap = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <RedBlueContentFrame title={parsed.title} subtitle={parsed.subtitle} footerText={parsed.footerText} pageNumber={parsed.pageNumber}>
      <div className="flex h-full flex-col gap-[18px]">
        <div className="min-h-0 flex-1 rounded-[18px] bg-white p-[18px]" style={{ boxShadow: `0 8px 24px ${redBlueTheme.colors.shadow}` }}>
          <RedBlueTimeline items={parsed.items} />
        </div>
        <RedBlueInsightCard title={parsed.insightTitle} text={parsed.insightText} tone="purple" />
      </div>
    </RedBlueContentFrame>
  );
};

export default TimelineRoadmap;
