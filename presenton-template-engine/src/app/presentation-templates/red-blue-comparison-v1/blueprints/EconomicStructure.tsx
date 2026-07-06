import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import { BalancedComparisonDecorations } from "../components/ComparisonDecorations.tsx";
import SectorStructureCard from "../components/SectorStructureCard.tsx";
import ThemeContentFrame from "../components/ThemeContentFrame.tsx";
import { redBlueComparisonTheme, type ComparisonTone } from "../theme/tokens.ts";

const ToneSchema = z.enum(["sideA", "sideB", "comparison", "neutral"]);

const SectorSchema = z.object({
  label: z.string().min(2).max(28),
  value: z.number().min(0).max(100),
  color: z.string().min(4).max(24).optional(),
});

const sectorColor = (label: string, index: number) => {
  const normalized = label.toLowerCase();
  if (normalized.includes("agri")) {
    return redBlueComparisonTheme.colors.chartSectorAgriculture;
  }
  if (normalized.includes("industry") || normalized.includes("manufact")) {
    return redBlueComparisonTheme.colors.chartSectorIndustry;
  }
  if (normalized.includes("service")) {
    return redBlueComparisonTheme.colors.chartSectorServices;
  }
  const fallback = [
    redBlueComparisonTheme.colors.chart1,
    redBlueComparisonTheme.colors.chart2,
    redBlueComparisonTheme.colors.chart3,
    redBlueComparisonTheme.colors.chart4,
    redBlueComparisonTheme.colors.chart5,
    redBlueComparisonTheme.colors.chart6,
  ];
  return fallback[index % fallback.length];
};

const StructureCardSchema = z.object({
  entityName: z.string().min(2).max(24),
  badge: z.string().min(2).max(24),
  tone: ToneSchema,
  centerValue: z.string().min(1).max(12),
  centerLabel: z.string().min(2).max(18),
  segments: z.array(SectorSchema).min(2).max(5),
  insightTitle: z.string().min(2).max(38),
  insightDescription: z.string().min(8).max(110),
});

export const Schema = z.object({
  titlePrefix: z.string().min(2).max(30).default("Economic Structure:"),
  titleHighlight: z.string().min(2).max(34).default("Sector Breakdown"),
  subtitle: z.string().min(8).max(120).default("Composition of GDP by key sectors."),
  footerText: z.string().min(4).max(80).default("Red Blue Comparison | Economic Structure"),
  pageNumber: z.string().min(1).max(4).default("04"),
  cards: z.array(StructureCardSchema).min(2).max(2).default([
    {
      entityName: "Entity A",
      badge: "GDP: TBD",
      tone: "sideA",
      centerValue: "40%",
      centerLabel: "Industry",
      segments: [
        { label: "Agri (7%)", value: 7 },
        { label: "Industry (40%)", value: 40 },
        { label: "Services (53%)", value: 53 },
      ],
      insightTitle: "Industrial base",
      insightDescription: "Use this card to describe the dominant sector and what it implies for the comparison.",
    },
    {
      entityName: "Entity B",
      badge: "GDP: TBD",
      tone: "sideB",
      centerValue: "70%",
      centerLabel: "Services",
      segments: [
        { label: "Agri (1%)", value: 1 },
        { label: "Industry (29%)", value: 29 },
        { label: "Services (70%)", value: 70 },
      ],
      insightTitle: "Service economy",
      insightDescription: "Use this card to explain the sector mix and the strategic difference versus the other entity.",
    },
  ]),
  showDecorations: z.boolean().default(true),
});

export const sampleData = Schema.parse({
  titlePrefix: "Economic Structure:",
  titleHighlight: "Sector Breakdown",
  subtitle: "Composition of Gross Domestic Product by key sectors (2025 Est.)",
  footerText: "China vs Japan | Economic Structure",
  pageNumber: "04",
  cards: [
    {
      entityName: "CHINA",
      badge: "GDP: $20.6T",
      tone: "sideA",
      centerValue: "39%",
      centerLabel: "Industry",
      segments: [
        { label: "Agri (7.3%)", value: 7.3 },
        { label: "Services (53.3%)", value: 53.3 },
        { label: "Industry (39.4%)", value: 39.4 },
      ],
      insightTitle: "Manufacturing Powerhouse",
      insightDescription: "Nearly 40% of GDP from manufacturing - the world's factory.",
    },
    {
      entityName: "JAPAN",
      badge: "GDP: $4.4T",
      tone: "sideB",
      centerValue: "70%",
      centerLabel: "Services",
      segments: [
        { label: "Agri (1.1%)", value: 1.1 },
        { label: "Services (69.8%)", value: 69.8 },
        { label: "Industry (29.1%)", value: 29.1 },
      ],
      insightTitle: "Advanced Service Economy",
      insightDescription: "Service-driven economy with 70% GDP in services. Industry focuses on precision tech.",
    },
  ],
  showDecorations: true,
});

export const layoutId = "economic-structure";
export const layoutName = "Economic Structure";
export const layoutDescription =
  "A TSX-first sector breakdown page with two entity cards, screenshot-safe donut charts, legends, and concise analysis callouts.";
export const layoutTags = ["economy", "sector-breakdown", "donut-chart", "comparison", "red-blue", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["page-title", "subtitle", "entity-cards", "donut-charts", "legends", "analysis-callouts"];
export const useCases = ["sector structure", "economic composition", "market share comparison", "portfolio breakdown"];
export const suitableFor =
  "Suitable for comparing two entities by sector mix, market share, revenue composition, or other part-to-whole distributions.";
export const avoidFor =
  "Avoid using this layout for time-series analysis, long narrative pages, more than two primary entities, or detailed tables.";
export const density = "medium";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const EconomicStructure = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);

  return (
    <ThemeContentFrame
      titlePrefix={parsed.titlePrefix}
      titleHighlight={parsed.titleHighlight}
      subtitle={parsed.subtitle}
      tone="comparison"
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      showHeaderDivider={false}
      contentTop={150}
      contentHeight={504}
    >
      {parsed.showDecorations ? <BalancedComparisonDecorations /> : null}
      <div className="relative z-10 grid h-full min-h-0 grid-cols-2 gap-[50px]">
        {parsed.cards.map((card) => (
          <SectorStructureCard
            key={card.entityName}
            entityName={card.entityName}
            badge={card.badge}
            tone={card.tone as ComparisonTone}
            centerValue={card.centerValue}
            centerLabel={card.centerLabel}
            segments={card.segments.map((segment, index) => ({
              ...segment,
              color: segment.color ?? sectorColor(segment.label, index),
            }))}
            insight={{
              title: card.insightTitle,
              description: card.insightDescription,
            }}
          />
        ))}
      </div>
    </ThemeContentFrame>
  );
};

export default EconomicStructure;
