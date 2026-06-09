import React from "react";
import * as z from "zod";

import RedBlueContentFrame from "../components/RedBlueContentFrame.tsx";
import RedBlueInsightCard from "../components/RedBlueInsightCard.tsx";
import RedBlueTopicCard from "../components/RedBlueTopicCard.tsx";

const ToneSchema = z.enum(["china", "japan", "korea", "purple", "neutral"]);

const CardSchema = z.object({
  number: z.string().min(1).max(4),
  title: z.string().min(2).max(32),
  description: z.string().min(8).max(120),
  tone: ToneSchema.default("purple"),
});

export const Schema = z.object({
  title: z.string().min(2).max(52).default("Three-Part Comparison"),
  subtitle: z.string().min(2).max(96).default("Summarize three comparable themes with a clear decision note."),
  footerText: z.string().min(2).max(80).default("Red Blue Professional"),
  pageNumber: z.string().min(1).max(4).default("03"),
  cards: z.array(CardSchema).min(3).max(3).default([
    { number: "01", title: "Scale", description: "Compare the absolute size or reach of each market.", tone: "china" },
    { number: "02", title: "Quality", description: "Highlight maturity, efficiency, or capability differences.", tone: "japan" },
    { number: "03", title: "Momentum", description: "Show the forward-looking trend or strategic direction.", tone: "purple" },
  ]),
  insightTitle: z.string().min(2).max(40).default("Decision note"),
  insightText: z.string().min(8).max(180).default("Use this layout when the slide should be easy to scan before the audience reads detailed evidence."),
});

export const layoutId = "three-topic-cards";
export const layoutName = "Three Topic Cards";
export const layoutDescription = "Three-card analysis layout with a bottom executive insight.";
export const layoutTags = ["cards", "comparison", "insight", "red-blue"];
export const layoutRole = "content";
export const contentElements = ["heading", "card-grid", "insight"];
export const useCases = ["market-comparison", "competitor-analysis", "section-summary"];
export const suitableFor = "Suitable for three-part comparison or executive summary pages.";
export const avoidFor = "Avoid when the core content is a large chart.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const ThreeTopicCards = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <RedBlueContentFrame title={parsed.title} subtitle={parsed.subtitle} footerText={parsed.footerText} pageNumber={parsed.pageNumber}>
      <div className="flex h-full flex-col gap-[22px]">
        <div className="grid flex-1 grid-cols-3 gap-[20px]">
          {parsed.cards.map((card) => (
            <RedBlueTopicCard key={card.number} number={card.number} title={card.title} description={card.description} tone={card.tone} />
          ))}
        </div>
        <RedBlueInsightCard title={parsed.insightTitle} text={parsed.insightText} tone="purple" />
      </div>
    </RedBlueContentFrame>
  );
};

export default ThreeTopicCards;
