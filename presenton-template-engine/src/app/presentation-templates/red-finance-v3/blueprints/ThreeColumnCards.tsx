import React from "react";
import * as z from "zod";

import FinanceContentFrame from "../components/FinanceContentFrame.tsx";
import FinanceSectionHeading from "../components/FinanceSectionHeading.tsx";
import { FinanceIcon } from "../components/FinanceIcons.tsx";
import HorizontalFeatureCard from "../components/HorizontalFeatureCard.tsx";

const IconSchema = z.enum([
  "bank",
  "bolt",
  "brain",
  "chart-column",
  "chart-line",
  "chart-pie",
  "coins",
  "compass",
  "database",
  "document",
  "gavel",
  "grid",
  "laptop-code",
  "lightbulb",
  "microchip",
  "route",
  "shield",
  "wallet",
]);

const CardSchema = z.object({
  icon: IconSchema,
  title: z.string().min(2).max(28),
  description: z.string().min(8).max(96),
  tag: z.string().min(2).max(18).default("card"),
});

export const Schema = z.object({
  title: z.string().min(2).max(28).default("Three Column Cards"),
  metaLabel: z.string().min(2).max(48).default("BLUEPRINT / THREE COLUMN"),
  footerText: z.string().min(6).max(80).default("Business Professional | Three Column Cards"),
  pageNumber: z.string().min(1).max(4).default("04"),
  variant: z.enum(["three-equal-columns", "six-compact-cards"]).default("three-equal-columns"),
  density: z.enum(["low", "medium", "high"]).default("medium"),
  heading: z.string().min(2).max(32).default("Parallel pillars"),
  subtitle: z.string().min(8).max(96).default("Three balanced columns for capabilities, strategies, issues, opportunities, or risks."),
  cards: z.array(CardSchema).min(3).max(6).default([
    {
      icon: "chart-column",
      title: "Structured expression",
      description: "Split peer-level ideas into columns instead of a long list.",
      tag: "structure",
    },
    {
      icon: "shield",
      title: "Balanced density",
      description: "Keep each card focused on one short explanation.",
      tag: "balance",
    },
    {
      icon: "route",
      title: "Easy extension",
      description: "Extend into more groups or split into follow-up slides.",
      tag: "extend",
    },
  ]),
  summary: z.string().min(8).max(120).default("Best for three parallel ideas; avoid using it for single-thread narratives or complex matrices."),
});

export const layoutId = "three-column-cards";
export const layoutName = "Three Column Cards";
export const layoutDescription =
  "A tsx-first card structure for three-way categorization or compact parallel arguments.";
export const layoutTags = ["three-column", "cards", "pillars", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["heading", "card-grid", "summary"];
export const useCases = ["categorization", "pillars", "options", "recommendations"];
export const suitableFor = "Suitable for three-way groupings, parallel strategies, or compact capability clusters.";
export const avoidFor = "Avoid using this layout for timelines, charts, or single-threaded explanations.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const ThreeColumnCards = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const cardDensity = parsed.density === "high" ? "dense" : parsed.density === "low" ? "compact" : "normal";
  const gridClass = parsed.variant === "six-compact-cards" ? "grid-cols-2" : "grid-cols-3";

  return (
    <FinanceContentFrame
      title={parsed.title}
      metaIcon={<FinanceIcon name="grid" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={160}
      contentBottomInset={12}
    >
      <div className="flex h-full min-h-0 flex-col gap-[14px]">
        <FinanceSectionHeading title={parsed.heading} subtitle={parsed.subtitle} />
        <div className={`grid flex-1 min-h-0 ${gridClass} gap-[14px]`}>
          {parsed.cards.map((card, index) => (
            <HorizontalFeatureCard
              key={`${card.title}-${index}`}
              iconName={card.icon}
              title={card.title}
              description={card.description}
              tag={card.tag}
              tone={index === 0 ? "accent" : "default"}
              density={cardDensity}
              minHeight={parsed.variant === "six-compact-cards" ? 138 : 176}
              titleFontSize={parsed.density === "high" ? 15 : 16}
              descriptionFontSize={parsed.density === "high" ? 12 : 13}
              descriptionLineHeight={1.45}
              tagUppercase={false}
            />
          ))}
        </div>
        <div className="text-[13px] leading-[1.45]" style={{ color: "var(--text-muted,#616161)" }}>
          {parsed.summary}
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default ThreeColumnCards;
