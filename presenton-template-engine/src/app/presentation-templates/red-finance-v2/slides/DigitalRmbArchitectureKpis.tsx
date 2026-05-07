import React from "react";
import * as z from "zod";

import FinanceContentFrame from "../components/FinanceContentFrame.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import FinanceSectionHeading from "../components/FinanceSectionHeading.js";
import HorizontalFeatureCard from "../components/HorizontalFeatureCard.js";
import StableMatrixGrid from "../components/StableMatrixGrid.js";
import { redFinanceTheme } from "../theme/tokens.js";

const architectureNodeIconSchema = z.enum(["bank", "network", "smartphone"]);
const kpiIconSchema = z.enum(["wallet", "users", "chart-column", "grid"]);

const architectureNodeSchema = z.object({
  icon: architectureNodeIconSchema.default("bank"),
  title: z.string().min(2).max(22),
  subtitle: z.string().min(2).max(28),
});

const kpiSchema = z.object({
  icon: kpiIconSchema.default("wallet"),
  value: z.string().min(1).max(18),
  label: z.string().min(2).max(24),
  note: z.string().min(2).max(40).optional(),
});

const scenarioRowSchema = z.object({
  category: z.string().min(2).max(20),
  mode: z.string().min(2).max(32),
  value: z.string().min(2).max(44),
});

export const Schema = z.object({
  title: z.string().min(4).max(30).default("中国数字人民币 (e-CNY)"),
  metaLabel: z.string().min(4).max(40).default("ARCHITECTURE & KPIs"),
  architectureTitle: z.string().min(2).max(20).default("双层运营体系"),
  architectureNodes: z.array(architectureNodeSchema).min(3).max(4).default([
    {
      icon: "bank",
      title: "中国人民银行",
      subtitle: "发行层 (PBoC)",
    },
    {
      icon: "network",
      title: "指定运营机构",
      subtitle: "分发层 (商业银行)",
    },
    {
      icon: "smartphone",
      title: "用户 / 钱包",
      subtitle: "应用层 (流通)",
    },
  ]),
  flowLabels: z.array(z.string().min(2).max(18)).min(2).max(3).default([
    "100% 准备金",
    "兑换 / 流通",
  ]),
  metricsTitle: z.string().min(2).max(20).default("关键运营数据"),
  metrics: z.array(kpiSchema).min(3).max(6).default([
    {
      icon: "wallet",
      value: "2.61亿+",
      label: "开立钱包数量",
      note: "个人与对公钱包持续增长",
    },
    {
      icon: "grid",
      value: "26+",
      label: "试点城市区域",
      note: "覆盖零售、交通、政务等场景",
    },
    {
      icon: "chart-column",
      value: "1.8万亿+",
      label: "累计交易金额",
      note: "交易规模保持稳步扩张",
    },
    {
      icon: "users",
      value: "1000万+",
      label: "支持商户门店",
      note: "线下受理网络持续拓展",
    },
  ]),
  scenariosTitle: z.string().min(2).max(20).default("核心应用场景"),
  scenarioColumns: z
    .object({
      category: z.string().min(2).max(16).default("场景分类"),
      mode: z.string().min(2).max(16).default("应用模式"),
      value: z.string().min(2).max(16).default("核心价值"),
    })
    .default({
      category: "场景分类",
      mode: "应用模式",
      value: "核心价值",
    }),
  scenarios: z.array(scenarioRowSchema).min(3).max(6).default([
    {
      category: "零售消费",
      mode: "扫码 / 被扫 / 碰一碰",
      value: "支付即结算，低费率",
    },
    {
      category: "交通出行",
      mode: "离线 NFC / 硬钱包",
      value: "无网支付，快速过闸",
    },
    {
      category: "政务发放",
      mode: "智能合约代发",
      value: "资金透明，精准直达",
    },
    {
      category: "跨境支付",
      mode: "货币桥 (mBridge)",
      value: "缩短链路，降低成本",
    },
  ]),
  footerText: z.string().min(4).max(120).default("金融行业战略分析报告 | 绝密资料"),
  pageNumber: z.string().min(1).max(8).default("18"),
});

export const layoutId = "digital-rmb-architecture-kpis";
export const layoutName = "Digital RMB Architecture KPIs";
export const layoutDescription =
  "An e-CNY architecture slide with a left-side operating flow, reusable KPI cards, and an editable application-scenario matrix.";
export const layoutTags = ["digital-currency", "e-cny", "kpi", "table", "componentized"];
export const layoutRole = "content";
export const contentElements = ["architecture-flow", "kpi-cards", "scenario-matrix"];
export const useCases = ["digital-rmb-overview", "architecture-summary", "payment-infrastructure"];
export const suitableFor =
  "Suitable for digital currency slides that need a simple operating architecture, a small KPI cluster, and a compact text-first scenario table.";
export const avoidFor =
  "Avoid using this layout for deep technical security diagrams, large statistical tables, or pages that require more than four architecture layers.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const ArchitectureNode = ({
  item,
  isCompact,
}: {
  item: z.infer<typeof architectureNodeSchema>;
  isCompact: boolean;
}) => (
  <div
    className="relative flex items-center overflow-hidden rounded-[10px] border bg-white"
    style={{
      minHeight: isCompact ? 88 : 96,
      borderColor: redFinanceTheme.colors.stroke,
      boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
    }}
  >
    <div
      className="h-full w-[6px] flex-none"
      style={{ backgroundColor: redFinanceTheme.colors.primary }}
    />
    <div className="flex min-w-0 flex-1 items-center gap-[14px] px-[16px] py-[14px]">
      <div
        className="flex flex-none items-center justify-center rounded-[10px]"
        style={{
          width: isCompact ? 42 : 48,
          height: isCompact ? 42 : 48,
          backgroundColor: redFinanceTheme.colors.paleRed,
        }}
      >
        <FinanceIcon
          name={item.icon}
          className={isCompact ? "h-[22px] w-[22px]" : "h-[24px] w-[24px]"}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="font-bold leading-[1.2]"
          style={{
            fontSize: isCompact ? 15 : 16,
            color: redFinanceTheme.colors.backgroundText,
          }}
        >
          {item.title}
        </div>
        <div
          className="mt-[6px] leading-[1.3]"
          style={{
            fontSize: isCompact ? 11 : 12,
            color: redFinanceTheme.colors.mutedText,
          }}
        >
          {item.subtitle}
        </div>
      </div>
    </div>
  </div>
);

const FlowConnector = ({
  label,
  compact,
}: {
  label: string;
  compact: boolean;
}) => (
  <div className="relative flex items-center justify-center" style={{ height: compact ? 40 : 46 }}>
    <div className="flex h-full flex-col items-center justify-center">
      <div className="w-[2px] flex-1 rounded-full" style={{ backgroundColor: "#C9C9C9" }} />
      <svg viewBox="0 0 12 8" aria-hidden="true" className="h-[8px] w-[12px]" fill="none">
        <path
          d="M1 1.2 6 6.2l5-5"
          stroke="#B7B7B7"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
    <div
      className="absolute left-[58%] top-[8px] rounded-full bg-white px-[10px] py-[4px] text-[11px] font-medium leading-none whitespace-nowrap"
      style={{ color: redFinanceTheme.colors.mutedText, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
    >
      {label}
    </div>
  </div>
);

const DigitalRmbArchitectureKpis = ({
  data,
}: {
  data: Partial<z.infer<typeof Schema>>;
}) => {
  const parsed = Schema.parse(data ?? {});
  const architectureCount = parsed.architectureNodes.length;
  const metricCount = parsed.metrics.length;
  const scenarioCount = parsed.scenarios.length;

  const architectureCompact =
    architectureCount >= 4 ||
    parsed.architectureNodes.some(
      (item) => item.title.length > 12 || item.subtitle.length > 18,
    );
  const metricDensity =
    metricCount >= 5 ||
    parsed.metrics.some((item) => (item.note?.length ?? 0) > 24 || item.label.length > 10)
      ? "dense"
      : "compact";
  const tableDensity =
    scenarioCount >= 5 ||
    parsed.scenarios.some(
      (row) => row.category.length > 8 || row.mode.length > 14 || row.value.length > 18,
    )
      ? "dense"
      : "compact";

  const architecturePanelWidth = architectureCount >= 4 ? 330 : 344;

  return (
    <FinanceContentFrame
      title={parsed.title}
      titleAccent="left"
      metaIcon={<FinanceIcon name="wallet" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={146}
      contentHeight={522}
      contentBottomInset={10}
    >
      <div className="flex h-full gap-[26px] overflow-hidden">
        <div
          className="flex flex-none flex-col rounded-[14px] border px-[18px] py-[16px]"
          style={{
            width: architecturePanelWidth,
            borderColor: redFinanceTheme.colors.stroke,
            backgroundColor: "#FAFAFA",
          }}
        >
          <FinanceSectionHeading
            title={parsed.architectureTitle}
            marginBottom={architectureCompact ? 12 : 14}
          />
          <div className="flex min-h-0 flex-1 flex-col">
            {parsed.architectureNodes.map((item, index) => (
              <React.Fragment key={`${item.title}-${index}`}>
                <ArchitectureNode item={item} isCompact={architectureCompact} />
                {index < parsed.flowLabels.length ? (
                  <FlowConnector
                    label={parsed.flowLabels[index]}
                    compact={architectureCompact}
                  />
                ) : null}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <FinanceSectionHeading title={parsed.metricsTitle} marginBottom={12} />
          <div
            className="grid"
            style={{
              gridTemplateColumns:
                metricCount >= 5 ? "repeat(3, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))",
              gap: metricCount >= 5 ? 8 : 10,
            }}
          >
            {parsed.metrics.map((item, index) => (
              <HorizontalFeatureCard
                key={`${item.label}-${index}`}
                iconName={item.icon}
                title={item.value}
                description={
                  <div>
                    <div
                      className="font-semibold"
                      style={{
                        marginBottom: item.note ? 4 : 0,
                        color: redFinanceTheme.colors.backgroundText,
                      }}
                    >
                      {item.label}
                    </div>
                    {item.note ? <div>{item.note}</div> : null}
                  </div>
                }
                density={metricDensity}
                minHeight={metricDensity === "dense" ? 82 : 88}
                titleFontSize={metricDensity === "dense" ? 20 : 22}
                descriptionFontSize={metricDensity === "dense" ? 10 : 11}
                descriptionLineHeight={1.35}
                titleColor={redFinanceTheme.colors.backgroundText}
                descriptionColor={redFinanceTheme.colors.mutedText}
                iconBoxSize={metricDensity === "dense" ? 40 : 42}
                shadow="0 3px 8px rgba(0,0,0,0.035)"
              />
            ))}
          </div>

          <div
            className="mt-[12px] min-h-0 flex-1 overflow-hidden rounded-[12px] border bg-white px-[18px] pb-[16px] pt-[14px]"
            style={{ borderColor: redFinanceTheme.colors.stroke }}
          >
            <FinanceSectionHeading title={parsed.scenariosTitle} marginBottom={12} />
            <div className="h-[calc(100%-42px)]">
              <StableMatrixGrid
                rowHeaderLabel={parsed.scenarioColumns.category}
                rowHeaderWidth={tableDensity === "dense" ? 120 : 132}
                rowHeaderAlign="center"
                density={tableDensity}
                headerBackgroundColor="#FAFAFA"
                headerTextColor={redFinanceTheme.colors.primary}
                rowHeaderBackgroundColor="#FCFCFC"
                outerBorderColor={redFinanceTheme.colors.stroke}
                rowDividerColor="#ECECEC"
                stripeColors={["#FFFFFF", "#FAFAFA"]}
                columns={[
                  {
                    id: "mode",
                    label: parsed.scenarioColumns.mode,
                    width: tableDensity === "dense" ? 200 : 224,
                    headerAlign: "center",
                    cellAlign: "center",
                  },
                  {
                    id: "value",
                    label: parsed.scenarioColumns.value,
                    width: "minmax(0, 1fr)",
                    headerAlign: "center",
                    cellAlign: "center",
                  },
                ]}
                rows={parsed.scenarios.map((row, index) => ({
                  id: `${row.category}-${index}`,
                  header: row.category,
                  headerAlign: "center",
                  cells: [
                    {
                      lead: row.mode,
                      align: "center",
                      leadColor: redFinanceTheme.colors.backgroundText,
                      leadWeight: 600,
                    },
                    {
                      lead: row.value,
                      align: "center",
                      leadColor: redFinanceTheme.colors.backgroundText,
                      leadWeight: 500,
                    },
                  ],
                }))}
              />
            </div>
          </div>
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default DigitalRmbArchitectureKpis;
