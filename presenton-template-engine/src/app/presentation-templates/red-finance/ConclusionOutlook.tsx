import type { ReactNode } from "react";
import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";
import { FinanceIcon } from "./shared/icons.js";

const conclusionCardSchema = z.object({
    icon: z.enum(["chart-line", "microchip", "shield-alt"]),
    title: z.string().min(4).max(18),
    description: z.string().min(18).max(96),
});

const priorityItemSchema = z.object({
    title: z.string().min(4).max(24),
    description: z.string().min(12).max(72),
});

const successFactorSchema = z.object({
    icon: z.enum(["leadership", "platform", "talent"]),
    titleLines: z.array(z.string().min(2).max(12)).min(2).max(2),
});

const nextStepSchema = z.object({
    action: z.string().min(8).max(28),
    timing: z.string().min(3).max(10),
});

export const Schema = z.object({
    title: z.string().min(4).max(24).default("总结与展望"),
    metaLabel: z.string().min(6).max(40).default("CONCLUSION & OUTLOOK"),
    conclusions: z.array(conclusionCardSchema).min(3).max(3).default([
        {
            icon: "chart-line",
            title: "非息驱动增强",
            description:
                "盈利模式正从传统息差依赖转向多元化收入结构，财富管理、资产托管与投行业务的协同，将持续抬升轻资本业务贡献。",
        },
        {
            icon: "microchip",
            title: "数字能力为底座",
            description:
                "数据治理与 AI 基础设施已从 IT 投入升级为增长引擎，全行级数据湖与智能中台将支撑精细运营和敏捷创新。",
        },
        {
            icon: "shield-alt",
            title: "风控与合规并重",
            description:
                "在创新提速的同时，需要同步强化网络安全、模型风险与跨境合规能力，构建主动型、智能化的全面风险管理体系。",
        },
    ]),
    prioritiesTitle: z.string().min(4).max(28).default("未来12个月优先事项"),
    prioritiesTag: z.string().min(4).max(16).default("Priorities"),
    priorities: z.array(priorityItemSchema).min(3).max(3).default([
        {
            title: "数据治理攻坚战",
            description: "完成主数据标准统一，消除核心系统之间的数据孤岛，夯实经营分析与风控建模底座。",
        },
        {
            title: "AI场景规模化落地",
            description: "聚焦智能客服、信贷审批辅助与营销 Copilot 三个场景，形成可复制的规模化交付路径。",
        },
        {
            title: "大财富管理体系构建",
            description: "整合私行与投行资源，面向高净值客户推出定制化全权委托与综合资产配置服务。",
        },
    ]),
    successFactorsTitle: z.string().min(4).max(28).default("关键成功要素"),
    successFactorsTag: z.string().min(6).max(24).default("Key Success Factors"),
    successFactors: z.array(successFactorSchema).min(3).max(3).default([
        { icon: "leadership", titleLines: ["一把手工程", "顶层推动"] },
        { icon: "platform", titleLines: ["数据与IT", "治理能力"] },
        { icon: "talent", titleLines: ["敏捷组织", "与人才"] },
    ]),
    nextStepsTitle: z.string().min(4).max(20).default("后续动作"),
    nextStepsTag: z.string().min(4).max(16).default("Next Steps"),
    nextSteps: z.array(nextStepSchema).min(3).max(3).default([
        { action: "明确首批数字化试点项目清单", timing: "T+1月" },
        { action: "确立季度关键里程碑与 KPI", timing: "T+2月" },
        { action: "建立战略执行闭环复盘机制", timing: "T+3月" },
    ]),
    footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
    pageNumber: z.string().min(2).max(4).default("10"),
});

export const layoutId = "conclusion-outlook";
export const layoutName = "Conclusion Outlook";
export const layoutDescription =
    "A conclusion slide with three summary cards, editable priority and success-factor modules, and a fixed next-step action bar.";
export const layoutTags = ["conclusion", "summary", "next-steps"];
export const layoutRole = "conclusion";
export const contentElements = ["summary-cards", "priority-list", "next-steps"];
export const useCases = ["conclusion", "executive-summary", "next-steps"];
export const suitableFor =
    "Suitable for closing sections that need summary takeaways, priority actions, and a clear next-step message.";
export const avoidFor =
    "Avoid using this layout for detailed data analysis, agendas, or multi-stage process explanations.";
export const density = "medium";
export const visualWeight = "text-heavy";
export const editableTextPriority = "high";

const BlockDivider = ({
    color,
    segments = 18,
    height = 2,
    gap = 4,
}: {
    color: string;
    segments?: number;
    height?: number;
    gap?: number;
}) => (
    <div className="flex w-full" style={{ gap: `${gap}px` }}>
        {Array.from({ length: segments }).map((_, index) => (
            <div
                key={index}
                className="flex-1 rounded-full"
                style={{
                    height: `${height}px`,
                    backgroundColor: color,
                }}
            />
        ))}
    </div>
);

const SectionHeading = ({
    title,
    tag,
    icon,
}: {
    title: string;
    tag?: string;
    icon: ReactNode;
}) => (
    <div className="mb-[14px]">
        <div className="flex items-center justify-between gap-[12px]">
            <div className="flex items-center gap-[10px]">
                <div
                    className="flex h-[32px] w-[32px] flex-none items-center justify-center rounded-[10px]"
                    style={{ backgroundColor: "#FFEBEE", color: "var(--primary-color,#B71C1C)" }}
                >
                    {icon}
                </div>
                <h2 className="text-[16px] font-bold leading-none" style={{ color: "var(--background-text,#212121)" }}>
                    {title}
                </h2>
            </div>
            {tag ? (
                <div className="whitespace-nowrap text-[12px] font-medium leading-none" style={{ color: "#9E9E9E" }}>
                    {tag}
                </div>
            ) : null}
        </div>
        <div className="mt-[10px]">
            <BlockDivider color="#E2E2E2" segments={18} height={2} gap={4} />
        </div>
    </div>
);

const CalendarIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none">
        <rect x="4.5" y="6.5" width="15" height="13" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 4.5v4M16 4.5v4M4.5 10h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8.2 13h2.2M13.6 13h2.2M8.2 16.2h2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);

const KeyIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none">
        <circle cx="8.2" cy="13.2" r="3.2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M11.2 13.2H20M16.5 13.2v-2.5M19 13.2v-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);

const ChevronIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[12px] w-[12px]" fill="none">
        <path d="m8 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const SuccessFactorIcon = ({ name }: { name: z.infer<typeof successFactorSchema>["icon"] }) => {
    const className = "h-[22px] w-[22px]";

    switch (name) {
        case "leadership":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
                    <path d="M8.8 8.5h6.4M12 4.5v3M6.5 20h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M8.2 8.5v3.1a3.8 3.8 0 0 0 7.6 0V8.5M9.5 16.2h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7.2 8.5h9.6L15.5 5H8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
            );
        case "platform":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
                    <rect x="7" y="7" width="10" height="10" rx="1.8" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M9.5 3v3M14.5 3v3M9.5 18v3M14.5 18v3M18 9.5h3M18 14.5h3M3 9.5h3M3 14.5h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M10 10h4v4h-4z" fill="currentColor" stroke="none" />
                </svg>
            );
        case "talent":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
                    <circle cx="8" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="16" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M4.8 18c.9-2.5 2.5-3.8 4.8-3.8 2.3 0 3.9 1.3 4.8 3.8M10.4 18c.8-2.1 2.2-3.2 4.2-3.2s3.4 1.1 4.2 3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        default:
            return null;
    }
};

const ConclusionOutlook = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const parsed = Schema.parse(data ?? {});

    return (
        <RedFinanceCanvas>
            <div className="relative z-10 h-full">
                <div className="absolute left-[60px] right-[60px] top-[30px] flex items-end justify-between pb-[10px]">
                    <div className="flex items-center gap-[15px]">
                        <div className="h-[36px] w-[6px] rounded-[2px]" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                        <h1 className="text-[36px] font-black tracking-[-0.02em]" style={{ color: "var(--background-text,#212121)" }}>
                            {parsed.title}
                        </h1>
                    </div>
                    <div className="flex items-center gap-[10px] whitespace-nowrap text-[14px] font-medium" style={{ color: "var(--text-muted,#616161)" }}>
                        <FinanceIcon name="flag-checkered" className="h-[18px] w-[18px]" color="var(--primary-color,#B71C1C)" />
                        <span>{parsed.metaLabel}</span>
                    </div>
                </div>

                <div className="absolute left-[60px] right-[60px] top-[101px] h-[2px] rounded-full" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />

                <div className="absolute left-[60px] right-[60px] bottom-[40px] top-[122px] flex flex-col gap-[16px]">
                    <div className="flex h-[192px] gap-[18px]">
                        {parsed.conclusions.map((item) => (
                            <div
                                key={item.title}
                                className="relative flex flex-1 flex-col overflow-hidden rounded-[10px] border px-[22px] pb-[18px] pt-[22px]"
                                style={{
                                    backgroundColor: "#FFFFFF",
                                    borderColor: "var(--stroke,#EEEEEE)",
                                    boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
                                }}
                            >
                                <div className="absolute left-0 right-0 top-0 h-[5px]" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                                <div
                                    className="mb-[14px] flex h-[46px] w-[46px] items-center justify-center rounded-full"
                                    style={{ backgroundColor: "#FFEBEE", color: "var(--primary-color,#B71C1C)" }}
                                >
                                    <FinanceIcon name={item.icon} className="h-[22px] w-[22px]" color="currentColor" />
                                </div>
                                <h2 className="mb-[10px] text-[18px] font-bold leading-[1.2]" style={{ color: "var(--background-text,#212121)" }}>
                                    {item.title}
                                </h2>
                                <div className="flex-1 text-[13px] leading-[1.52]" style={{ color: "var(--text-muted,#616161)" }}>
                                    {item.description}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex h-[240px] gap-[24px]">
                        <div
                            className="flex h-full w-[642px] flex-none flex-col rounded-[10px] border px-[20px] py-[18px]"
                            style={{
                                backgroundColor: "#FAFAFA",
                                borderColor: "var(--stroke,#EEEEEE)",
                            }}
                        >
                            <SectionHeading title={parsed.prioritiesTitle} tag={parsed.prioritiesTag} icon={<CalendarIcon />} />
                            <div className="flex flex-1 flex-col justify-between">
                                {parsed.priorities.map((item) => (
                                    <div key={item.title} className="flex items-start gap-[12px] rounded-[8px] px-[4px] py-[2px]">
                                        <div
                                            className="mt-[2px] flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full"
                                            style={{ backgroundColor: "#FFEBEE", color: "var(--primary-color,#B71C1C)" }}
                                        >
                                            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[12px] w-[12px]" fill="none">
                                                <path d="m6.8 12.3 3.2 3.1 7.2-7.4" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-[3px] text-[14px] font-bold leading-[1.25]" style={{ color: "var(--background-text,#212121)" }}>
                                                {item.title}
                                            </div>
                                            <div className="text-[12px] leading-[1.45]" style={{ color: "var(--text-muted,#616161)" }}>
                                                {item.description}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div
                            className="flex min-w-0 flex-1 flex-col rounded-[10px] border px-[20px] py-[18px]"
                            style={{
                                backgroundColor: "#FAFAFA",
                                borderColor: "var(--stroke,#EEEEEE)",
                            }}
                        >
                            <SectionHeading title={parsed.successFactorsTitle} tag={parsed.successFactorsTag} icon={<KeyIcon />} />
                            <div className="grid flex-1 grid-cols-3 gap-[12px]">
                                {parsed.successFactors.map((item) => (
                                    <div
                                        key={`${item.icon}-${item.titleLines.join("-")}`}
                                        className="flex h-full flex-col items-center justify-center rounded-[8px] border px-[10px] py-[14px] text-center"
                                        style={{
                                            backgroundColor: "#FFFFFF",
                                            borderColor: "var(--stroke,#EEEEEE)",
                                        }}
                                    >
                                        <div
                                            className="mb-[12px] flex h-[44px] w-[44px] items-center justify-center rounded-[12px]"
                                            style={{ backgroundColor: "#FFEBEE", color: "#D84343" }}
                                        >
                                            <SuccessFactorIcon name={item.icon} />
                                        </div>
                                        <div className="flex flex-col gap-[2px]">
                                            {item.titleLines.map((line) => (
                                                <div
                                                    key={line}
                                                    className="whitespace-nowrap text-[13px] font-bold leading-[1.15]"
                                                    style={{ color: "var(--background-text,#212121)" }}
                                                >
                                                    {line}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div
                        className="relative flex h-[95px] items-center gap-[18px] overflow-hidden rounded-[12px] px-[24px] py-[16px]"
                        style={{
                            backgroundColor: "#2F2F2F",
                            boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
                        }}
                    >
                        <div
                            className="absolute left-0 top-0 h-full w-[8px]"
                            style={{ backgroundColor: "var(--primary-color,#B71C1C)" }}
                        />
                        <div className="w-[186px] flex-none pl-[6px]">
                            <div className="mb-[4px] text-[12px] font-bold uppercase tracking-[0.12em]" style={{ color: "#F29A9A" }}>
                                {parsed.nextStepsTag}
                            </div>
                            <div className="text-[20px] font-bold leading-none" style={{ color: "#FFFFFF" }}>
                                {parsed.nextStepsTitle}
                            </div>
                        </div>

                        <div className="flex min-w-0 flex-1 gap-[12px]">
                            {parsed.nextSteps.map((item) => (
                                <div
                                    key={`${item.action}-${item.timing}`}
                                    className="flex min-w-0 flex-1 items-center gap-[10px] rounded-[10px] px-[12px] py-[12px]"
                                    style={{ backgroundColor: "rgba(255,255,255,0.07)" }}
                                >
                                    <div
                                        className="flex h-[24px] w-[24px] flex-none items-center justify-center rounded-full"
                                        style={{ backgroundColor: "#5A1D1D", color: "#EF5350" }}
                                    >
                                        <ChevronIcon />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[13px] font-medium leading-[1.3]" style={{ color: "#FFFFFF" }}>
                                            {item.action}
                                        </div>
                                        <div className="mt-[5px]">
                                            <div
                                                className="inline-flex min-w-[56px] items-center justify-center rounded-full px-[8px] py-[3px] text-[11px] font-bold leading-none"
                                                style={{ backgroundColor: "rgba(239,83,80,0.16)", color: "#FFB2B0" }}
                                            >
                                                {item.timing}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div
                    className="absolute bottom-0 left-0 right-0 flex h-[40px] items-center justify-between px-[60px] text-[12px]"
                    style={{ color: "#9E9E9E", backgroundColor: "var(--background-color,#FFFFFF)" }}
                >
                    <div className="absolute left-[60px] right-[60px] top-0 h-[2px]" style={{ backgroundColor: "#F5F5F5" }} />
                    <p>{parsed.footerText}</p>
                    <p className="w-[28px] whitespace-nowrap text-right font-bold" style={{ color: "var(--primary-color,#B71C1C)" }}>
                        {parsed.pageNumber}
                    </p>
                </div>
            </div>
        </RedFinanceCanvas>
    );
};

export default ConclusionOutlook;
