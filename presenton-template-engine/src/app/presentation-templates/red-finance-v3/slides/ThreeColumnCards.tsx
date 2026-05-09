import React from "react";
import * as z from "zod";

import FinanceContentFrame from "../components/FinanceContentFrame.js";
import FinanceSectionHeading from "../components/FinanceSectionHeading.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import HorizontalFeatureCard from "../components/HorizontalFeatureCard.js";

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
  footerText: z.string().min(6).max(80).default("Red Finance V3 | Three Column Cards"),
  pageNumber: z.string().min(1).max(4).default("04"),
  variant: z.enum(["three-equal-columns", "six-compact-cards"]).default("three-equal-columns"),
  density: z.enum(["low", "medium", "high"]).default("medium"),
  heading: z.string().min(2).max(32).default("并列支柱"),
  subtitle: z.string().min(8).max(96).default("三列并列，适合能力、策略、问题、机会或风险分类。"),
  cards: z.array(CardSchema).min(3).max(6).default([
    {
      icon: "chart-column",
      title: "结构化表达",
      description: "把同级要点拆成三列，避免页面变成长列表。",
      tag: "structure",
    },
    {
      icon: "shield",
      title: "平衡密度",
      description: "每张卡只容纳一组短说明，保持页面整洁。",
      tag: "balance",
    },
    {
      icon: "route",
      title: "易于延展",
      description: "适合继续扩展到更多分组或再拆成下一页。",
      tag: "extend",
    },
  ]),
  summary: z.string().min(8).max(120).default("适合三类并列信息，不适合单线叙事或复杂矩阵。"),
});

export const layoutId = "three-column-cards";
export const layoutName = "Three Column Cards";
export const layoutDescription =
  "A blueprint-first card structure for three-way categorization or compact parallel arguments.";
export const layoutTags = ["three-column", "cards", "pillars", "blueprint-first"];
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
