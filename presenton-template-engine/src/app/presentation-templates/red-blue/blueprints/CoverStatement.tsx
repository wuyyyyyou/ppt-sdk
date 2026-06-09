import React from "react";
import * as z from "zod";

import RedBlueCanvas from "../components/RedBlueCanvas.tsx";
import RedBlueCoverBackdrop from "../components/RedBlueCoverBackdrop.tsx";
import RedBlueInsightCard from "../components/RedBlueInsightCard.tsx";
import { redBlueTheme } from "../theme/tokens.ts";

export const Schema = z.object({
  eyebrow: z.string().min(2).max(48).default("China | Japan | Korea"),
  title: z.string().min(2).max(72).default("East Asia Market Comparison"),
  subtitle: z.string().min(2).max(132).default("A concise red-blue analytical deck for market structure, performance signals, and strategic implications."),
  author: z.string().min(2).max(64).default("Prepared for executive discussion"),
  date: z.string().min(2).max(32).default("2026"),
  highlights: z.array(z.string().min(2).max(64)).min(2).max(3).default([
    "Comparable evidence blocks",
    "Country-level KPI framing",
    "Decision-oriented narrative",
  ]),
});

export const layoutId = "cover-statement";
export const layoutName = "Cover Statement";
export const layoutDescription = "Opening cover for red-blue country, market, or competitor comparison decks.";
export const layoutTags = ["cover", "comparison", "executive", "red-blue"];
export const layoutRole = "cover";
export const contentElements = ["title", "subtitle", "text-block", "card"];
export const useCases = ["country-comparison", "market-research", "executive-brief"];
export const suitableFor = "Suitable for the first page of analytical comparison decks.";
export const avoidFor = "Avoid when the slide needs dense evidence or charts.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const CoverStatement = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <RedBlueCanvas showGrid={false} showDecorations={false}>
      <RedBlueCoverBackdrop />
      <div className="absolute left-[86px] top-[88px] w-[780px]">
        <div className="text-[15px] font-black uppercase tracking-[1px]" style={{ color: redBlueTheme.colors.purple }}>
          {parsed.eyebrow}
        </div>
        <div className="mt-[22px] text-[68px] font-black leading-[78px]" style={{ color: redBlueTheme.colors.backgroundText, fontFamily: redBlueTheme.fonts.heading }}>
          {parsed.title}
        </div>
        <div className="mt-[24px] max-w-[680px] text-[22px] font-semibold leading-[34px]" style={{ color: redBlueTheme.colors.mutedText }}>
          {parsed.subtitle}
        </div>
        <div className="mt-[54px] flex gap-[14px]">
          {parsed.highlights.map((item, index) => (
            <div key={item} className="rounded-[16px] bg-white px-[18px] py-[14px] text-[14px] font-black" style={{ boxShadow: `0 8px 24px ${redBlueTheme.colors.shadow}`, color: index === 1 ? redBlueTheme.colors.japan : redBlueTheme.colors.china }}>
              {item}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-[78px] right-[82px] w-[360px]">
        <RedBlueInsightCard title={parsed.author} text={parsed.date} tone="purple" />
      </div>
    </RedBlueCanvas>
  );
};

export default CoverStatement;
