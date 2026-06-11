import React from "react";
import * as z from "zod";

import RedBlueCanvas from "../components/RedBlueCanvas.tsx";
import { getToneColor, redBlueTheme } from "../theme/tokens.ts";

const ToneSchema = z.enum(["china", "japan", "korea", "purple", "neutral"]);

const AgendaItemSchema = z.object({
  number: z.string().min(1).max(4),
  title: z.string().min(2).max(32),
  description: z.string().min(4).max(150),
  icon: z.string().min(1).max(4).optional(),
  tone: ToneSchema.default("purple"),
});

export const Schema = z.object({
  title: z.string().min(2).max(48).default("Agenda"),
  subtitle: z.string().min(2).max(220).default("A structured path from framing to evidence and implications."),
  footerText: z.string().min(2).max(80).default("Red Blue Professional"),
  pageNumber: z.string().min(1).max(4).default("02"),
  items: z.array(AgendaItemSchema).min(2).max(12).default([
    { number: "01", title: "Market Context", description: "Define comparison scope and baseline facts.", tone: "china" },
    { number: "02", title: "Performance Signals", description: "Compare key indicators with visual evidence.", tone: "japan" },
    { number: "03", title: "Strategic Implications", description: "Convert findings into decision themes.", tone: "purple" },
  ]),
});

export const layoutId = "agenda-overview";
export const layoutName = "Agenda Overview";
export const layoutDescription = "Agenda slide with two to twelve numbered red-blue topic cards that auto-fit the page.";
export const layoutTags = ["agenda", "cards", "overview", "red-blue"];
export const layoutRole = "agenda";
export const contentElements = ["heading", "card-grid"];
export const useCases = ["agenda", "section-map", "executive-brief"];
export const suitableFor = "Suitable for outlining the deck structure or a section roadmap.";
export const avoidFor = "Avoid for detailed chart analysis.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

export const sampleData = {
  title: "Comparison Overview",
  subtitle:
    "A deep dive into the key pillars defining the relationship and competition between Asia's two largest economies, exploring their strengths, challenges, and future trajectories.",
  footerText: "Red Blue Professional | Agenda",
  pageNumber: "02",
  items: [
    {
      number: "01",
      title: "Economy",
      description:
        "Comparative analysis of GDP size, growth rates, economic structure, and global rankings.",
      icon: "$",
      tone: "china",
    },
    {
      number: "02",
      title: "Demographics",
      description:
        "Examination of population trends, aging societies, workforce challenges, and urbanization rates.",
      icon: "P",
      tone: "japan",
    },
    {
      number: "03",
      title: "Technology & Innovation",
      description:
        "Insights into R&D spending, AI development, robotics leadership, and patent output.",
      icon: "AI",
      tone: "korea",
    },
    {
      number: "04",
      title: "Trade & Investment",
      description:
        "Breakdown of bilateral import/export flows, key industries, and economic interdependence.",
      icon: "<>",
      tone: "purple",
    },
    {
      number: "05",
      title: "History",
      description:
        "Timeline of key historical milestones, conflicts, and diplomatic normalization events.",
      icon: "H",
      tone: "neutral",
    },
    {
      number: "06",
      title: "Culture",
      description:
        "Exploration of societal values, business etiquette, art, and modern soft power influence.",
      icon: "C",
      tone: "purple",
    },
  ],
} satisfies z.infer<typeof Schema>;

function getAgendaIcon(item: z.infer<typeof AgendaItemSchema>) {
  if (item.icon) return item.icon;
  const title = item.title.toLowerCase();
  if (title.includes("econom")) return "$";
  if (title.includes("demo") || title.includes("people")) return "P";
  if (title.includes("tech") || title.includes("innovation")) return "AI";
  if (title.includes("trade") || title.includes("invest")) return "<>";
  if (title.includes("history")) return "H";
  if (title.includes("culture")) return "C";
  return item.number;
}

function getAgendaGridSpec(count: number) {
  if (count <= 2) return { columns: 2, rows: 1 };
  if (count <= 4) return { columns: 2, rows: 2 };
  if (count <= 6) return { columns: 3, rows: 2 };
  if (count <= 9) return { columns: 3, rows: 3 };
  return { columns: 4, rows: 3 };
}

function getAgendaDensity(count: number) {
  if (count <= 4) {
    return {
      gap: 24,
      cardPaddingX: 24,
      cardPaddingTop: 24,
      cardPaddingBottom: 20,
      iconSize: 44,
      iconRadius: 10,
      iconFontSize: 16,
      titleFontSize: 22,
      titleLineHeight: 27,
      descriptionFontSize: 15,
      descriptionLineHeight: 23,
      numberFontSize: 54,
    };
  }

  if (count <= 6) {
    return {
      gap: 24,
      cardPaddingX: 24,
      cardPaddingTop: 24,
      cardPaddingBottom: 20,
      iconSize: 44,
      iconRadius: 10,
      iconFontSize: 16,
      titleFontSize: 20,
      titleLineHeight: 25,
      descriptionFontSize: 14,
      descriptionLineHeight: 21,
      numberFontSize: 48,
    };
  }

  if (count <= 9) {
    return {
      gap: 18,
      cardPaddingX: 18,
      cardPaddingTop: 20,
      cardPaddingBottom: 16,
      iconSize: 36,
      iconRadius: 9,
      iconFontSize: 13,
      titleFontSize: 17,
      titleLineHeight: 21,
      descriptionFontSize: 12,
      descriptionLineHeight: 17,
      numberFontSize: 38,
    };
  }

  return {
    gap: 14,
    cardPaddingX: 14,
    cardPaddingTop: 18,
    cardPaddingBottom: 14,
    iconSize: 32,
    iconRadius: 8,
    iconFontSize: 12,
    titleFontSize: 15,
    titleLineHeight: 18,
    descriptionFontSize: 10,
    descriptionLineHeight: 14,
    numberFontSize: 30,
  };
}

const AgendaOverview = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const grid = getAgendaGridSpec(parsed.items.length);
  const density = getAgendaDensity(parsed.items.length);

  return (
    <RedBlueCanvas showGrid={false} showDecorations={false}>
      <div
        className="absolute rounded-full"
        style={{
          width: 400,
          height: 400,
          right: -100,
          top: -150,
          backgroundColor: "rgba(80,56,166,0.04)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 250,
          height: 250,
          left: -80,
          bottom: -80,
          backgroundColor: "rgba(255,71,87,0.04)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 180,
          height: 180,
          left: 610,
          top: 235,
          backgroundColor: "rgba(46,134,222,0.04)",
        }}
      />

      <div className="absolute inset-0 z-10 flex flex-col px-[80px] pb-[60px] pt-[50px]">
        <h1
          className="m-0 text-[48px] font-black leading-[58px]"
          style={{
            color: redBlueTheme.colors.backgroundText,
            fontFamily: redBlueTheme.fonts.heading,
          }}
        >
          {parsed.title}
        </h1>
        <p
          className="mb-[40px] mt-[12px] max-w-[900px] text-[18px] font-medium leading-[27px]"
          style={{ color: redBlueTheme.colors.mutedText }}
        >
          {parsed.subtitle}
        </p>

        <div
          className="grid flex-1"
          style={{
            gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
            gap: density.gap,
          }}
        >
        {parsed.items.map((item) => (
          <div
            key={item.number}
            className="relative flex min-h-0 flex-col overflow-hidden rounded-[12px] border bg-white"
            style={{
              borderColor: "rgba(0,0,0,0.04)",
              boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
              paddingLeft: density.cardPaddingX,
              paddingRight: density.cardPaddingX,
              paddingTop: density.cardPaddingTop,
              paddingBottom: density.cardPaddingBottom,
            }}
          >
            <div
              className="absolute left-0 top-0 h-[5px] w-full"
              style={{ backgroundColor: getToneColor(item.tone) }}
            />
            <div
              className="pointer-events-none absolute right-[20px] top-[18px] font-black leading-none"
              style={{
                color: "rgba(0,0,0,0.03)",
                fontFamily: redBlueTheme.fonts.heading,
                fontSize: density.numberFontSize,
              }}
            >
              {item.number}
            </div>
            <div
              className="mb-[16px] flex shrink-0 items-center justify-center font-black"
              style={{
                width: density.iconSize,
                height: density.iconSize,
                borderRadius: density.iconRadius,
                backgroundColor: `${getToneColor(item.tone)}14`,
                color: getToneColor(item.tone),
                fontFamily: redBlueTheme.fonts.heading,
                fontSize: density.iconFontSize,
              }}
            >
              {getAgendaIcon(item)}
            </div>
            <h2
              className="m-0 mb-[8px] font-extrabold"
              style={{
                color: redBlueTheme.colors.backgroundText,
                fontFamily: redBlueTheme.fonts.heading,
                fontSize: density.titleFontSize,
                lineHeight: `${density.titleLineHeight}px`,
                overflowWrap: "anywhere",
              }}
            >
              {item.title}
            </h2>
            <p
              className="m-0 font-medium"
              style={{
                color: redBlueTheme.colors.mutedText,
                fontSize: density.descriptionFontSize,
                lineHeight: `${density.descriptionLineHeight}px`,
                overflowWrap: "anywhere",
              }}
            >
              {item.description}
            </p>
          </div>
        ))}
        </div>
      </div>
    </RedBlueCanvas>
  );
};

export default AgendaOverview;
