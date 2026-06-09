import React from "react";
import * as z from "zod";

import RedBlueContentFrame from "../components/RedBlueContentFrame.tsx";
import RedBlueCountryCard from "../components/RedBlueCountryCard.tsx";
import RedBlueInsightCard from "../components/RedBlueInsightCard.tsx";

const ToneSchema = z.enum(["china", "japan", "korea", "purple", "neutral"]);

const CountrySchema = z.object({
  name: z.string().min(2).max(24),
  heroValue: z.string().min(1).max(24),
  heroLabel: z.string().min(2).max(32),
  tone: ToneSchema.default("neutral"),
  kpis: z.array(z.object({
    label: z.string().min(2).max(32),
    value: z.string().min(1).max(32),
  })).min(2).max(4),
});

export const Schema = z.object({
  title: z.string().min(2).max(52).default("Country Comparison"),
  subtitle: z.string().min(2).max(96).default("Compare country-level scale and capability through aligned KPI cards."),
  footerText: z.string().min(2).max(80).default("Red Blue Professional"),
  pageNumber: z.string().min(1).max(4).default("05"),
  countries: z.array(CountrySchema).min(2).max(3).default([
    { name: "China", heroValue: "1.41B", heroLabel: "Population", tone: "china", kpis: [{ label: "GDP rank", value: "#2" }, { label: "Urban scale", value: "High" }] },
    { name: "Japan", heroValue: "125M", heroLabel: "Population", tone: "japan", kpis: [{ label: "GDP rank", value: "#4" }, { label: "Innovation", value: "Strong" }] },
    { name: "Korea", heroValue: "52M", heroLabel: "Population", tone: "korea", kpis: [{ label: "GDP rank", value: "#13" }, { label: "Digital adoption", value: "High" }] },
  ]),
  insightTitle: z.string().min(2).max(40).default("Comparison readout"),
  insightText: z.string().min(8).max(180).default("Keep fields aligned across countries so differences come from evidence rather than layout noise."),
});

export const layoutId = "country-comparison";
export const layoutName = "Country Comparison";
export const layoutDescription = "Two or three aligned country cards with an executive comparison readout.";
export const layoutTags = ["comparison", "countries", "cards", "red-blue"];
export const layoutRole = "content";
export const contentElements = ["heading", "card-grid", "insight"];
export const useCases = ["country-comparison", "market-analysis", "public-policy"];
export const suitableFor = "Suitable for comparing two or three entities with matched KPI fields.";
export const avoidFor = "Avoid for single-topic narrative pages.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const CountryComparison = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <RedBlueContentFrame title={parsed.title} subtitle={parsed.subtitle} footerText={parsed.footerText} pageNumber={parsed.pageNumber}>
      <div className="flex h-full flex-col gap-[18px]">
        <div className={`grid flex-1 gap-[18px] ${parsed.countries.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {parsed.countries.map((country) => (
            <RedBlueCountryCard key={country.name} name={country.name} heroValue={country.heroValue} heroLabel={country.heroLabel} tone={country.tone} kpis={country.kpis} />
          ))}
        </div>
        <RedBlueInsightCard title={parsed.insightTitle} text={parsed.insightText} tone="purple" />
      </div>
    </RedBlueContentFrame>
  );
};

export default CountryComparison;
