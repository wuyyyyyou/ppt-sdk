import React from "react";
import * as z from "zod";

import InnovationApplicationCard from "../components/InnovationApplicationCard.js";
import FinanceContentFrame from "../components/FinanceContentFrame.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import { redFinanceTheme } from "../theme/tokens.js";

const innovationIconSchema = z.enum([
  "wallet",
  "brain",
  "architecture",
  "regtech",
  "security",
]);

const innovationItemSchema = z.object({
  icon: innovationIconSchema,
  title: z.string().min(2).max(36),
  tag: z.string().min(2).max(24),
  description: z.string().min(12).max(140),
});

export const Schema = z.object({
  title: z.string().min(2).max(30).default("金融科技创新与应用"),
  metaLabel: z.string().min(2).max(40).default("FINTECH INNOVATION"),
  visualTitle: z.string().min(2).max(30).default("技术驱动金融重构"),
  visualDescription: z
    .string()
    .min(12)
    .max(180)
    .default(
      "以人工智能、大数据、云计算为核心的新技术集群，正在重塑金融服务的基础设施与交互模式，推动行业向智能化、开放化演进。",
    ),
  innovations: z.array(innovationItemSchema).min(3).max(6).default([
    {
      icon: "wallet",
      title: "支付与嵌入式金融",
      tag: "Infrastructure",
      description:
        "推动实时支付网络建设，将信贷、保险等金融服务嵌入电商、物流等非金融场景，实现“金融即服务”能力输出。",
    },
    {
      icon: "brain",
      title: "GenAI 应用",
      tag: "AI / LLM",
      description:
        "部署金融垂类大模型，支撑客户经营 Copilot、投研报告生成与自动化合规审单，显著提升人效与响应速度。",
    },
    {
      icon: "architecture",
      title: "开放架构",
      tag: "Architecture",
      description:
        "从传统单体系统转向云原生与微服务架构，通过标准化 API 治理实现跨机构协同与业务敏捷迭代。",
    },
    {
      icon: "regtech",
      title: "RegTech 与合规",
      tag: "Risk Mgmt",
      description:
        "结合知识图谱与 NLP，提升 KYC、AML 与模型监控的自动化水平，满足穿透式监管与可解释要求。",
    },
    {
      icon: "security",
      title: "安全与隐私",
      tag: "Security",
      description:
        "建设零信任安全架构，结合联邦学习与多方安全计算，在保障数据隐私前提下释放数据协同价值。",
    },
  ]),
  footerText: z.string().min(4).max(120).default("金融行业战略分析报告 | 绝密资料"),
  pageNumber: z.string().min(1).max(6).default("06"),
});

export const layoutId = "fintech-innovation-applications";
export const layoutName = "Fintech Innovation Applications";
export const layoutDescription =
  "A component-oriented fintech innovation slide with a concept panel on the left and a flexible stack of application cards on the right.";
export const layoutTags = ["fintech", "innovation", "card-list", "componentized"];
export const layoutRole = "content";
export const contentElements = ["concept-panel", "application-cards"];
export const useCases = ["fintech-innovation", "technology-application", "capability-landscape"];
export const suitableFor =
  "Suitable for slides that explain how several technology themes translate into concrete business applications.";
export const avoidFor =
  "Avoid using this layout for heavy quantitative comparisons, detailed process flows, or narrative pages with long paragraphs.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const svgDataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const createFintechCoreSvg = () => `
  <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
    <circle cx="120" cy="120" r="100" fill="none" stroke="#EEE2E2" stroke-width="2"/>
    <circle cx="120" cy="120" r="72" fill="none" stroke="#DCC4C4" stroke-width="2"/>
    <circle cx="120" cy="128" r="48" fill="#B71C1C" opacity="0.16"/>
    <circle cx="120" cy="120" r="48" fill="#B71C1C"/>
    <g fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="104" y="104" width="32" height="32" rx="4"/>
      <path d="M110 96v8M120 96v8M130 96v8M110 136v8M120 136v8M130 136v8M96 110h8M96 120h8M96 130h8M136 110h8M136 120h8M136 130h8"/>
    </g>
    <g>
      <circle cx="120" cy="48" r="20" fill="#FFFFFF" stroke="#B71C1C" stroke-width="2"/>
      <path d="M106 52h28c0-6-4.4-11-10.6-11-2.6 0-4.5 1-6 2.7-1.1-.8-2.6-1.3-4.1-1.3-3.7 0-6.7 2.7-7.3 6.2-.9.4-1.5 1.3-1.5 2.4 0 1.5 1.2 2.7 2.7 2.7Z" fill="none" stroke="#B71C1C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <g>
      <circle cx="187" cy="168" r="20" fill="#FFFFFF" stroke="#B71C1C" stroke-width="2"/>
      <path d="M181 166v-4.8c0-3.4 2.7-6.2 6-6.2s6 2.8 6 6.2v4.8M178.5 166h17v12.5h-17Z" fill="none" stroke="#B71C1C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <g>
      <circle cx="53" cy="168" r="20" fill="#FFFFFF" stroke="#B71C1C" stroke-width="2"/>
      <rect x="45" y="156" width="16" height="24" rx="3" fill="none" stroke="#B71C1C" stroke-width="1.8"/>
      <path d="M50 161h6M48.8 175h8.4" fill="none" stroke="#B71C1C" stroke-width="1.8" stroke-linecap="round"/>
    </g>
    <g fill="#B71C1C">
      <circle cx="120" cy="20" r="4"/>
      <circle cx="208" cy="184" r="4"/>
      <circle cx="32" cy="184" r="4"/>
    </g>
  </svg>
`;

const FintechInnovationApplications = ({
  data,
}: {
  data: Partial<z.infer<typeof Schema>>;
}) => {
  const parsed = Schema.parse(data ?? {});
  const coreGraphicUri = svgDataUri(createFintechCoreSvg());
  const innovationCount = parsed.innovations.length;
  const cardDensity =
    innovationCount >= 6 ? "dense" : innovationCount >= 5 ? "compact" : "normal";
  const cardGap = innovationCount >= 6 ? 10 : innovationCount >= 5 ? 12 : 16;

  return (
    <FinanceContentFrame
      title={parsed.title}
      titleAccent="left"
      metaIcon={<FinanceIcon name="microchip" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={154}
      contentHeight={516}
    >
      <div className="flex h-full gap-[28px] overflow-hidden">
        <div className="flex w-[362px] flex-none">
          <div
            className="flex h-full w-full flex-col items-center justify-center rounded-[8px] border px-[24px] py-[24px]"
            style={{
              borderColor: redFinanceTheme.colors.stroke,
              backgroundColor: "#FAFAFA",
              boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
            }}
          >
            <div
              className="mb-[20px] flex h-[248px] w-[248px] items-center justify-center rounded-[18px]"
              style={{ backgroundColor: "#F7F2F2" }}
            >
              <img src={coreGraphicUri} alt="" className="h-[228px] w-[228px]" />
            </div>
            <h2
              className="text-[22px] font-bold leading-[1.2]"
              style={{ color: redFinanceTheme.colors.backgroundText }}
            >
              {parsed.visualTitle}
            </h2>
            <p
              className="mt-[10px] text-center text-[14px] leading-[1.6]"
              style={{ color: redFinanceTheme.colors.mutedText }}
            >
              {parsed.visualDescription}
            </p>
          </div>
        </div>

        <div
          className="flex min-w-0 flex-1 flex-col justify-center"
          style={{ gap: `${cardGap}px` }}
        >
          {parsed.innovations.map((item, index) => (
            <InnovationApplicationCard
              key={`${item.title}-${index}`}
              icon={item.icon}
              title={item.title}
              tag={item.tag}
              description={item.description}
              density={cardDensity}
            />
          ))}
        </div>
      </div>
    </FinanceContentFrame>
  );
};

export default FintechInnovationApplications;
