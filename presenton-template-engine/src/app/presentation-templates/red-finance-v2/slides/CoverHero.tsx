import React from "react";
import * as z from "zod";

import CoverBarDecoration from "../components/CoverBarDecoration.js";
import { CoverMetaItem } from "../components/CoverMetaItem.js";
import FinanceCanvas from "../components/FinanceCanvas.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import { redFinanceTheme } from "../theme/tokens.js";

export const Schema = z.object({
  brandName: z.string().min(2).max(80).default("GLOBAL FINANCE INSIGHTS"),
  reportTag: z.string().min(6).max(60).default("Strategic Analysis 2026"),
  titleLineOne: z.string().min(2).max(24).default("金融行业"),
  titleLineTwo: z.string().min(2).max(32).default("战略分析报告"),
  subtitle: z.string().min(6).max(40).default("把握趋势 · 夯实风控 · 驱动增长"),
  reportDate: z.string().min(6).max(24).default("2026/03/02"),
  presenter: z.string().min(2).max(40).default("[Name Here]"),
  classification: z.string().min(4).max(40).default("绝密资料 · 内部参考"),
  showPattern: z.boolean().default(true),
  showAccentBar: z.boolean().default(true),
  showBarDecoration: z.boolean().default(true),
});

export const layoutId = "cover-hero";
export const layoutName = "Cover Hero";
export const layoutDescription =
  "A component-oriented finance cover slide with editable title, metadata, and a fixed decorative finance visual.";
export const layoutTags = ["cover", "finance", "hero", "componentized"];
export const layoutRole = "cover";
export const contentElements = ["headline", "meta", "hero-graphic"];
export const useCases = ["cover", "opening", "executive-brief"];
export const suitableFor =
  "Suitable for opening a finance or strategy deck with a strong title, subtitle, and presenter metadata.";
export const avoidFor =
  "Avoid using this layout for analytical body content, process steps, or dense comparison text.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const CoverHero = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <div className="relative h-[720px] w-[1280px]">
      <FinanceCanvas>
      {parsed.showPattern ? (
        <div className="absolute right-0 bottom-0 h-full w-[640px] opacity-30">
          {Array.from({ length: 24 }).map((_, rowIndex) => (
            <div key={`pattern-row-${rowIndex}`} className="flex h-[30px]">
              {Array.from({ length: 22 }).map((__, columnIndex) => (
                <div
                  key={`pattern-dot-${rowIndex}-${columnIndex}`}
                  className="h-[2px] w-[2px] flex-none rounded-full"
                  style={{
                    marginLeft: columnIndex === 0 ? 0 : 28,
                    marginTop: 14,
                    backgroundColor: "#E0E0E0",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {parsed.showAccentBar ? (
        <div
          className="absolute left-0 top-[108px] h-[180px] w-[12px]"
          style={{ backgroundColor: redFinanceTheme.colors.primary }}
        />
      ) : null}

      <div className="absolute left-[100px] right-[60px] top-[40px] z-20 flex items-center justify-between">
        <div
          className="flex h-[34px] items-center gap-3 text-[20px] font-bold"
          style={{ color: redFinanceTheme.colors.backgroundText }}
        >
          <FinanceIcon name="bank" className="h-7 w-7 flex-none" />
          <div className="w-[520px] whitespace-nowrap">{parsed.brandName}</div>
        </div>

        <div className="flex w-[305px] flex-col items-end">
          <div
            className="w-full whitespace-nowrap text-right text-[14px] font-bold uppercase leading-none"
            style={{ color: redFinanceTheme.colors.primary }}
          >
            {parsed.reportTag}
          </div>
          <div className="mt-[8px] h-[2px] w-full" style={{ backgroundColor: redFinanceTheme.colors.primary }} />
        </div>
      </div>

      <div
        className="absolute left-[100px] top-[236px] z-10 flex h-[84px] w-[430px] items-center whitespace-nowrap text-[84px] font-black leading-none"
        style={{ color: redFinanceTheme.colors.backgroundText }}
      >
        {parsed.titleLineOne}
      </div>

      <div
        className="absolute left-[100px] top-[322px] z-10 flex h-[84px] w-[680px] items-center whitespace-nowrap text-[84px] font-black leading-none"
        style={{ color: redFinanceTheme.colors.primary }}
      >
        {parsed.titleLineTwo}
      </div>

      <div className="absolute left-[100px] top-[434px] z-10 flex h-[58px]">
        <div
          className="flex h-[58px] w-[500px] items-center justify-center"
          style={{
            backgroundColor: redFinanceTheme.colors.primary,
            color: redFinanceTheme.colors.primaryText,
          }}
        >
          <div className="flex h-full w-full items-center justify-center whitespace-nowrap text-center text-[24px] font-medium">
            {parsed.subtitle}
          </div>
        </div>
        <div className="h-[58px] w-[10px]" style={{ backgroundColor: redFinanceTheme.colors.deepRed }} />
      </div>

      {parsed.showBarDecoration ? (
        <div className="absolute bottom-[100px] right-[80px] z-10">
          <CoverBarDecoration />
        </div>
      ) : null}

      <div className="absolute bottom-[60px] left-[100px] z-10 flex items-center gap-[40px]">
        <CoverMetaItem
          icon={<FinanceIcon name="calendar" className="h-[18px] w-[18px]" />}
          label={parsed.reportDate}
          minTextWidth={112}
        />
        <CoverMetaItem
          icon={<FinanceIcon name="user" className="h-[18px] w-[18px]" />}
          label={`报告人：${parsed.presenter}`}
        />
        <CoverMetaItem
          icon={<FinanceIcon name="shield" className="h-[18px] w-[18px]" />}
          label={parsed.classification}
        />
      </div>
      </FinanceCanvas>
    </div>
  );
};

export default CoverHero;
