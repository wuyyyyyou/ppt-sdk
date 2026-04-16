import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";

const timelineEventSchema = z.object({
    period: z.string().min(4).max(16),
    stage: z.string().min(4).max(12),
    title: z.string().min(6).max(24),
    description: z.string().min(20).max(96),
    icon: z.enum(["mobile", "gavel", "document", "health", "globe"]),
    tone: z.enum(["default", "future"]).default("default"),
});

export const Schema = z.object({
    title: z.string().min(4).max(24).default("金融行业发展时间线"),
    metaLabel: z.string().min(8).max(40).default("TIMELINE (2010-2026)"),
    items: z.array(timelineEventSchema).min(5).max(5).default([
        {
            period: "2010-2012",
            stage: "移动支付萌芽",
            title: "移动支付与二维码时代开启",
            description: "支付宝与微信支付开始普及，二维码支付标准逐步确立，打破传统POS机收单格局，金融服务开始向移动端大规模迁移。",
            icon: "mobile",
            tone: "default",
        },
        {
            period: "2015",
            stage: "监管政策与创新",
            title: "互联网金融监管元年",
            description: "十部委发布《关于促进互联网金融健康发展的指导意见》，P2P等新兴业态进入合规整顿期，金融科技开始回归科技赋能本质。",
            icon: "gavel",
            tone: "default",
        },
        {
            period: "2018",
            stage: "资管新规落地",
            title: "资管新规重塑市场",
            description: "打破刚性兑付，统一资管产品监管标准，推动理财业务向净值化转型，财富管理行业进入规范发展新阶段。",
            icon: "document",
            tone: "default",
        },
        {
            period: "2020",
            stage: "数字化加速",
            title: "疫情倒逼全流程数字化",
            description: '非接触式金融服务成为主流，远程银行、视频面签、零接触网点迅速落地，银行业数字化转型从"可选项"变为"必选项"。',
            icon: "health",
            tone: "default",
        },
        {
            period: "2026",
            stage: "未来生态",
            title: "开放与智能生态融合",
            description: "API经济走向成熟，跨境金融互联互通，构建以数据要素为核心的泛金融生态圈，AI成为基础设施而非单一工具。",
            icon: "globe",
            tone: "future",
        },
    ]),
    footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
    pageNumber: z.string().min(2).max(4).default("11"),
});

export const layoutId = "industry-development-timeline";
export const layoutName = "Industry Development Timeline";
export const layoutDescription =
    "A vertical finance-industry timeline with fixed milestone cards, editable year markers, and a future-state highlight module.";

const TimelineMetaIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none">
        <path d="M12 6.2v5.3l3.2 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="7.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
);

const TimelineGlyph = ({ name }: { name: z.infer<typeof timelineEventSchema>["icon"] }) => {
    const className = "h-[18px] w-[18px]";

    switch (name) {
        case "mobile":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
                    <rect x="7" y="3.8" width="10" height="16.4" rx="2.3" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M10 6.5h4M11.2 17.1h1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "gavel":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
                    <path d="m8 7.3 3.2 3.2M6.2 9.1l3.2 3.2M13.4 5.5l3.4 3.4M10 8.9l5.1-5.1M8.2 11.8l-3 3M12.4 16h7.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case "document":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
                    <path d="M8 4.8h6.7l3.3 3.3V19H8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M14.7 4.8v3.4H18M10.2 11.2h5.6M10.2 14.3h5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "health":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
                    <path d="M12 5.2v13.6M5.2 12h13.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.8" />
                </svg>
            );
        case "globe":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
                    <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M4.9 12h14.2M12 4.8c2.1 2.1 3.2 4.5 3.2 7.2S14.1 17.1 12 19.2M12 4.8C9.9 6.9 8.8 9.3 8.8 12s1.1 5.1 3.2 7.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        default:
            return null;
    }
};

const IndustryDevelopmentTimeline = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
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
                        <div style={{ color: "var(--primary-color,#B71C1C)" }}>
                            <TimelineMetaIcon />
                        </div>
                        <span>{parsed.metaLabel}</span>
                    </div>
                </div>

                <div className="absolute left-[60px] right-[60px] top-[101px] h-[2px] rounded-full" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />

                <div className="absolute left-[60px] right-[60px] bottom-[40px] top-[118px] overflow-hidden">
                    <div className="relative h-full">
                        <div className="absolute bottom-[52px] left-[184px] top-[52px] w-[2px] rounded-full" style={{ backgroundColor: "#E0E0E0" }} />

                        <div className="flex h-full flex-col gap-[10px]">
                            {parsed.items.map((item) => {
                                const isFuture = item.tone === "future";
                                const yearColor = isFuture ? "var(--background-text,#212121)" : "var(--primary-color,#B71C1C)";
                                const dotBorder = isFuture ? "var(--background-text,#212121)" : "var(--primary-color,#B71C1C)";
                                const dotFill = isFuture ? "var(--background-text,#212121)" : "#FFFFFF";
                                const iconColor = isFuture ? "var(--background-text,#212121)" : "var(--primary-color,#B71C1C)";
                                const iconBackground = isFuture ? "#EEEEEE" : "#FFEBEE";

                                return (
                                    <div key={`${item.period}-${item.title}`} className="flex min-h-0 flex-1 items-center">
                                        <div className="flex w-[176px] flex-none flex-col items-end justify-center pr-[30px]">
                                            <div className="whitespace-nowrap text-[24px] font-black leading-none" style={{ color: yearColor }}>
                                                {item.period}
                                            </div>
                                            <div className="mt-[5px] whitespace-nowrap text-[12px] font-medium leading-none" style={{ color: "var(--text-muted,#616161)" }}>
                                                {item.stage}
                                            </div>
                                        </div>

                                        <div className="relative z-10 flex w-[16px] flex-none items-center justify-center">
                                            <div
                                                className="h-[16px] w-[16px] rounded-full border-[3px]"
                                                style={{
                                                    borderColor: dotBorder,
                                                    backgroundColor: dotFill,
                                                    boxShadow: "0 0 0 4px rgba(255,255,255,1)",
                                                }}
                                            />
                                        </div>

                                        <div className="flex min-w-0 flex-1 items-center pl-[30px]">
                                            <div className="h-[2px] w-[22px] flex-none rounded-full" style={{ backgroundColor: "#E0E0E0" }} />
                                            <div
                                                className="relative ml-[8px] flex h-[76px] min-w-0 flex-1 overflow-hidden rounded-[10px] border"
                                                style={{
                                                    backgroundColor: "#FFFFFF",
                                                    borderColor: "var(--stroke,#EEEEEE)",
                                                    boxShadow: "0 4px 8px rgba(0,0,0,0.03)",
                                                }}
                                            >
                                                {isFuture ? (
                                                    <div
                                                        className="absolute bottom-0 left-0 top-0 w-[6px]"
                                                        style={{ backgroundColor: "var(--background-text,#212121)" }}
                                                    />
                                                ) : null}

                                                <div className={`flex h-full min-w-0 flex-1 items-center gap-[16px] px-[18px] py-[10px] ${isFuture ? "pl-[22px]" : ""}`}>
                                                    <div
                                                        className="flex h-[40px] w-[40px] flex-none items-center justify-center rounded-[8px]"
                                                        style={{ backgroundColor: iconBackground, color: iconColor }}
                                                    >
                                                        <TimelineGlyph name={item.icon} />
                                                    </div>
                                                    <div className="flex min-w-0 flex-1 flex-col justify-center">
                                                        <div className="mb-[3px] text-[16px] font-bold leading-[1.15]" style={{ color: "var(--background-text,#212121)" }}>
                                                            {item.title}
                                                        </div>
                                                        <div className="text-[12px] leading-[1.35]" style={{ color: "var(--text-muted,#616161)" }}>
                                                            {item.description}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
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

export default IndustryDevelopmentTimeline;
