import React from "react";
import * as z from "zod";

import AgendaTopicCard, { type AgendaTopicIconName } from "../components/AgendaTopicCard.tsx";
import ThemeContentFrame from "../components/ThemeContentFrame.tsx";
import ThemeSoftCircle from "../components/ThemeSoftCircle.tsx";
import ThemePill from "../components/ThemePill.tsx";
import { redBlueComparisonTheme, type RedBlueTone } from "../theme/tokens.ts";

const IconNameSchema = z.enum([
  "chart-line",
  "users",
  "microchip",
  "exchange",
  "landmark",
  "culture",
  "globe",
  "strategy",
]);

const ToneSchema = z.enum(["red", "blue", "purple", "neutral"]);

const TopicSchema = z.object({
  number: z.string().min(1).max(3),
  title: z.string().min(2).max(34),
  description: z.string().min(8).max(115),
  icon: IconNameSchema.default("strategy"),
  tone: ToneSchema.default("purple"),
});

export const Schema = z.object({
  title: z.string().min(2).max(34).default("Comparison Overview"),
  subtitle: z
    .string()
    .min(8)
    .max(190)
    .default("A structured overview of the topics, evidence areas, and decision themes covered in this comparison."),
  eyebrow: z.string().min(2).max(24).default("Overview"),
  metaLabel: z.string().min(2).max(28).default("Agenda"),
  footerText: z.string().min(4).max(80).default("Red Blue Comparison | Topic Overview"),
  pageNumber: z.string().min(1).max(4).default("02"),
  accentTone: ToneSchema.default("purple"),
  topics: z.array(TopicSchema).min(4).max(6).default([
    {
      number: "01",
      title: "Market scale",
      description: "Compare the size, growth profile, and structural advantages of each side.",
      icon: "chart-line",
      tone: "purple",
    },
    {
      number: "02",
      title: "Population base",
      description: "Review demographic patterns, labor constraints, and demand-side momentum.",
      icon: "users",
      tone: "purple",
    },
    {
      number: "03",
      title: "Innovation edge",
      description: "Assess technology capability, R&D intensity, and emerging competitive advantages.",
      icon: "microchip",
      tone: "purple",
    },
    {
      number: "04",
      title: "Trade flows",
      description: "Map bilateral dependencies, supply-chain roles, and investment exposure.",
      icon: "exchange",
      tone: "purple",
    },
    {
      number: "05",
      title: "Historical context",
      description: "Frame the milestones and diplomatic events that shape current positioning.",
      icon: "landmark",
      tone: "purple",
    },
    {
      number: "06",
      title: "Cultural influence",
      description: "Compare values, business etiquette, creative output, and soft-power reach.",
      icon: "culture",
      tone: "purple",
    },
  ]),
  showDecorations: z.boolean().default(true),
});

export const sampleData = Schema.parse({
  title: "Comparison Overview",
  subtitle:
    "A deep dive into the key pillars defining the relationship and competition between Asia's two largest economies, exploring their strengths, challenges, and future trajectories.",
  eyebrow: "Overview",
  metaLabel: "6 Pillars",
  footerText: "China vs Japan | Comparison Overview",
  pageNumber: "02",
  topics: [
    {
      number: "01",
      title: "Economy",
      description: "Comparative analysis of GDP size, growth rates, economic structure, and global rankings.",
      icon: "chart-line",
      tone: "purple",
    },
    {
      number: "02",
      title: "Demographics",
      description: "Examination of population trends, aging societies, workforce challenges, and urbanization rates.",
      icon: "users",
      tone: "purple",
    },
    {
      number: "03",
      title: "Technology & Innovation",
      description: "Insights into R&D spending, AI development, robotics leadership, and patent output.",
      icon: "microchip",
      tone: "purple",
    },
    {
      number: "04",
      title: "Trade & Investment",
      description: "Breakdown of bilateral import/export flows, key industries, and economic interdependence.",
      icon: "exchange",
      tone: "purple",
    },
    {
      number: "05",
      title: "History",
      description: "Timeline of key historical milestones, conflicts, and diplomatic normalization events.",
      icon: "landmark",
      tone: "purple",
    },
    {
      number: "06",
      title: "Culture",
      description: "Exploration of societal values, business etiquette, art, and modern soft power influence.",
      icon: "culture",
      tone: "purple",
    },
  ],
  showDecorations: true,
});

export const layoutId = "topic-overview";
export const layoutName = "Topic Overview";
export const layoutDescription =
  "A TSX-first six-topic overview page inspired by source page 2, with a concise header and reusable numbered topic cards.";
export const layoutTags = ["agenda", "overview", "topic-grid", "comparison", "tsx-first"];
export const layoutRole = "agenda";
export const contentElements = ["page-title", "subtitle", "topic-card-grid", "numbered-cards", "icon-cards"];
export const useCases = ["agenda", "comparison overview", "section map", "topic introduction"];
export const suitableFor =
  "Suitable for introducing four to six themes, pillars, agenda items, or comparison dimensions before detailed analysis.";
export const avoidFor =
  "Avoid using this layout for chart-heavy analysis, long narrative pages, detailed matrices, or timelines.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const TopicOverviewDecorations = () => (
  <>
    <ThemeSoftCircle tone="purple" left={980} top={-150} size={400} alpha={0.04} />
    <ThemeSoftCircle tone="red" left={-80} top={550} size={250} alpha={0.045} />
    <ThemeSoftCircle tone="blue" left={620} top={265} size={180} alpha={0.045} />
  </>
);

const TopicOverview = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const accentTone = parsed.accentTone as RedBlueTone;

  return (
    <ThemeContentFrame
      title={parsed.title}
      subtitle={parsed.subtitle}
      eyebrow={parsed.eyebrow}
      tone={accentTone}
      meta={
        <ThemePill tone={accentTone} height={28}>
          {parsed.metaLabel}
        </ThemePill>
      }
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      showHeaderDivider={false}
      contentTop={222}
      contentHeight={432}
    >
      {parsed.showDecorations ? <TopicOverviewDecorations /> : null}
      <div className="relative z-10 grid h-full min-h-0 grid-cols-3 grid-rows-2 gap-[24px]">
        {parsed.topics.map((topic, index) => (
          <AgendaTopicCard
            key={`${topic.number}-${topic.title}-${index}`}
            number={topic.number}
            title={topic.title}
            description={topic.description}
            iconName={topic.icon as AgendaTopicIconName}
            tone={topic.tone as RedBlueTone}
          />
        ))}
      </div>
    </ThemeContentFrame>
  );
};

export default TopicOverview;
