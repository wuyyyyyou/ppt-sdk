import React from "react";
import * as z from "zod";

import FinanceCanvas from "../components/FinanceCanvas.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import IconText from "../components/IconText.js";
import { redFinanceTheme } from "../theme/tokens.js";

const AgendaIconSchema = z.enum([
  "book-open",
  "list",
  "chart-pie",
  "chart-line",
  "laptop-code",
  "microchip",
  "chess",
  "shield",
  "route",
  "flag",
]);

const AgendaItemSchema = z.object({
  number: z.string().min(2).max(3),
  title: z.string().min(2).max(24),
  icon: AgendaIconSchema,
  highlighted: z.boolean().default(false),
});

export const Schema = z.object({
  title: z.string().min(2).max(20).default("目录"),
  brandName: z.string().min(2).max(80).default("GLOBAL FINANCE INSIGHTS"),
  footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
  pageNumber: z.string().min(2).max(4).default("02"),
  items: z.array(AgendaItemSchema).min(2).max(10).default([
    { number: "01", title: "封面", icon: "book-open", highlighted: false },
    { number: "02", title: "目录", icon: "list", highlighted: true },
    { number: "03", title: "行业概况", icon: "chart-pie", highlighted: false },
    { number: "04", title: "市场趋势（2026）", icon: "chart-line", highlighted: false },
    { number: "05", title: "数字化转型", icon: "laptop-code", highlighted: false },
    { number: "06", title: "金融科技创新", icon: "microchip", highlighted: false },
    { number: "07", title: "竞争格局", icon: "chess", highlighted: false },
    { number: "08", title: "风险管理", icon: "shield", highlighted: false },
    { number: "09", title: "战略规划", icon: "route", highlighted: false },
    { number: "10", title: "总结展望", icon: "flag", highlighted: false },
  ]),
});

export const layoutId = "agenda-grid";
export const layoutName = "Agenda Grid";
export const layoutDescription =
  "A component-oriented finance agenda slide with editable section items and a stable two-column grid.";
export const layoutTags = ["agenda", "toc", "finance", "componentized"];
export const layoutRole = "agenda";
export const contentElements = ["agenda-grid", "outline", "numbered-list"];
export const useCases = ["agenda", "table-of-contents", "section-overview"];
export const suitableFor =
  "Suitable for agenda pages and section overviews when the deck needs a structured chapter list.";
export const avoidFor =
  "Avoid using this layout for narrative explanation, KPI summaries, or dense analytical content.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const AgendaGrid = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <div className="relative h-[720px] w-[1280px]">
      <FinanceCanvas>
        <div className="absolute left-[80px] right-[80px] top-[52px] z-10 flex items-end justify-between">
          <div className="flex h-[58px] items-center whitespace-nowrap text-[48px] font-black leading-[58px]" style={{ color: redFinanceTheme.colors.backgroundText }}>
            {parsed.title}
          </div>
          <IconText
            icon={<FinanceIcon name="bank" className="h-[22px] w-[22px]" />}
            label={parsed.brandName}
            height={28}
            iconSize={22}
            gap={10}
            textWidth={360}
            fontSize={16}
            fontWeight={500}
            textColor={redFinanceTheme.colors.mutedText}
          />
        </div>

        <div className="absolute left-[80px] top-[138px] z-10 h-[2px] w-[1120px]" style={{ backgroundColor: redFinanceTheme.colors.stroke }} />
        <div className="absolute left-[80px] top-[132px] z-10 h-[6px] w-[120px]" style={{ backgroundColor: redFinanceTheme.colors.primary }} />

        <div className="absolute left-[80px] top-[178px] z-10 grid w-[1120px] grid-cols-2 gap-x-[60px] gap-y-[24px]">
          {parsed.items.map((item) => {
            const isHighlighted = item.highlighted;

            return (
              <div
                key={`${item.number}-${item.title}`}
                className="relative flex h-[70px] items-center overflow-hidden rounded-[4px] border px-[24px]"
                style={{
                  backgroundColor: isHighlighted ? redFinanceTheme.colors.paleRed : redFinanceTheme.colors.background,
                  borderColor: redFinanceTheme.colors.stroke,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                }}
              >
                {isHighlighted ? (
                  <div
                    className="absolute left-0 top-0 h-[70px] w-[5px]"
                    style={{ backgroundColor: redFinanceTheme.colors.primary }}
                  />
                ) : null}

                <div
                  className="flex h-[28px] w-[42px] flex-none items-center justify-end whitespace-nowrap text-right text-[24px] font-black leading-[28px]"
                  style={{ color: redFinanceTheme.colors.primary }}
                >
                  {item.number}
                </div>
                <div
                  className="ml-[20px] flex h-[28px] min-w-0 flex-1 items-center whitespace-nowrap text-[20px] font-medium leading-[28px]"
                  style={{ color: isHighlighted ? redFinanceTheme.colors.primary : redFinanceTheme.colors.backgroundText }}
                >
                  {item.title}
                </div>
                <div className="ml-[15px] flex h-[24px] w-[24px] flex-none items-center justify-center">
                  <FinanceIcon
                    name={item.icon}
                    className="h-[24px] w-[24px]"
                    stroke={isHighlighted ? redFinanceTheme.colors.primary : "#D6D6D6"}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="absolute bottom-0 left-0 z-20 flex h-[50px] w-full items-center justify-between border-t px-[60px] text-[12px]"
          style={{ borderColor: "#F5F5F5", color: "#9E9E9E", backgroundColor: redFinanceTheme.colors.background }}
        >
          <div className="flex h-[16px] items-center whitespace-nowrap leading-[16px]">{parsed.footerText}</div>
          <div className="flex h-[16px] items-center whitespace-nowrap font-bold leading-[16px]" style={{ color: redFinanceTheme.colors.primary }}>
            {parsed.pageNumber}
          </div>
        </div>
      </FinanceCanvas>
    </div>
  );
};

export default AgendaGrid;
