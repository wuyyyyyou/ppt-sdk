import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";
import { FinanceIcon } from "./shared/icons.js";

const pillarSchema = z.object({
    icon: z.enum(["customer", "pricing", "data", "ecosystem", "talent"]),
    titleLines: z.array(z.string().min(2).max(10)).min(1).max(2),
});

const roadmapPhaseSchema = z.object({
    quarter: z.string().min(2).max(3),
    title: z.string().min(4).max(12),
    items: z.array(z.string().min(8).max(24)).min(3).max(3),
});

const roiMetricSchema = z.object({
    label: z.string().min(2).max(12),
    value: z.string().min(2).max(12),
    caption: z.string().min(4).max(18),
});

const kpiSchema = z.object({
    value: z.string().min(2).max(12),
    label: z.string().min(4).max(16),
});

export const Schema = z.object({
    title: z.string().min(4).max(24).default("战略规划与路线图"),
    metaLabel: z.string().min(6).max(40).default("STRATEGIC ROADMAP"),
    visionLabel: z.string().min(4).max(16).default("2026 战略愿景"),
    visionLines: z.array(z.string().min(2).max(16)).min(3).max(3).default([
        "稳增长 · 提效能",
        "优结构 · 强风控",
        "打造卓越客户体验",
    ]),
    visionStatement: z.string().min(0).max(24).default(""),
    pillarsTitle: z.string().min(4).max(20).default("五大战略支柱"),
    pillars: z.array(pillarSchema).min(5).max(5).default([
        { icon: "customer", titleLines: ["客户与品牌", "重塑"] },
        { icon: "pricing", titleLines: ["产品与定价", "优化"] },
        { icon: "data", titleLines: ["数字与数据", "驱动"] },
        { icon: "ecosystem", titleLines: ["生态与合作", "共赢"] },
        { icon: "talent", titleLines: ["组织与人才", "升级"] },
    ]),
    roadmapTitle: z.string().min(8).max(30).default("2026 执行路线图 (12个月)"),
    roadmapSubtitle: z.string().min(0).max(20).default(""),
    roadmapPhases: z.array(roadmapPhaseSchema).min(4).max(4).default([
        {
            quarter: "Q1",
            title: "基建与治理",
            items: ["启动统一数据湖建设项目", "成立数字化转型委员会", "完成核心系统云化评估"],
        },
        {
            quarter: "Q2",
            title: "试点与上线",
            items: ["发布智能营销 Copilot", "区块链平台 v1.0 上线", "完成 50 家网点改造"],
        },
        {
            quarter: "Q3",
            title: "扩围与优化",
            items: ["全面推广 RPA 自动化", "启动跨境支付实时结算", "发布 ESG 金融产品系列"],
        },
        {
            quarter: "Q4",
            title: "评估与迭代",
            items: ["完成年度战略 ROI 复盘", "优化 AI 风控模型参数", "制定 2027 深化改革方案"],
        },
    ]),
    roiTitle: z.string().min(4).max(20).default("投资与回报预期"),
    roiMetrics: z.array(roiMetricSchema).min(3).max(3).default([
        { label: "预算增幅", value: "15%", caption: "重点投向 AI 算力" },
        { label: "盈亏平衡", value: "18个月", caption: "由效率提升驱动" },
        { label: "三年 ROI", value: "250%", caption: "规模化落地兑现" },
    ]),
    kpiTitle: z.string().min(4).max(20).default("核心 KPI 框架"),
    kpis: z.array(kpiSchema).min(4).max(4).default([
        { value: "+18%", label: "非息收入增长" },
        { value: "< 30%", label: "成本收入比" },
        { value: "1.85%", label: "风险调整收益率" },
        { value: "75%", label: "数字渠道活跃度" },
    ]),
    footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
    pageNumber: z.string().min(2).max(4).default("09"),
});

export const layoutId = "strategic-roadmap";
export const layoutName = "Strategic Roadmap";
export const layoutDescription =
    "A strategic roadmap slide with a fixed vision panel, five pillar cards, a screenshot-safe quarterly roadmap, and ROI/KPI blocks.";
export const layoutTags = ["roadmap", "strategy", "timeline"];
export const layoutRole = "timeline";
export const contentElements = ["timeline", "pillar-cards", "kpi", "roadmap"];
export const useCases = ["strategic-roadmap", "implementation-plan", "execution-plan"];
export const suitableFor =
    "Suitable for phased execution plans, transformation roadmaps, and strategy rollout pages with clear milestones.";
export const avoidFor =
    "Avoid using this layout for simple covers, short agenda pages, or pages that only need one chart or one table.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const SectionHeading = ({
    title,
    subtitle,
}: {
    title: string;
    subtitle?: string;
}) => (
    <div className="mb-[12px] flex items-end justify-between gap-[12px]">
        <div className="flex items-center gap-[10px]">
            <div className="h-[20px] w-[4px] rounded-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
            <h2 className="text-[18px] font-bold leading-none" style={{ color: "var(--background-text,#212121)" }}>
                {title}
            </h2>
        </div>
        {subtitle ? (
            <div className="whitespace-nowrap text-[12px] font-medium leading-none" style={{ color: "#9E9E9E" }}>
                {subtitle}
            </div>
        ) : null}
    </div>
);

const PillarGlyph = ({ name }: { name: z.infer<typeof pillarSchema>["icon"] }) => {
    const className = "h-[18px] w-[18px]";
    const style = { color: "var(--primary-color,#B71C1C)" };

    switch (name) {
        case "customer":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M6.5 18c1-3.2 3.2-4.8 5.5-4.8 2.4 0 4.5 1.6 5.5 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M18 7h2M19 6v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "pricing":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M6.5 7.5h7.8l3.2 3.2-6.9 6.8-6.1-6.1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <circle cx="10.1" cy="10.1" r="1.2" fill="currentColor" stroke="none" />
                </svg>
            );
        case "data":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <ellipse cx="12" cy="6.8" rx="5.8" ry="2.8" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M6.2 6.8v5.2c0 1.6 2.6 2.8 5.8 2.8s5.8-1.2 5.8-2.8V6.8M6.2 12v5.2c0 1.6 2.6 2.8 5.8 2.8s5.8-1.2 5.8-2.8V12" stroke="currentColor" strokeWidth="1.8" />
                </svg>
            );
        case "ecosystem":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <circle cx="6.5" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="17.5" cy="7.2" r="2.2" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="17.5" cy="16.8" r="2.2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8.5 11.2 15.3 8M8.5 12.8l6.8 3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "talent":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M12 5 5 8.5 12 12l7-3.5ZM8 10.5V14c0 1.8 1.8 3.2 4 3.2s4-1.4 4-3.2v-3.5M19 9.5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        default:
            return null;
    }
};

const StrategicRoadmap = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const parsed = Schema.parse(data ?? {});

    return (
        <RedFinanceCanvas>
            <div className="relative z-10 flex h-full flex-col">
                <div className="mx-[60px] flex items-end justify-between pb-[10px] pt-[30px]">
                    <div className="flex items-center gap-[15px]">
                        <div className="h-[36px] w-[6px] rounded-[2px]" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                        <h1 className="text-[36px] font-black tracking-[-0.02em]" style={{ color: "var(--background-text,#212121)" }}>
                            {parsed.title}
                        </h1>
                    </div>
                    <div className="flex items-center gap-[10px] whitespace-nowrap text-[14px] font-medium" style={{ color: "var(--text-muted,#616161)" }}>
                        <FinanceIcon name="route" className="h-[18px] w-[18px]" color="var(--primary-color,#B71C1C)" />
                        <span>{parsed.metaLabel}</span>
                    </div>
                </div>

                <div className="mx-[60px] mb-[16px] flex-none">
                    <div className="h-[2px] w-full rounded-full" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />
                </div>

                <div className="flex flex-1 flex-col gap-[16px] px-[60px] pb-[20px]">
                    <div className="flex h-[138px] gap-[16px]">
                        <div
                            className="flex w-[310px] flex-none flex-col justify-center rounded-[12px] px-[22px] py-[18px]"
                            style={{
                                backgroundColor: "var(--primary-color,#B71C1C)",
                                boxShadow: "0 8px 18px rgba(183,28,28,0.18)",
                            }}
                        >
                            <div>
                                <div className="mb-[10px] text-[13px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.88)" }}>
                                    {parsed.visionLabel}
                                </div>
                                <div className="flex flex-col gap-[6px]">
                                    {parsed.visionLines.map((line) => (
                                        <div key={line} className="text-[22px] font-black leading-[1.12]" style={{ color: "#FFFFFF" }}>
                                            {line}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div
                            className="flex flex-1 items-center rounded-[12px] border px-[16px] py-[16px]"
                            style={{ backgroundColor: "#FAFAFA", borderColor: "var(--stroke,#EEEEEE)" }}
                        >
                            <div className="grid h-full w-full grid-cols-5 gap-[10px]">
                                {parsed.pillars.map((pillar) => (
                                    <div
                                        key={`${pillar.icon}-${pillar.titleLines.join("-")}`}
                                        className="flex h-full flex-col items-center justify-center rounded-[8px] border px-[10px] py-[12px] text-center"
                                        style={{
                                            backgroundColor: "var(--background-color,#FFFFFF)",
                                            borderColor: "var(--stroke,#EEEEEE)",
                                        }}
                                    >
                                        <div
                                            className="mb-[10px] flex h-[36px] w-[36px] items-center justify-center rounded-full"
                                            style={{ backgroundColor: "#FFEBEE" }}
                                        >
                                            <PillarGlyph name={pillar.icon} />
                                        </div>
                                        <div className="flex flex-col gap-[2px]">
                                            {pillar.titleLines.map((line) => (
                                                <div
                                                    key={line}
                                                    className="whitespace-nowrap text-[12px] font-bold leading-[1.1]"
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

                    <div className="flex h-[270px] flex-col">
                        <SectionHeading title={parsed.roadmapTitle} />
                        <div
                            className="relative flex flex-1 flex-col rounded-[12px] border px-[18px] py-[16px]"
                            style={{
                                backgroundColor: "var(--background-color,#FFFFFF)",
                                borderColor: "var(--stroke,#EEEEEE)",
                                boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
                            }}
                        >
                            <div className="relative flex flex-1 gap-[14px] pt-[6px]">
                                <div className="absolute left-[56px] right-[56px] top-[20px] h-[2px] rounded-full" style={{ backgroundColor: "#E0E0E0" }} />
                                {parsed.roadmapPhases.map((phase) => (
                                    <div
                                        key={phase.quarter}
                                        className="relative z-10 flex flex-1 flex-col rounded-[10px] border px-[14px] pb-[14px] pt-[12px]"
                                        style={{
                                            backgroundColor: "#FFFFFF",
                                            borderColor: "var(--stroke,#EEEEEE)",
                                            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                                        }}
                                    >
                                        <div
                                            className="mb-[10px] flex h-[34px] w-[34px] items-center justify-center rounded-full text-[14px] font-black"
                                            style={{
                                                backgroundColor: "var(--primary-color,#B71C1C)",
                                                color: "#FFFFFF",
                                                boxShadow: "0 3px 6px rgba(183,28,28,0.2)",
                                            }}
                                        >
                                            {phase.quarter}
                                        </div>
                                        <div className="mb-[8px] text-[15px] font-bold leading-[1.2]" style={{ color: "var(--background-text,#212121)" }}>
                                            {phase.title}
                                        </div>
                                        <div className="flex flex-1 flex-col gap-[7px]">
                                            {phase.items.map((item) => (
                                                <div key={item} className="flex items-start gap-[8px]">
                                                    <div className="mt-[5px] h-[5px] w-[5px] flex-none rounded-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                                                    <div className="text-[12px] leading-[1.35]" style={{ color: "var(--text-muted,#616161)" }}>
                                                        {item}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex h-[118px] gap-[18px]">
                        <div
                            className="flex w-[350px] flex-none flex-col rounded-[12px] border px-[16px] py-[14px]"
                            style={{ backgroundColor: "#FAFAFA", borderColor: "var(--stroke,#EEEEEE)" }}
                        >
                            <div className="mb-[10px] flex items-center gap-[10px]">
                                <div className="h-[16px] w-[4px] rounded-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                                <div className="text-[15px] font-bold leading-none" style={{ color: "var(--background-text,#212121)" }}>
                                    {parsed.roiTitle}
                                </div>
                            </div>
                            <div className="flex flex-1 items-stretch justify-between gap-[10px]">
                                {parsed.roiMetrics.map((metric, index) => (
                                    <div key={metric.label} className="flex flex-1 items-stretch gap-[10px]">
                                        <div className="flex flex-1 flex-col justify-center">
                                            <div className="mb-[4px] text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: "#9E9E9E" }}>
                                                {metric.label}
                                            </div>
                                            <div className="mb-[2px] whitespace-nowrap text-[20px] font-black leading-none" style={{ color: "var(--primary-color,#B71C1C)" }}>
                                                {metric.value}
                                            </div>
                                            <div className="text-[11px] leading-[1.25]" style={{ color: "var(--text-muted,#616161)" }}>
                                                {metric.caption}
                                            </div>
                                        </div>
                                        {index < parsed.roiMetrics.length - 1 ? (
                                            <div className="w-px flex-none self-stretch rounded-full" style={{ backgroundColor: "#E5E5E5" }} />
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div
                            className="flex flex-1 flex-col rounded-[12px] border px-[16px] py-[14px]"
                            style={{ backgroundColor: "#FAFAFA", borderColor: "var(--stroke,#EEEEEE)" }}
                        >
                            <div className="mb-[10px] flex items-center gap-[10px]">
                                <div className="h-[16px] w-[4px] rounded-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                                <div className="text-[15px] font-bold leading-none" style={{ color: "var(--background-text,#212121)" }}>
                                    {parsed.kpiTitle}
                                </div>
                            </div>
                            <div className="grid flex-1 grid-cols-4 gap-[12px]">
                                {parsed.kpis.map((item) => (
                                    <div
                                        key={item.label}
                                        className="flex h-full flex-col items-center justify-center rounded-[8px] border px-[8px] py-[10px] text-center"
                                        style={{
                                            backgroundColor: "#FFFFFF",
                                            borderColor: "var(--stroke,#EEEEEE)",
                                        }}
                                    >
                                        <div className="mb-[4px] whitespace-nowrap text-[18px] font-black leading-none" style={{ color: "var(--primary-color,#B71C1C)" }}>
                                            {item.value}
                                        </div>
                                        <div className="text-[11px] leading-[1.25]" style={{ color: "var(--text-muted,#616161)" }}>
                                            {item.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mx-[60px] h-px" style={{ backgroundColor: "#F5F5F5" }} />

                <div
                    className="flex h-[40px] items-center justify-between px-[60px] text-[12px]"
                    style={{ color: "#9E9E9E", backgroundColor: "var(--background-color,#FFFFFF)" }}
                >
                    <p>{parsed.footerText}</p>
                    <p className="w-[28px] whitespace-nowrap text-right font-bold" style={{ color: "var(--primary-color,#B71C1C)" }}>
                        {parsed.pageNumber}
                    </p>
                </div>
            </div>
        </RedFinanceCanvas>
    );
};

export default StrategicRoadmap;
