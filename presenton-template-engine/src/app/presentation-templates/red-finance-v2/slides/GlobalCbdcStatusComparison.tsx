import React from "react";
import * as z from "zod";

import FinanceContentFrame from "../components/FinanceContentFrame.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import IconText from "../components/IconText.js";
import ProgressStatusCard from "../components/ProgressStatusCard.js";
import StableMatrixGrid from "../components/StableMatrixGrid.js";
import StatusPill from "../components/StatusPill.js";
import { redFinanceTheme } from "../theme/tokens.js";

const stageSchema = z.enum(["research", "pilot", "launched"]);
const countryMarkerSchema = z.enum([
  "star",
  "flag",
  "euro",
  "circle",
  "chakra",
  "leaf",
  "check",
  "wave",
]);
const interoperabilitySchema = z.enum(["check", "progress", "none", "link"]);

const countrySchema = z.object({
  name: z.string().min(1).max(16),
  code: z.string().min(2).max(6),
  marker: countryMarkerSchema,
  stage: stageSchema,
  progress: z.number().min(0).max(100),
  status: z.string().min(2).max(24),
});

const comparisonRowSchema = z.object({
  market: z.string().min(2).max(30),
  phase: z.string().min(2).max(18),
  stage: stageSchema,
  design: z.string().min(4).max(54),
  interoperability: z.string().min(2).max(48),
  interoperabilityStatus: interoperabilitySchema,
});

type StageKey = z.infer<typeof stageSchema>;
type CountryMarkerKey = z.infer<typeof countryMarkerSchema>;
type InteroperabilityKey = z.infer<typeof interoperabilitySchema>;

export const Schema = z.object({
  title: z.string().min(4).max(30).default("全球CBDC发展现状对比"),
  metaLabel: z.string().min(4).max(40).default("GLOBAL CBDC STATUS"),
  stageLabels: z
    .object({
      research: z.string().min(2).max(28).default("研究阶段 (Research)"),
      pilot: z.string().min(2).max(28).default("试点阶段 (Pilot)"),
      launched: z.string().min(2).max(28).default("正式推出 (Launched)"),
    })
    .default({
      research: "研究阶段 (Research)",
      pilot: "试点阶段 (Pilot)",
      launched: "正式推出 (Launched)",
    }),
  countries: z.array(countrySchema).min(4).max(8).default([
    {
      name: "中国",
      code: "CN",
      marker: "star",
      stage: "pilot",
      progress: 90,
      status: "大规模试点",
    },
    {
      name: "美国",
      code: "US",
      marker: "flag",
      stage: "research",
      progress: 30,
      status: "批发型研究",
    },
    {
      name: "欧盟",
      code: "EU",
      marker: "euro",
      stage: "pilot",
      progress: 50,
      status: "准备阶段",
    },
    {
      name: "日本",
      code: "JP",
      marker: "circle",
      stage: "pilot",
      progress: 40,
      status: "概念验证",
    },
    {
      name: "印度",
      code: "IN",
      marker: "chakra",
      stage: "pilot",
      progress: 60,
      status: "零售试点",
    },
    {
      name: "巴西",
      code: "BR",
      marker: "leaf",
      stage: "pilot",
      progress: 70,
      status: "Drex试点",
    },
    {
      name: "尼日利亚",
      code: "NG",
      marker: "check",
      stage: "launched",
      progress: 100,
      status: "eNaira推出",
    },
    {
      name: "巴哈马",
      code: "BS",
      marker: "wave",
      stage: "launched",
      progress: 100,
      status: "Sand Dollar",
    },
  ]),
  columns: z
    .object({
      market: z.string().min(2).max(16).default("国家/地区"),
      phase: z.string().min(2).max(16).default("当前阶段"),
      design: z.string().min(2).max(20).default("核心设计特点"),
      interoperability: z.string().min(2).max(20).default("互操作性进展"),
    })
    .default({
      market: "国家/地区",
      phase: "当前阶段",
      design: "核心设计特点",
      interoperability: "互操作性进展",
    }),
  comparisonRows: z.array(comparisonRowSchema).min(3).max(5).default([
    {
      market: "中国 (e-CNY)",
      phase: "大规模试点",
      stage: "pilot",
      design: "双层运营，支持双离线支付",
      interoperability: "mBridge项目核心成员",
      interoperabilityStatus: "check",
    },
    {
      market: "欧盟 (Digital Euro)",
      phase: "准备阶段",
      stage: "pilot",
      design: "强调隐私保护，中介分发模式",
      interoperability: "欧元区内互通规划",
      interoperabilityStatus: "progress",
    },
    {
      market: "美国 (Digital Dollar)",
      phase: "研究阶段",
      stage: "research",
      design: "批发型优先，注重隐私合规",
      interoperability: "暂无具体跨境计划",
      interoperabilityStatus: "none",
    },
    {
      market: "巴哈马 (Sand Dollar)",
      phase: "正式推出",
      stage: "launched",
      design: "零售型，旨在提升普惠金融",
      interoperability: "与万事达卡合作发卡",
      interoperabilityStatus: "link",
    },
  ]),
  footerText: z.string().min(4).max(120).default("金融行业战略分析报告 | 绝密资料"),
  pageNumber: z.string().min(1).max(8).default("17"),
});

export const layoutId = "global-cbdc-status-comparison";
export const layoutName = "Global CBDC Status Comparison";
export const layoutDescription =
  "A CBDC comparison slide with reusable stage pills, progress status cards, and a stable editable comparison matrix.";
export const layoutTags = ["digital-currency", "cbdc", "comparison", "table", "componentized"];
export const layoutRole = "comparison";
export const contentElements = ["stage-legend", "country-progress-cards", "comparison-table"];
export const useCases = ["cbdc-status", "market-comparison", "digital-currency-benchmark"];
export const suitableFor =
  "Suitable for rollout-stage comparisons that need a small legend, a grid of progress cards, and a structured text-first comparison table.";
export const avoidFor =
  "Avoid using this layout for chart-heavy narratives, long-form regulatory analysis, or matrices with more than five comparison rows.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const stagePalette: Record<
  StageKey,
  {
    backgroundColor: string;
    textColor: string;
    dotColor: string;
    progressColor: string;
  }
> = {
  research: {
    backgroundColor: "#EEEEEE",
    textColor: "#616161",
    dotColor: "#B0B0B0",
    progressColor: "#9E9E9E",
  },
  pilot: {
    backgroundColor: "#FFEBEE",
    textColor: "#B71C1C",
    dotColor: "#EF5350",
    progressColor: "#D32F2F",
  },
  launched: {
    backgroundColor: "#B71C1C",
    textColor: "#FFFFFF",
    dotColor: "#FFFFFF",
    progressColor: "#B71C1C",
  },
};

const markerColorMap: Record<CountryMarkerKey, string> = {
  star: "#C62828",
  flag: "#757575",
  euro: "#1E88E5",
  circle: "#EF9A9A",
  chakra: "#FB8C00",
  leaf: "#2E7D32",
  check: "#2E7D32",
  wave: "#4FC3F7",
};

const MarkerIcon = ({
  marker,
  color,
}: {
  marker: CountryMarkerKey;
  color: string;
}) => {
  switch (marker) {
    case "star":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill={color}>
          <path d="m12 3.8 2.1 4.35 4.8.7-3.45 3.36.82 4.79L12 14.85l-4.27 2.15.82-4.79L5.1 8.85l4.8-.7L12 3.8Z" />
        </svg>
      );
    case "flag":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill="none">
          <path d="M6 20V4.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M6.2 5.5c2-1.2 3.95-.8 5.8.05 1.8.8 3.45 1.15 5.8-.05v7.2c-2.05 1.2-3.95.8-5.8-.05-1.85-.85-3.8-1.25-5.8-.05Z"
            stroke={color}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "euro":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill="none">
          <path
            d="M16.6 7.4A5 5 0 0 0 9 10.2m7.6 6.4A5 5 0 0 1 9 13.8M7 10.2h8.2M7 13.8h8.2"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "circle":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill={color}>
          <circle cx="12" cy="12" r="6.5" />
        </svg>
      );
    case "chakra":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill="none">
          <circle cx="12" cy="12" r="5.8" stroke={color} strokeWidth="1.6" />
          <circle cx="12" cy="12" r="1.3" fill={color} stroke="none" />
          <path
            d="M12 6.2v11.6M6.2 12h11.6M8 8l8 8M16 8l-8 8"
            stroke={color}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "leaf":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill="none">
          <path
            d="M18.5 5.5c-6 .1-10.5 3.65-11 10.2 2.55 1.3 6.35.65 8.8-1.8 2.45-2.45 3.1-6.25 2.2-8.4Z"
            stroke={color}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M8.6 15.2c2.15-1.4 4.1-3.35 5.8-5.8"
            stroke={color}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "check":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill="none">
          <circle cx="12" cy="12" r="7" stroke={color} strokeWidth="1.8" />
          <path
            d="m8.7 12.1 2.1 2.1 4.5-4.7"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "wave":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill="none">
          <path
            d="M4.5 14c1.25 0 1.9-.8 2.55-1.6.65-.8 1.3-1.6 2.55-1.6s1.9.8 2.55 1.6c.65.8 1.3 1.6 2.55 1.6s1.9-.8 2.55-1.6c.65-.8 1.3-1.6 2.55-1.6"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
  }
};

const InteroperabilityIcon = ({
  status,
  color,
}: {
  status: InteroperabilityKey;
  color: string;
}) => {
  switch (status) {
    case "check":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[14px] w-[14px]" fill="none">
          <path
            d="m5 12.4 4.1 4.1L19 7.1"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "progress":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[14px] w-[14px]" fill="none">
          <path
            d="M12 4.6a7.4 7.4 0 1 1-7.4 7.4"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 7.2V12l3.1 2"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "none":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[14px] w-[14px]" fill="none">
          <path d="M6 12h12" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "link":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[14px] w-[14px]" fill="none">
          <path
            d="M9.6 14.4 7.3 16.7a3 3 0 0 1-4.2-4.2l2.3-2.3a3 3 0 0 1 4.2 0M14.4 9.6l2.3-2.3a3 3 0 0 1 4.2 4.2l-2.3 2.3a3 3 0 0 1-4.2 0M8.8 15.2l6.4-6.4"
            stroke={color}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
};

const getInteroperabilityColor = (status: InteroperabilityKey) => {
  if (status === "none") {
    return "#B0B0B0";
  }
  if (status === "progress") {
    return "#C62828";
  }
  return redFinanceTheme.colors.primary;
};

const StagePill = ({
  label,
  stage,
  compact = false,
}: {
  label: string;
  stage: StageKey;
  compact?: boolean;
}) => {
  const palette = stagePalette[stage];

  return (
    <StatusPill
      label={label}
      backgroundColor={palette.backgroundColor}
      textColor={palette.textColor}
      leadingDotColor={palette.dotColor}
      minWidth={compact ? 74 : 160}
      height={compact ? 24 : 34}
      paddingX={compact ? 12 : 20}
      fontSize={compact ? 11 : 14}
      borderRadius={999}
      gap={compact ? 7 : 8}
      fontWeight={700}
    />
  );
};

const GlobalCbdcStatusComparison = ({
  data,
}: {
  data: Partial<z.infer<typeof Schema>>;
}) => {
  const parsed = Schema.parse(data ?? {});
  const comparisonRowCount = parsed.comparisonRows.length;
  const hasDenseCountries =
    parsed.countries.some((item) => item.name.length > 6 || item.status.length > 10) ||
    parsed.countries.length > 6;
  const hasLongTableText = parsed.comparisonRows.some(
    (row) =>
      row.market.length > 18 ||
      row.phase.length > 8 ||
      row.design.length > 18 ||
      row.interoperability.length > 16,
  );
  const legendCompact = parsed.stageLabels.launched.length > 18 || parsed.stageLabels.research.length > 18;
  const matrixDensity =
    comparisonRowCount >= 5 ? "dense" : comparisonRowCount >= 4 || hasLongTableText ? "compact" : "normal";
  const cardGap = hasDenseCountries ? 14 : 16;
  const cardMinHeight = hasDenseCountries ? 92 : 96;
  const topGap = hasDenseCountries ? 16 : 18;

  return (
    <FinanceContentFrame
      title={parsed.title}
      titleAccent="left"
      metaIcon={<FinanceIcon name="globe" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={152}
      contentHeight={520}
    >
      <div className="flex h-full flex-col overflow-hidden" style={{ gap: topGap }}>
        <div className="flex items-center justify-center gap-[32px]">
          <StagePill label={parsed.stageLabels.research} stage="research" compact={legendCompact} />
          <StagePill label={parsed.stageLabels.pilot} stage="pilot" compact={legendCompact} />
          <StagePill label={parsed.stageLabels.launched} stage="launched" compact={legendCompact} />
        </div>

        <div
          className="grid flex-none"
          style={{
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: `${cardGap}px`,
          }}
        >
          {parsed.countries.map((item, index) => {
            const stageStyle = stagePalette[item.stage];
            const markerColor = markerColorMap[item.marker];
            return (
              <ProgressStatusCard
                key={`${item.name}-${item.code}-${index}`}
                title={`${item.name} (${item.code})`}
                marker={<MarkerIcon marker={item.marker} color={markerColor} />}
                progress={item.progress}
                status={item.status}
                progressColor={stageStyle.progressColor}
                minHeight={cardMinHeight}
              />
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <StableMatrixGrid
            density={matrixDensity}
            rowHeaderLabel={parsed.columns.market}
            rowHeaderWidth={198}
            columns={[
              {
                label: parsed.columns.phase,
                width: 176,
              },
              {
                label: parsed.columns.design,
                width: 364,
              },
              {
                label: parsed.columns.interoperability,
              },
            ]}
            rows={parsed.comparisonRows.map((row) => ({
              header: row.market,
              cells: [
                {
                  lead: row.phase,
                  content: (
                    <StagePill label={row.phase} stage={row.stage} compact />
                  ),
                },
                {
                  lead: row.design,
                  align: "center",
                  leadColor: redFinanceTheme.colors.backgroundText,
                  supportColor: redFinanceTheme.colors.mutedText,
                },
                {
                  lead: row.interoperability,
                  content: (
                    <IconText
                      icon={
                        <InteroperabilityIcon
                          status={row.interoperabilityStatus}
                          color={getInteroperabilityColor(row.interoperabilityStatus)}
                        />
                      }
                      label={row.interoperability}
                      height={20}
                      iconSize={14}
                      gap={8}
                      fontSize={12}
                      fontWeight={500}
                      textColor={redFinanceTheme.colors.backgroundText}
                      noWrap={false}
                    />
                  ),
                },
              ],
            }))}
            headerBackgroundColor="#FAFAFA"
            headerTextColor={redFinanceTheme.colors.backgroundText}
            rowDividerColor="#E6E6E6"
            outerBorderColor="#E6E6E6"
            rowHeaderBackgroundColor="#FFFFFF"
            stripeColors={["#FFFFFF", "#FFFFFF"]}
            shadow="0 4px 12px rgba(0,0,0,0.03)"
            borderRadius={10}
          />
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default GlobalCbdcStatusComparison;
