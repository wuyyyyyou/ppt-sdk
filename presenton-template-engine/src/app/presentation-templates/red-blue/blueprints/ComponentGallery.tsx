import React from "react";
import * as z from "zod";

import RedBlueChartShell from "../components/RedBlueChartShell.tsx";
import RedBlueContentFrame from "../components/RedBlueContentFrame.tsx";
import RedBlueCountryCard from "../components/RedBlueCountryCard.tsx";
import RedBlueInsightCard from "../components/RedBlueInsightCard.tsx";
import RedBlueLegend from "../components/RedBlueLegend.tsx";
import RedBlueMetricCard from "../components/RedBlueMetricCard.tsx";
import RedBlueNumberCallout from "../components/RedBlueNumberCallout.tsx";
import RedBlueSectionHeading from "../components/RedBlueSectionHeading.tsx";
import RedBlueTimeline from "../components/RedBlueTimeline.tsx";
import RedBlueTopicCard from "../components/RedBlueTopicCard.tsx";
import { redBlueTheme } from "../theme/tokens.ts";

const ToneSchema = z.enum(["china", "japan", "korea", "purple", "neutral"]);

const TopicCardSchema = z.object({
  number: z.string().min(1).max(4),
  title: z.string().min(2).max(28),
  description: z.string().min(8).max(96),
  tone: ToneSchema.default("purple"),
});

const TimelineItemSchema = z.object({
  date: z.string().min(2).max(12),
  title: z.string().min(2).max(28),
  description: z.string().min(8).max(80),
});

export const Schema = z.object({
  title: z.string().min(2).max(40).default("Red Blue Component Gallery"),
  subtitle: z.string().min(2).max(96).default("Reusable TSX building blocks extracted from the red-blue reference HTML deck."),
  footerText: z.string().min(2).max(80).default("Red Blue Professional | Component Foundation"),
  pageNumber: z.string().min(1).max(4).default("01"),
  topics: z.array(TopicCardSchema).min(3).max(3).default([
    {
      number: "01",
      title: "Comparison",
      description: "Side-by-side country, market, or competitor framing.",
      tone: "china",
    },
    {
      number: "02",
      title: "Evidence",
      description: "Metric cards, chart shells, and number callouts.",
      tone: "japan",
    },
    {
      number: "03",
      title: "Narrative",
      description: "Timeline, insights, and executive recommendation blocks.",
      tone: "purple",
    },
  ]),
  timeline: z.array(TimelineItemSchema).min(3).max(3).default([
    {
      date: "01",
      title: "Frame",
      description: "Define the comparison lens.",
    },
    {
      date: "02",
      title: "Analyze",
      description: "Combine KPIs with visual evidence.",
    },
    {
      date: "03",
      title: "Decide",
      description: "Close with implications and actions.",
    },
  ]),
});

export const layoutId = "component-gallery";
export const layoutName = "Component Gallery";
export const layoutDescription =
  "A component preview page for the red-blue TSX-first template foundation.";
export const layoutTags = ["gallery", "components", "red-blue", "tsx-first"];
export const layoutRole = "content";
export const contentElements = [
  "heading",
  "legend",
  "cards",
  "metrics",
  "chart-shell",
  "timeline",
  "insight",
];
export const useCases = ["component-preview", "template-foundation", "visual-audit"];
export const suitableFor = "Suitable for previewing red-blue reusable components before building concrete blueprints.";
export const avoidFor = "Avoid using this layout as a production deck page.";
export const density = "high";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const ComponentGallery = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <RedBlueContentFrame
      title={parsed.title}
      subtitle={parsed.subtitle}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={142}
    >
      <div className="grid h-full min-h-0 grid-cols-[1.02fr_1fr_0.92fr] gap-[18px]">
        <div className="flex min-h-0 flex-col gap-[14px]">
          <RedBlueSectionHeading title="Card System" subtitle="Topic, KPI, and country comparison blocks" />
          <div className="grid grid-cols-3 gap-[12px]">
            {parsed.topics.map((card) => (
              <RedBlueTopicCard
                key={card.number}
                number={card.number}
                title={card.title}
                description={card.description}
                tone={card.tone}
                density="compact"
              />
            ))}
          </div>
          <div className="grid flex-1 min-h-0 grid-cols-2 gap-[12px]">
            <RedBlueCountryCard
              name="China"
              heroValue="1.41B"
              heroLabel="Population"
              tone="china"
              kpis={[
                { label: "GDP rank", value: "#2" },
                { label: "Urban scale", value: "High" },
              ]}
            />
            <RedBlueCountryCard
              name="Japan"
              heroValue="125M"
              heroLabel="Population"
              tone="japan"
              kpis={[
                { label: "GDP rank", value: "#4" },
                { label: "Innovation", value: "Strong" },
              ]}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-[14px]">
          <div className="flex items-center justify-between">
            <RedBlueSectionHeading title="Evidence" subtitle="Chart shell + metric comparisons" />
            <RedBlueLegend
              items={[
                { label: "China", tone: "china" },
                { label: "Japan", tone: "japan" },
              ]}
            />
          </div>
          <div className="h-[236px]">
            <RedBlueChartShell
              title="Reference Chart Shell"
              subtitle="Use this shell around Recharts, SVG, or static chart areas."
              legend={[
                { label: "China", color: redBlueTheme.colors.china },
                { label: "Japan", color: redBlueTheme.colors.japan },
                { label: "Trend", color: redBlueTheme.colors.purple, dashed: true },
              ]}
            >
              <div className="absolute inset-0 rounded-[14px]" style={{ backgroundColor: "#F8FAFC" }}>
                <div className="absolute bottom-[34px] left-[44px] right-[44px] h-[2px]" style={{ backgroundColor: redBlueTheme.colors.stroke }} />
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="absolute bottom-[36px] flex items-end gap-[8px]" style={{ left: 64 + index * 116 }}>
                    <div className="w-[28px] rounded-t-[8px]" style={{ height: 52 + index * 18, backgroundColor: redBlueTheme.colors.china }} />
                    <div className="w-[28px] rounded-t-[8px]" style={{ height: 92 - index * 12, backgroundColor: redBlueTheme.colors.japan }} />
                  </div>
                ))}
              </div>
            </RedBlueChartShell>
          </div>
          <div className="grid grid-cols-2 gap-[12px]">
            <RedBlueMetricCard
              title="Scale Signal"
              accentTone="china"
              rows={[
                { label: "China", value: "84%", share: 84, tone: "china" },
                { label: "Japan", value: "62%", share: 62, tone: "japan" },
              ]}
            />
            <RedBlueNumberCallout
              value="3"
              label="Core layouts"
              description="Cards, chart evidence, and narrative flow."
              tone="purple"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-[14px]">
          <RedBlueSectionHeading title="Narrative" subtitle="Timeline and decision framing" />
          <div className="h-[250px] rounded-[18px] bg-white p-[10px]" style={{ boxShadow: `0 8px 24px ${redBlueTheme.colors.shadow}` }}>
            <RedBlueTimeline items={parsed.timeline} />
          </div>
          <div className="grid gap-[12px]">
            <RedBlueInsightCard
              title="Agent guidance"
              text="Use components as stable visual units; keep page-specific structure inside slides/*.tsx."
              tone="purple"
            />
            <RedBlueInsightCard
              title="Export rule"
              text="Keep KPI values, titles, and comparison labels as editable DOM text."
              tone="japan"
            />
          </div>
        </div>
      </div>
    </RedBlueContentFrame>
  );
};

export default ComponentGallery;
