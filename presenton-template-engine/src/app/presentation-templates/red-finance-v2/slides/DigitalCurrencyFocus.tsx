import React from "react";
import * as z from "zod";

import FinanceSectionFocusFrame from "../components/FinanceSectionFocusFrame.js";
import { FinanceIcon, type FinanceIconName } from "../components/FinanceIcons.js";
import HorizontalFeatureCard from "../components/HorizontalFeatureCard.js";
import { redFinanceTheme } from "../theme/tokens.js";

const focusCardSchema = z.object({
  icon: z.enum(["bank", "coins", "microchip"]),
  title: z.string().min(1).max(56),
  description: z.string().min(4).max(180),
});

export const Schema = z.object({
  sectionTag: z.string().min(2).max(64).default("PART 05 · STRATEGIC FOCUS"),
  title: z.string().min(1).max(24).default("数字货币"),
  subtitle: z.string().min(2).max(56).default("重塑全球价值流转的新基石"),
  description: z
    .string()
    .min(8)
    .max(260)
    .default(
      "从国家主权的央行数字货币到私人部门的稳定币与加密资产，数字化形态正在根本性改变货币的发行、流通与治理机制。",
    ),
  cards: z.array(focusCardSchema).min(2).max(5).default([
    {
      icon: "bank",
      title: "央行数字货币（CBDC）",
      description: "国家信用背书的法定货币数字化形态，兼顾支付效率、可追踪性与金融安全。",
    },
    {
      icon: "coins",
      title: "稳定币（Stablecoins）",
      description: "连接法币与加密世界的桥梁，正在演进为跨境支付和实时清算的新型基础设施。",
    },
    {
      icon: "microchip",
      title: "加密资产（Crypto Assets）",
      description: "去中心化网络原生的价值载体，也是 Web3 经济体系中的关键流通单元。",
    },
  ]),
  footerText: z
    .string()
    .min(2)
    .max(160)
    .default("金融行业战略分析报告 | DIGITAL CURRENCY & ASSETS"),
  pageNumber: z.string().min(1).max(8).default("15"),
});

export const layoutId = "digital-currency-focus";
export const layoutName = "Digital Currency Focus";
export const layoutDescription =
  "A section focus slide with a bold left-side hero statement, reusable right-side focus cards, and decorative background layers.";
export const layoutTags = ["transition", "focus", "digital-currency", "componentized"];
export const layoutRole = "transition";
export const contentElements = ["hero-copy", "focus-cards"];
export const useCases = ["section-focus", "chapter-break", "strategic-intro"];
export const suitableFor =
  "Suitable for chapter intros and transition slides that need a strong thematic statement plus a small set of structured focus cards.";
export const avoidFor =
  "Avoid using this layout for data-heavy analysis, charts, or pages that need large editable matrices.";
export const density = "medium";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const focusIconMap: Record<z.infer<typeof focusCardSchema>["icon"], FinanceIconName> = {
  bank: "bank",
  coins: "coins",
  microchip: "microchip",
};

const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[14px] w-[14px]" fill="none">
    <path
      d="m9 6 6 6-6 6"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const backgroundRingsSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="630" height="670" viewBox="0 0 630 670" fill="none">
  <circle cx="430" cy="360" r="400" stroke="rgba(183,28,28,0.12)" stroke-width="1" />
  <circle cx="430" cy="360" r="280" stroke="rgba(255,235,238,0.7)" stroke-width="40" />
</svg>
`;

const accentMatrixSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120" viewBox="0 0 300 120" fill="none">
  ${Array.from({ length: 32 })
    .map((_, index) => {
      const column = index % 8;
      const row = Math.floor(index / 8);
      const x = 8 + column * 34;
      const y = 16 + row * 24;

      return `<rect x="${x}" y="${y}" width="24" height="4" rx="2" transform="rotate(-35 ${x + 12} ${y + 2})" fill="rgba(224,224,224,0.72)" />`;
    })
    .join("")}
</svg>
`;

const backgroundRingsDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(backgroundRingsSvg)}`;
const accentMatrixDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(accentMatrixSvg)}`;

const BackgroundDecoration = () => (
  <>
    <img
      src={backgroundRingsDataUri}
      alt=""
      aria-hidden="true"
      className="absolute left-[650px] top-0 h-[670px] w-[630px]"
    />
    <img
      src={accentMatrixDataUri}
      alt=""
      aria-hidden="true"
      className="absolute bottom-[88px] left-[96px] h-[120px] w-[300px] opacity-80"
    />
  </>
);

const DigitalCurrencyFocus = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  const leftContent = (
    <div className="flex h-full flex-col justify-center">
      <div className="mb-[22px] flex items-center gap-[12px]">
        <div
          className="h-[2px] w-[42px] flex-none rounded-full"
          style={{ backgroundColor: redFinanceTheme.colors.primary }}
        />
        <div
          className="whitespace-nowrap text-[14px] font-bold uppercase tracking-[0.18em]"
          style={{ color: redFinanceTheme.colors.primary }}
        >
          {parsed.sectionTag}
        </div>
      </div>

      <div
        className="whitespace-nowrap text-[84px] font-black leading-[0.98] tracking-[-0.05em]"
        style={{ color: redFinanceTheme.colors.backgroundText }}
      >
        {parsed.title}
      </div>

      <div
        className="mt-[18px] whitespace-nowrap text-[28px] font-light leading-none"
        style={{ color: redFinanceTheme.colors.mutedText }}
      >
        {parsed.subtitle}
      </div>

      <div
        className="mt-[38px] h-[6px] w-[84px] rounded-full"
        style={{ backgroundColor: redFinanceTheme.colors.primary }}
      />

      <div
        className="mt-[34px] max-w-[490px] text-[16px] leading-[1.7]"
        style={{ color: redFinanceTheme.colors.mutedText }}
      >
        {parsed.description}
      </div>
    </div>
  );

  const rightContent = (
    <div className="flex h-full items-center">
      <div className="flex w-full flex-col gap-[18px]">
        {parsed.cards.map((item, index) => (
          <HorizontalFeatureCard
            key={`${item.title}-${index}`}
            iconName={focusIconMap[item.icon]}
            title={item.title}
            description={item.description}
            minHeight={118}
            railColor={redFinanceTheme.colors.primary}
            railWidth={8}
            cardRadius={12}
            iconBoxSize={52}
            titleFontSize={18}
            descriptionFontSize={13}
            descriptionLineHeight={1.5}
            shadow="0 10px 30px rgba(0,0,0,0.05)"
            cardBackgroundColor="#FFFFFF"
            borderColor="#F3F3F3"
            iconBackgroundColor="#FFEBEE"
            iconStroke={redFinanceTheme.colors.primary}
            endAdornment={(
              <div
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full"
                style={{
                  backgroundColor: "#FFF3F2",
                  color: "#E53935",
                }}
              >
                <ChevronIcon />
              </div>
            )}
            titleNoWrap
          />
        ))}
      </div>
    </div>
  );

  return (
    <FinanceSectionFocusFrame
      leftContent={leftContent}
      rightContent={rightContent}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      backgroundDecoration={<BackgroundDecoration />}
    />
  );
};

export default DigitalCurrencyFocus;
