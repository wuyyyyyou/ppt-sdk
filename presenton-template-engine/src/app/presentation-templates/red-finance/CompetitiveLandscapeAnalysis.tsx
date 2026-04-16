import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";
import { FinanceIcon } from "./shared/icons.js";

const participantSchema = z.object({
    icon: z.enum(["traditional", "internet", "fintech", "global"]),
    title: z.string().min(4).max(24),
    description: z.string().min(6).max(28),
});

const forceSchema = z.object({
    icon: z.enum(["rivalry", "substitute", "customer", "entrant"]),
    title: z.string().min(2).max(16),
    level: z.enum(["高", "中"]),
    description: z.string().min(10).max(36),
});

const comparisonRowSchema = z.object({
    dimension: z.string().min(2).max(12),
    traditionalLead: z.string().min(6).max(28),
    traditionalSupport: z.string().min(4).max(24),
    techLead: z.string().min(6).max(28),
    techSupport: z.string().min(4).max(24),
    winningLead: z.string().min(6).max(28),
    winningSupport: z.string().min(6).max(28),
});

export const Schema = z.object({
    title: z.string().min(4).max(24).default("竞争格局分析"),
    metaLabel: z.string().min(4).max(40).default("COMPETITIVE LANDSCAPE"),
    participantsTitle: z.string().min(4).max(24).default("主要市场参与者"),
    participants: z.array(participantSchema).min(4).max(4).default([
        { icon: "traditional", title: "传统银行/保险", description: "牌照/资本/网点优势" },
        { icon: "internet", title: "互联网巨头", description: "流量/场景/体验优势" },
        { icon: "fintech", title: "FinTech 公司", description: "垂直领域技术创新" },
        { icon: "global", title: "外资金融机构", description: "跨境/高端财富管理" },
    ]),
    forcesTitle: z.string().min(4).max(24).default("波特五力分析"),
    forces: z.array(forceSchema).min(4).max(4).default([
        { icon: "rivalry", title: "同业竞争", level: "高", description: "存量博弈加剧，息差收窄，产品同质化严重。" },
        { icon: "substitute", title: "替代品威胁", level: "高", description: "第三方支付、网络理财分流传统渠道流量。" },
        { icon: "customer", title: "客户议价能力", level: "高", description: "信息透明度提升，客户转换成本降低。" },
        { icon: "entrant", title: "潜在进入者", level: "中", description: "牌照监管壁垒高，但技术与场景渗透增强。" },
    ]),
    comparisonTitle: z.string().min(8).max(36).default("竞争焦点与差异化路径对比"),
    columns: z
        .object({
            dimension: z.string().min(2).max(12).default("竞争维度"),
            traditional: z.string().min(4).max(18).default("传统金融机构"),
            tech: z.string().min(6).max(18).default("互联网/科技巨头"),
            winning: z.string().min(6).max(18).default("差异化制胜路径"),
        })
        .default({
            dimension: "竞争维度",
            traditional: "传统金融机构",
            tech: "互联网/科技巨头",
            winning: "差异化制胜路径",
        }),
    comparisonRows: z.array(comparisonRowSchema).min(4).max(4).default([
        {
            dimension: "客户获取",
            traditionalLead: "依赖线下网点与存量转化",
            traditionalSupport: "获客成本高，增长放缓",
            techLead: "高频生活场景流量变现",
            techSupport: "流量垄断，获客成本低",
            winningLead: "公私联动与场景嵌入",
            winningSupport: "深耕 B 端产业链，批量获取 C 端",
        },
        {
            dimension: "产品创新",
            traditionalLead: "标准化、严监管产品为主",
            traditionalSupport: "迭代周期长，信誉度高",
            techLead: "碎片化、定制化理财/信贷",
            techSupport: "迭代快，聚焦长尾需求",
            winningLead: "综合金融与财富管理",
            winningSupport: "投行、商行、私行的一体化服务",
        },
        {
            dimension: "风险控制",
            traditionalLead: "抵押担保，强资本约束",
            traditionalSupport: "风控严谨，覆盖面有限",
            techLead: "大数据信用风控",
            techSupport: "数据驱动，信用下沉",
            winningLead: "智能风控与周期管理",
            winningSupport: "AI 模型与专家经验的混合模式",
        },
        {
            dimension: "服务体验",
            traditionalLead: "低频、严肃、流程繁琐",
            traditionalSupport: "人际信任感强",
            techLead: "高频、极致便捷、交互强",
            techSupport: "缺乏深度咨询服务",
            winningLead: "全渠道与有温度的智能",
            winningSupport: "线上便捷交易，线下复杂咨询",
        },
    ]),
    footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
    pageNumber: z.string().min(2).max(4).default("07"),
});

export const layoutId = "competitive-landscape-analysis";
export const layoutName = "Competitive Landscape Analysis";
export const layoutDescription = "A competitive landscape slide with participant mapping, Porter five forces, and a four-column comparison matrix.";

const SectionHeading = ({ title }: { title: string }) => (
    <div className="mb-[12px] flex items-center gap-[10px]">
        <div className="h-[22px] w-[4px] rounded-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
        <h2 className="text-[18px] font-bold" style={{ color: "var(--background-text,#212121)" }}>
            {title}
        </h2>
    </div>
);

const ParticipantIcon = ({ name }: { name: z.infer<typeof participantSchema>["icon"] }) => {
    const className = "h-6 w-6";
    const style = { color: "var(--primary-color,#B71C1C)" };

    switch (name) {
        case "traditional":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M4 9.5 12 5l8 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6.5 10.5v6.5M10 10.5v6.5M14 10.5v6.5M17.5 10.5v6.5M4.5 19h15M3.5 8.8h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "internet":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <rect x="7" y="4.5" width="10" height="15" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M10 7.5h4M10 16.5h4M12 14.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "fintech":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M8 6.5h3.5v3.5H8zM12.5 14h3.5v3.5h-3.5zM8 14h3.5v3.5H8zM12.5 6.5h3.5v3.5h-3.5z" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M11.5 8.2h1M11.5 15.8h1M9.8 10v4M14.2 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "global":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M4.5 12h15M12 4a13 13 0 0 1 0 16M12 4a13 13 0 0 0 0 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        default:
            return null;
    }
};

const ForceIcon = ({ name }: { name: z.infer<typeof forceSchema>["icon"] }) => {
    const className = "h-[18px] w-[18px]";
    const style = { color: "var(--primary-color,#B71C1C)" };

    switch (name) {
        case "rivalry":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <circle cx="8" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="16" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M4.5 18c.9-2.5 2.6-3.8 5-3.8S13.6 15.5 14.5 18M9.5 18c.9-2.5 2.6-3.8 5-3.8 2.4 0 4.1 1.3 5 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "substitute":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M6 8h10.5M13 4.5 16.5 8 13 11.5M18 16H7.5M11 12.5 7.5 16 11 19.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case "customer":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M6.5 18c1-3.1 3.1-4.8 5.5-4.8s4.5 1.7 5.5 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M18 7h2M19 6v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "entrant":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M11 4.5H7.2A2.7 2.7 0 0 0 4.5 7.2v9.6a2.7 2.7 0 0 0 2.7 2.7H11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M13 8.5 18 12l-5 3.5M10 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        default:
            return null;
    }
};

const levelStyles: Record<z.infer<typeof forceSchema>["level"], { backgroundColor: string; color: string }> = {
    高: { backgroundColor: "#FFCDD2", color: "#B71C1C" },
    中: { backgroundColor: "#FFE0B2", color: "#E65100" },
};

const CompetitiveLandscapeAnalysis = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
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
                        <FinanceIcon name="chess" className="h-[18px] w-[18px]" color="var(--primary-color,#B71C1C)" />
                        <span>{parsed.metaLabel}</span>
                    </div>
                </div>

                <div className="mx-[60px] mb-[18px] flex-none">
                    <div className="h-[2px] w-full rounded-full" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />
                </div>

                <div className="flex flex-1 gap-[40px] px-[60px] pb-[20px]">
                    <div className="flex w-[365px] flex-none flex-col">
                        <div className="mb-[18px]">
                            <SectionHeading title={parsed.participantsTitle} />
                            <div className="grid grid-cols-2 gap-[10px]">
                                {parsed.participants.map((item) => (
                                    <div
                                        key={item.title}
                                        className="rounded-[6px] border px-[10px] py-[12px] text-center"
                                        style={{ backgroundColor: "#FAFAFA", borderColor: "var(--stroke,#EEEEEE)" }}
                                    >
                                        <div className="mb-[6px] flex justify-center">
                                            <ParticipantIcon name={item.icon} />
                                        </div>
                                        <div className="mb-[3px] text-[13px] font-bold" style={{ color: "var(--background-text,#212121)" }}>
                                            {item.title}
                                        </div>
                                        <div className="text-[11px]" style={{ color: "var(--text-muted,#616161)" }}>
                                            {item.description}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-1 flex-col">
                            <SectionHeading title={parsed.forcesTitle} />
                            <div
                                className="flex flex-1 flex-col rounded-[8px] border px-[15px] py-[14px]"
                                style={{
                                    backgroundColor: "var(--background-color,#FFFFFF)",
                                    borderColor: "var(--stroke,#EEEEEE)",
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                                }}
                            >
                                {parsed.forces.map((item, index) => (
                                    <div key={item.title} className="flex flex-col">
                                        <div className="flex items-start gap-[12px] py-[10px]">
                                            <div
                                                className="flex h-[32px] w-[32px] flex-none items-center justify-center rounded-full"
                                                style={{ backgroundColor: "#FFEBEE" }}
                                            >
                                                <ForceIcon name={item.icon} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="mb-[4px] flex items-start justify-between gap-[8px]">
                                                    <div className="text-[14px] font-bold" style={{ color: "var(--background-text,#212121)" }}>
                                                        {item.title}
                                                    </div>
                                                    <div
                                                        className="rounded-[3px] px-[6px] py-[1px] text-[12px] font-bold"
                                                        style={levelStyles[item.level]}
                                                    >
                                                        {item.level}
                                                    </div>
                                                </div>
                                                <div className="text-[12px] leading-[1.35]" style={{ color: "var(--text-muted,#616161)" }}>
                                                    {item.description}
                                                </div>
                                            </div>
                                        </div>
                                        {index < parsed.forces.length - 1 ? (
                                            <div className="ml-[44px] h-px" style={{ backgroundColor: "#EDEDED" }} />
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-1 flex-col">
                        <SectionHeading title={parsed.comparisonTitle} />
                        <div
                            className="overflow-hidden rounded-[8px] border"
                            style={{
                                backgroundColor: "var(--background-color,#FFFFFF)",
                                borderColor: "#E0E0E0",
                                boxShadow: "0 4px 6px rgba(0,0,0,0.03)",
                            }}
                        >
                            <div
                                className="flex text-[15px] font-bold"
                                style={{ backgroundColor: "var(--primary-color,#B71C1C)", color: "#FFFFFF", letterSpacing: "0.03em" }}
                            >
                                <div className="w-[110px] px-[15px] py-[15px]">{parsed.columns.dimension}</div>
                                <div className="w-[205px] px-[15px] py-[15px]">{parsed.columns.traditional}</div>
                                <div className="w-[205px] px-[15px] py-[15px]">{parsed.columns.tech}</div>
                                <div className="flex-1 px-[15px] py-[15px]">{parsed.columns.winning}</div>
                            </div>

                            {parsed.comparisonRows.map((row, index) => (
                                <div key={row.dimension} className="flex flex-col">
                                    <div className="flex" style={{ backgroundColor: index % 2 === 1 ? "#FAFAFA" : "#FFFFFF" }}>
                                        <div className="w-[110px] px-[15px] py-[14px]" style={{ backgroundColor: "#FFFFFF" }}>
                                            <div className="text-[14px] font-bold" style={{ color: "var(--background-text,#212121)" }}>
                                                {row.dimension}
                                            </div>
                                        </div>

                                        <div className="w-[205px] px-[15px] py-[14px]">
                                            <div className="mb-[4px] text-[14px]" style={{ color: "var(--text-muted,#616161)" }}>
                                                {row.traditionalLead}
                                            </div>
                                            <div className="text-[11px]" style={{ color: "#8F8F8F" }}>
                                                {row.traditionalSupport}
                                            </div>
                                        </div>

                                        <div className="w-[205px] px-[15px] py-[14px]">
                                            <div className="mb-[4px] text-[14px]" style={{ color: "var(--text-muted,#616161)" }}>
                                                {row.techLead}
                                            </div>
                                            <div className="text-[11px]" style={{ color: "#8F8F8F" }}>
                                                {row.techSupport}
                                            </div>
                                        </div>

                                        <div className="flex-1 px-[15px] py-[14px]" style={{ backgroundColor: "rgba(183, 28, 28, 0.03)" }}>
                                            <div className="mb-[4px] text-[14px] font-bold" style={{ color: "var(--primary-color,#B71C1C)" }}>
                                                {row.winningLead}
                                            </div>
                                            <div className="text-[11px]" style={{ color: "#9D2E2E" }}>
                                                {row.winningSupport}
                                            </div>
                                        </div>
                                    </div>
                                    {index < parsed.comparisonRows.length - 1 ? (
                                        <div className="h-px w-full" style={{ backgroundColor: "#EEEEEE" }} />
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mx-[60px] h-px" style={{ backgroundColor: "#F5F5F5" }} />

                <div className="flex h-[40px] items-center justify-between px-[60px] text-[12px]" style={{ color: "#9E9E9E", backgroundColor: "var(--background-color,#FFFFFF)" }}>
                    <p>{parsed.footerText}</p>
                    <p className="w-[28px] whitespace-nowrap text-right font-bold" style={{ color: "var(--primary-color,#B71C1C)" }}>
                        {parsed.pageNumber}
                    </p>
                </div>
            </div>
        </RedFinanceCanvas>
    );
};

export default CompetitiveLandscapeAnalysis;
