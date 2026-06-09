import React from "react";
import * as z from "zod";
import { readTemplateData } from "../utils/templateData.ts";

import CoverBarDecoration from "../components/CoverBarDecoration.tsx";
import FinanceCanvas from "../components/FinanceCanvas.tsx";
import { FinanceIcon } from "../components/FinanceIcons.tsx";
import IconText from "../components/IconText.tsx";
import SectionPanelShell from "../components/SectionPanelShell.tsx";
import { redFinanceTheme } from "../theme/tokens.ts";

export const Schema = z.object({
  brandName: z.string().min(2).max(80).default("GLOBAL FINANCE INSIGHTS"),
  reportTag: z.string().min(4).max(60).default("TSX-first Baseline"),
  titleLineOne: z.string().min(2).max(28).default("Title"),
  titleLineTwo: z.string().min(2).max(32).default("Baseline"),
  subtitle: z.string().min(6).max(48).default("From finished slides to blueprint-led generation"),
  reportDate: z.string().min(6).max(24).default("2026/05/09"),
  presenter: z.string().min(2).max(40).default("Template Migration"),
  classification: z.string().min(4).max(40).default("Internal Draft"),
  variant: z.enum(["statement-notes", "statement-visual"]).default("statement-notes"),
  density: z.enum(["low", "medium"]).default("low"),
  noteTitle: z.string().min(2).max(32).default("Baseline"),
  notes: z
    .array(z.string().min(2).max(36))
    .min(2)
    .max(4)
    .default(["Standalone template group discovery", "Generic slides only on the main path", "Reference pages stay read-only"]),
  showPattern: z.boolean().default(true),
  showBarDecoration: z.boolean().default(true),
});

export const layoutId = "cover-statement";
export const layoutName = "Cover Statement";
export const layoutDescription =
  "A tsx-first finance cover slide with editable statement text, metadata, notes, and a reusable decorative finance visual.";
export const layoutTags = ["cover", "finance", "statement", "tsx-first"];
export const layoutRole = "cover";
export const contentElements = ["headline", "subtitle", "meta", "statement-notes"];
export const useCases = ["cover", "opening", "theme-statement", "executive-brief"];
export const suitableFor =
  "Suitable for opening a finance or strategy deck with a concise central statement and supporting baseline notes.";
export const avoidFor =
  "Avoid using this layout for dense analytical evidence, process details, or multi-chart pages.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const CoverStatement = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = readTemplateData(Schema, data);
  const showNotes = parsed.variant === "statement-notes";
  const titleFontSize = parsed.density === "medium" ? 68 : 76;

  return (
    <div className="relative h-[720px] w-[1280px]">
      <FinanceCanvas>
        {parsed.showPattern ? (
          <div className="absolute right-0 bottom-0 h-full w-[620px] opacity-25">
            {Array.from({ length: 24 }).map((_, rowIndex) => (
              <div key={`pattern-row-${rowIndex}`} className="flex h-[30px]">
                {Array.from({ length: 20 }).map((__, columnIndex) => (
                  <div
                    key={`pattern-dot-${rowIndex}-${columnIndex}`}
                    className="h-[2px] w-[2px] flex-none rounded-full"
                    style={{
                      marginLeft: columnIndex === 0 ? 0 : 28,
                      marginTop: 14,
                      backgroundColor: redFinanceTheme.colors.softStroke,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : null}

        <div
          className="absolute left-0 top-[114px] h-[188px] w-[12px]"
          style={{ backgroundColor: redFinanceTheme.colors.primary }}
        />

        <div className="absolute left-[96px] right-[72px] top-[42px] z-20 flex items-center justify-between">
          <IconText
            icon={<FinanceIcon name="bank" className="h-7 w-7 flex-none" />}
            label={parsed.brandName}
            height={34}
            iconSize={28}
            gap={12}
            textWidth={540}
            fontSize={20}
            fontWeight={700}
          />

          <div className="flex w-[320px] flex-col items-end">
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
          className="absolute left-[96px] top-[228px] z-10 flex h-[80px] w-[650px] items-center whitespace-nowrap text-[76px] font-black leading-none"
          style={{ color: redFinanceTheme.colors.backgroundText, fontSize: titleFontSize }}
        >
          {parsed.titleLineOne}
        </div>

        <div
          className="absolute left-[96px] top-[312px] z-10 flex h-[80px] w-[650px] items-center whitespace-nowrap text-[76px] font-black leading-none"
          style={{ color: redFinanceTheme.colors.primary, fontSize: titleFontSize }}
        >
          {parsed.titleLineTwo}
        </div>

        <div className="absolute left-[96px] top-[430px] z-10 flex h-[58px]">
          <div
            className="flex h-[58px] w-[560px] items-center justify-center"
            style={{
              backgroundColor: redFinanceTheme.colors.primary,
              color: redFinanceTheme.colors.primaryText,
            }}
          >
            <div className="flex h-full w-full items-center justify-center whitespace-nowrap text-center text-[23px] font-medium">
              {parsed.subtitle}
            </div>
          </div>
          <div className="h-[58px] w-[10px]" style={{ backgroundColor: redFinanceTheme.colors.deepRed }} />
        </div>

        {showNotes ? (
        <div className="absolute right-[80px] top-[196px] z-20 w-[320px]">
          <SectionPanelShell paddingX={22} paddingY={22} radius={8} backgroundColor={redFinanceTheme.colors.surface}>
            <div
              className="mb-[18px] text-[20px] font-black uppercase leading-none"
              style={{ color: redFinanceTheme.colors.primary }}
            >
              {parsed.noteTitle}
            </div>
            <div className="flex flex-col gap-[14px]">
              {parsed.notes.map((note, index) => (
                <div key={`${note}-${index}`} className="flex items-start gap-[12px]">
                  <div
                    className="mt-[3px] flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[4px] text-[12px] font-black"
                    style={{
                      color: redFinanceTheme.colors.primaryText,
                      backgroundColor: redFinanceTheme.colors.primary,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div
                    className="min-w-0 text-[15px] font-semibold leading-[1.45]"
                    style={{ color: redFinanceTheme.colors.backgroundText }}
                  >
                    {note}
                  </div>
                </div>
              ))}
            </div>
          </SectionPanelShell>
        </div>
        ) : null}

        {parsed.showBarDecoration ? (
          <div className={showNotes ? "absolute bottom-[88px] right-[92px] z-10" : "absolute bottom-[108px] right-[148px] z-10 scale-[1.18]"}>
            <CoverBarDecoration />
          </div>
        ) : null}

        <div className="absolute bottom-[58px] left-[96px] z-10 flex items-center gap-[38px]">
          <IconText
            icon={<FinanceIcon name="calendar" className="h-[18px] w-[18px]" />}
            label={parsed.reportDate}
            minTextWidth={112}
          />
          <IconText
            icon={<FinanceIcon name="user" className="h-[18px] w-[18px]" />}
            label={parsed.presenter}
            minTextWidth={160}
          />
          <IconText
            icon={<FinanceIcon name="shield" className="h-[18px] w-[18px]" />}
            label={parsed.classification}
            minTextWidth={136}
          />
        </div>
      </FinanceCanvas>
    </div>
  );
};

export default CoverStatement;
