import React from "react";
import * as z from "zod";

import RedBlueCanvas from "../components/RedBlueCanvas.tsx";
import RedBlueCoverBackdrop from "../components/RedBlueCoverBackdrop.tsx";
import { redBlueTheme } from "../theme/tokens.ts";

export const Schema = z.object({
  eyebrow: z.string().min(2).max(48).default("China | Japan | Korea"),
  title: z.string().min(2).max(72).default("East Asia Market Comparison"),
  accentText: z.string().max(36).default("Comparison"),
  subtitle: z.string().min(2).max(132).default("A concise red-blue analytical deck for market structure, performance signals, and strategic implications."),
  author: z.string().min(2).max(64).default("Prepared for executive discussion"),
  date: z.string().min(2).max(32).default("2026"),
  indicatorLabel: z.string().min(2).max(48).default("Executive Briefing"),
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

function splitTitle(title: string, accentText: string) {
  const trimmedAccent = accentText.trim();
  if (!trimmedAccent || !title.includes(trimmedAccent)) {
    return { before: title, accent: "", after: "" };
  }

  const accentIndex = title.indexOf(trimmedAccent);
  return {
    before: title.slice(0, accentIndex),
    accent: trimmedAccent,
    after: title.slice(accentIndex + trimmedAccent.length),
  };
}

const CoverStatement = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const titleParts = splitTitle(parsed.title, parsed.accentText);

  return (
    <RedBlueCanvas showGrid={false} showDecorations={false}>
      <RedBlueCoverBackdrop variant="section-title" />
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-[120px] text-center">
        <div
          className="mb-[24px] text-[15px] font-black uppercase"
          style={{
            color: redBlueTheme.colors.purple,
            letterSpacing: 1,
          }}
        >
          {parsed.eyebrow}
        </div>
        <h1
          className="m-0 max-w-[1000px] text-[88px] font-black leading-[98px]"
          style={{
            color: redBlueTheme.colors.backgroundText,
            fontFamily: redBlueTheme.fonts.heading,
          }}
        >
          {titleParts.before}
          {titleParts.accent ? (
            <span style={{ color: redBlueTheme.colors.purple }}>{titleParts.accent}</span>
          ) : null}
          {titleParts.after}
        </h1>
        <div
          className="mb-[40px] mt-[28px] h-[6px] w-[100px] rounded-full"
          style={{ backgroundColor: redBlueTheme.colors.purple }}
        />
        <div className="max-w-[920px] text-[32px] font-medium leading-[42px]" style={{ color: redBlueTheme.colors.mutedText }}>
          {parsed.subtitle}
        </div>
        <div
          className="mt-[58px] flex items-center gap-[15px] rounded-full border bg-white px-[30px] py-[14px]"
          style={{
            borderColor: "rgba(45,52,54,0.05)",
            boxShadow: `0 10px 30px ${redBlueTheme.colors.shadow}`,
          }}
        >
          <div
            className="h-[14px] w-[14px] rounded-full"
            style={{ backgroundColor: redBlueTheme.colors.china }}
          />
          <span
            className="text-[14px] font-black uppercase"
            style={{
              color: redBlueTheme.colors.backgroundText,
              fontFamily: redBlueTheme.fonts.heading,
              letterSpacing: 1,
            }}
          >
            {parsed.indicatorLabel}
          </span>
          <span className="text-[14px] font-bold" style={{ color: redBlueTheme.colors.subtleText }}>
            {parsed.date}
          </span>
        </div>
      </div>
    </RedBlueCanvas>
  );
};

export default CoverStatement;
