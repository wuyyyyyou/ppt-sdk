import React from "react";
import * as z from "zod";

import RedBlueCanvas from "../components/RedBlueCanvas.tsx";
import { getToneColor, redBlueTheme } from "../theme/tokens.ts";

const ToneSchema = z.enum(["china", "japan", "korea", "purple", "neutral", "green"]);

const CardSchema = z.object({
  number: z.string().min(1).max(4),
  title: z.string().min(2).max(32),
  description: z.string().min(8).max(160).optional(),
  icon: z.string().min(1).max(4).optional(),
  points: z.array(z.string().min(8).max(120)).min(1).max(4).optional(),
  tone: ToneSchema.default("purple"),
});

export const Schema = z.object({
  title: z.string().min(2).max(56).default("Key Insights & Recommendations"),
  subtitle: z.string().min(2).max(140).default("Strategic directions for navigating the East Asian economic landscape."),
  footerText: z.string().min(2).max(80).default("Red Blue Professional"),
  pageNumber: z.string().min(1).max(4).default("03"),
  cards: z.array(CardSchema).min(3).max(3).default([
    {
      number: "01",
      title: "Strategy",
      icon: "N",
      points: [
        "Focus on high value-add sectors to combat commoditization.",
        "Diversify markets regionally to reduce dependency.",
        "Accelerate digital transformation across traditional industries.",
      ],
      tone: "purple",
    },
    {
      number: "02",
      title: "Risks",
      icon: "!",
      points: [
        "Geopolitical friction impacting trade flows and stability.",
        "Demographic headwinds shrinking the labor force.",
        "Technology barriers and decoupling in critical sectors.",
      ],
      tone: "china",
    },
    {
      number: "03",
      title: "Actions",
      icon: "^",
      points: [
        "Strengthen R&D investment and global talent acquisition.",
        "Optimize supply chains for dual circulation resilience.",
        "Enhance ESG standards and regulatory compliance.",
      ],
      tone: "green",
    },
  ]),
  insightTitle: z.string().min(2).max(40).optional(),
  insightText: z.string().min(8).optional(),
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

export const sampleData = {
  title: "Key Insights & Recommendations",
  subtitle: "Strategic directions for navigating the East Asian economic landscape.",
  footerText: "Red Blue Professional | Three Topic Cards",
  pageNumber: "03",
  cards: [
    {
      number: "01",
      title: "Strategy",
      icon: "N",
      points: [
        "Focus on high value-add sectors to combat commoditization.",
        "Diversify markets regionally to reduce dependency.",
        "Accelerate digital transformation across traditional industries.",
      ],
      tone: "purple",
    },
    {
      number: "02",
      title: "Risks",
      icon: "!",
      points: [
        "Geopolitical friction impacting trade flows and stability.",
        "Demographic headwinds shrinking the labor force.",
        "Technology barriers and decoupling in critical sectors.",
      ],
      tone: "china",
    },
    {
      number: "03",
      title: "Actions",
      icon: "^",
      points: [
        "Strengthen R&D investment and global talent acquisition.",
        "Optimize supply chains for dual circulation resilience.",
        "Enhance ESG standards and regulatory compliance.",
      ],
      tone: "green",
    },
  ],
} satisfies z.infer<typeof Schema>;

function getCardColor(tone: z.infer<typeof ToneSchema>) {
  return tone === "green" ? "#00D084" : getToneColor(tone);
}

function getCardPoints(card: z.infer<typeof CardSchema>) {
  return card.points?.length ? card.points : card.description ? [card.description] : [];
}

const ThreeTopicCards = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <RedBlueCanvas showGrid={false} showDecorations={false}>
      <div
        className="absolute rounded-full"
        style={{
          width: 400,
          height: 400,
          left: -100,
          top: -150,
          backgroundColor: "rgba(80,56,166,0.04)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 300,
          height: 300,
          right: -50,
          bottom: -100,
          backgroundColor: "rgba(255,71,87,0.04)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 200,
          height: 200,
          right: 100,
          top: 50,
          backgroundColor: "rgba(0,208,132,0.04)",
        }}
      />

      <div className="absolute inset-0 z-10 flex flex-col px-[80px] py-[60px]">
        <header className="mb-[50px] text-center">
          <h1
            className="m-0 text-[56px] font-black leading-[62px]"
            style={{
              color: redBlueTheme.colors.purple,
              fontFamily: redBlueTheme.fonts.heading,
            }}
          >
            {parsed.title}
          </h1>
          <p
            className="m-0 mt-[16px] text-[20px] font-medium leading-[28px]"
            style={{ color: redBlueTheme.colors.mutedText }}
          >
            {parsed.subtitle}
          </p>
        </header>

        <div className="flex min-h-0 flex-1 items-stretch justify-center gap-[40px]">
          {parsed.cards.map((card) => {
            const color = getCardColor(card.tone);
            const points = getCardPoints(card);

            return (
              <div
                key={card.number}
                className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-white"
                style={{
                  borderTop: `8px solid ${color}`,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  className="pointer-events-none absolute bottom-[-40px] right-[-20px] z-0 text-[180px] font-black leading-none"
                  style={{
                    color: "rgba(0,0,0,0.03)",
                    fontFamily: redBlueTheme.fonts.heading,
                  }}
                >
                  {card.number}
                </div>
                <div className="relative z-10 flex flex-col items-center px-[30px] pb-[20px] pt-[30px] text-center">
                  <div
                    className="mb-[20px] flex h-[80px] w-[80px] items-center justify-center rounded-full text-[32px] font-black"
                    style={{
                      backgroundColor: `${color}18`,
                      color,
                      boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
                      fontFamily: redBlueTheme.fonts.heading,
                    }}
                  >
                    {card.icon ?? card.number}
                  </div>
                  <h2
                    className="m-0 text-[24px] font-extrabold uppercase leading-[30px]"
                    style={{
                      color,
                      fontFamily: redBlueTheme.fonts.heading,
                      letterSpacing: 1,
                    }}
                  >
                    {card.title}
                  </h2>
                </div>
                <div className="relative z-10 flex-1 px-[30px] pb-[40px] pt-[10px]">
                  <ul className="m-0 flex list-none flex-col gap-[20px] p-0">
                    {points.map((point) => (
                      <li key={point} className="flex items-start gap-[15px]">
                        <span
                          className="mt-[8px] h-[8px] w-[8px] shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <p
                          className="m-0 text-[16px] font-medium leading-[24px]"
                          style={{
                            color: redBlueTheme.colors.backgroundText,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {point}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div
        data-pptx-no-text-aggregate="true"
        className="absolute bottom-0 left-0 z-20 flex h-[48px] w-full items-center justify-between px-[60px] text-[12px] font-semibold"
        style={{
          color: redBlueTheme.colors.subtleText,
          borderTop: `1px solid ${redBlueTheme.colors.stroke}`,
          backgroundColor: redBlueTheme.colors.background,
        }}
      >
        <span>{parsed.footerText}</span>
        <span style={{ color: redBlueTheme.colors.purple }}>{parsed.pageNumber}</span>
      </div>
    </RedBlueCanvas>
  );
};

export default ThreeTopicCards;
