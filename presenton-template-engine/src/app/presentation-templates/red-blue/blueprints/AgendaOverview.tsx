import React from "react";
import * as z from "zod";

import RedBlueContentFrame from "../components/RedBlueContentFrame.tsx";
import RedBlueTopicCard from "../components/RedBlueTopicCard.tsx";

const ToneSchema = z.enum(["china", "japan", "korea", "purple", "neutral"]);

const AgendaItemSchema = z.object({
  number: z.string().min(1).max(4),
  title: z.string().min(2).max(32),
  description: z.string().min(4).max(100),
  tone: ToneSchema.default("purple"),
});

export const Schema = z.object({
  title: z.string().min(2).max(48).default("Agenda"),
  subtitle: z.string().min(2).max(96).default("A structured path from framing to evidence and implications."),
  footerText: z.string().min(2).max(80).default("Red Blue Professional"),
  pageNumber: z.string().min(1).max(4).default("02"),
  items: z.array(AgendaItemSchema).min(3).max(6).default([
    { number: "01", title: "Market Context", description: "Define comparison scope and baseline facts.", tone: "china" },
    { number: "02", title: "Performance Signals", description: "Compare key indicators with visual evidence.", tone: "japan" },
    { number: "03", title: "Strategic Implications", description: "Convert findings into decision themes.", tone: "purple" },
  ]),
});

export const layoutId = "agenda-overview";
export const layoutName = "Agenda Overview";
export const layoutDescription = "Agenda slide with three to six numbered red-blue topic cards.";
export const layoutTags = ["agenda", "cards", "overview", "red-blue"];
export const layoutRole = "agenda";
export const contentElements = ["heading", "card-grid"];
export const useCases = ["agenda", "section-map", "executive-brief"];
export const suitableFor = "Suitable for outlining the deck structure or a section roadmap.";
export const avoidFor = "Avoid for detailed chart analysis.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const AgendaOverview = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <RedBlueContentFrame title={parsed.title} subtitle={parsed.subtitle} footerText={parsed.footerText} pageNumber={parsed.pageNumber}>
      <div className="grid h-full grid-cols-3 gap-[20px]">
        {parsed.items.map((item) => (
          <RedBlueTopicCard key={item.number} number={item.number} title={item.title} description={item.description} tone={item.tone} />
        ))}
      </div>
    </RedBlueContentFrame>
  );
};

export default AgendaOverview;
