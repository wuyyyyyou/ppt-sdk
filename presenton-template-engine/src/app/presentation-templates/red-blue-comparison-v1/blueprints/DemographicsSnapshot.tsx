import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import EntitySnapshotCard, {
  type EntitySnapshotIconName,
} from "../components/EntitySnapshotCard.tsx";
import { BalancedComparisonDecorations } from "../components/ComparisonDecorations.tsx";
import ThemeContentFrame from "../components/ThemeContentFrame.tsx";
import { type RedBlueTone } from "../theme/tokens.ts";

const ToneSchema = z.enum(["red", "blue", "purple", "neutral"]);
const SnapshotIconSchema = z.enum([
  "flag",
  "circle",
  "hourglass",
  "city",
  "building",
  "heart",
  "trend-down",
  "trend-up",
  "users",
  "globe",
]);

const KpiSchema = z.object({
  label: z.string().min(2).max(28),
  value: z.string().min(1).max(18),
  icon: SnapshotIconSchema.default("users"),
});

const SnapshotCardSchema = z.object({
  entityName: z.string().min(2).max(24),
  tone: ToneSchema,
  entityIcon: SnapshotIconSchema.default("circle"),
  heroLabel: z.string().min(2).max(28),
  heroValue: z.string().min(1).max(18),
  statusLabel: z.string().min(2).max(20).optional(),
  statusIcon: SnapshotIconSchema.default("trend-down"),
  statusTone: z.enum(["red", "blue", "purple", "neutral", "warning", "success"]).default("warning"),
  kpis: z.array(KpiSchema).min(2).max(4),
});

export const Schema = z.object({
  titlePrefix: z.string().min(2).max(30).default("Demographics:"),
  titleHighlight: z.string().min(2).max(34).default("Snapshot"),
  subtitle: z.string().min(8).max(120).default("Key population indicators revealing scale differences."),
  footerText: z.string().min(4).max(80).default("Red Blue Comparison | Demographics"),
  pageNumber: z.string().min(1).max(4).default("05"),
  cards: z.array(SnapshotCardSchema).min(2).max(2).default([
    {
      entityName: "Entity A",
      tone: "red",
      entityIcon: "flag",
      heroLabel: "Primary Scale",
      heroValue: "1.4B",
      statusLabel: "Transition",
      statusIcon: "trend-down",
      statusTone: "warning",
      kpis: [
        { label: "Median Age", value: "39.0", icon: "hourglass" },
        { label: "Urbanization", value: "66.2%", icon: "city" },
        { label: "Life Expectancy", value: "78.2", icon: "heart" },
      ],
    },
    {
      entityName: "Entity B",
      tone: "blue",
      entityIcon: "circle",
      heroLabel: "Primary Scale",
      heroValue: "122M",
      statusLabel: "Declining",
      statusIcon: "trend-down",
      statusTone: "warning",
      kpis: [
        { label: "Median Age", value: "49.5", icon: "hourglass" },
        { label: "Urbanization", value: "92.0%", icon: "building" },
        { label: "Life Expectancy", value: "84.6", icon: "heart" },
      ],
    },
  ]),
  showDecorations: z.boolean().default(true),
});

export const sampleData = Schema.parse({
  titlePrefix: "Demographics:",
  titleHighlight: "Snapshot",
  subtitle: "Key population indicators revealing scale differences (2025 Estimates)",
  footerText: "China vs Japan | Demographics",
  pageNumber: "05",
  cards: [
    {
      entityName: "CHINA",
      tone: "red",
      entityIcon: "flag",
      heroLabel: "Total Population",
      heroValue: "1.41B",
      statusLabel: "Peak Passed",
      statusIcon: "trend-down",
      statusTone: "warning",
      kpis: [
        { label: "Median Age", value: "39.0", icon: "hourglass" },
        { label: "Urbanization", value: "66.2%", icon: "city" },
        { label: "Life Expectancy", value: "78.2", icon: "heart" },
      ],
    },
    {
      entityName: "JAPAN",
      tone: "blue",
      entityIcon: "circle",
      heroLabel: "Total Population",
      heroValue: "122.6M",
      statusLabel: "Declining",
      statusIcon: "trend-down",
      statusTone: "warning",
      kpis: [
        { label: "Median Age", value: "49.5", icon: "hourglass" },
        { label: "Urbanization", value: "92.0%", icon: "building" },
        { label: "Life Expectancy", value: "84.6", icon: "heart" },
      ],
    },
  ],
  showDecorations: true,
});

export const layoutId = "demographics-snapshot";
export const layoutName = "Demographics Snapshot";
export const layoutDescription =
  "A TSX-first two-entity demographic snapshot page with large hero metrics and compact KPI rows.";
export const layoutTags = ["demographics", "snapshot", "kpi", "comparison", "red-blue", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["page-title", "subtitle", "entity-snapshot-cards", "hero-metrics", "kpi-list"];
export const useCases = ["demographic comparison", "population snapshot", "market audience profile", "entity scale benchmark"];
export const suitableFor =
  "Suitable for comparing two entities with one primary scale metric and two to four supporting KPI indicators per entity.";
export const avoidFor =
  "Avoid using this layout for time-series trends, dense tables, long narrative explanation, or more than two primary entities.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const DemographicsSnapshot = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);

  return (
    <ThemeContentFrame
      titlePrefix={parsed.titlePrefix}
      titleHighlight={parsed.titleHighlight}
      subtitle={parsed.subtitle}
      tone="purple"
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      showHeaderDivider={false}
      contentTop={150}
      contentHeight={504}
    >
      {parsed.showDecorations ? <BalancedComparisonDecorations /> : null}
      <div className="relative z-10 grid h-full min-h-0 grid-cols-2 gap-[40px]">
        {parsed.cards.map((card) => (
          <EntitySnapshotCard
            key={card.entityName}
            entityName={card.entityName}
            tone={card.tone as RedBlueTone}
            entityIcon={card.entityIcon as EntitySnapshotIconName}
            hero={{
              label: card.heroLabel,
              value: card.heroValue,
              statusLabel: card.statusLabel,
              statusIcon: card.statusIcon as EntitySnapshotIconName,
              statusTone: card.statusTone as RedBlueTone | "warning" | "success",
            }}
            kpis={card.kpis.map((item) => ({
              label: item.label,
              value: item.value,
              icon: item.icon as EntitySnapshotIconName,
            }))}
          />
        ))}
      </div>
    </ThemeContentFrame>
  );
};

export default DemographicsSnapshot;
