import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";
import { FinanceIcon } from "./shared/icons.js";

const capabilityRowSchema = z.object({
    icon: z.enum(["payments", "open-banking", "cloud", "ai", "regtech", "cybersecurity"]),
    dimensionLines: z.array(z.string().min(2).max(20)).min(2).max(2),
    chinaTitle: z.string().min(4).max(24),
    chinaDetail: z.object({
        lead: z.string().min(2).max(18),
        highlight: z.string().min(2).max(18),
        tail: z.string().min(2).max(22),
    }),
    usTitle: z.string().min(4).max(28),
    usDetail: z.object({
        lead: z.string().min(2).max(18),
        highlight: z.string().min(2).max(20),
        tail: z.string().min(2).max(24),
    }),
});

export const Schema = z.object({
    title: z.string().min(6).max(28).default("中美金融科技与数字能力对比"),
    metaLabel: z.string().min(8).max(40).default("FINTECH & DIGITAL CAPABILITIES"),
    dimensionLabel: z.string().min(8).max(30).default("对比维度 / Dimensions"),
    chinaLabel: z.string().min(4).max(16).default("中国 (CN)"),
    usLabel: z.string().min(4).max(16).default("美国 (US)"),
    rows: z.array(capabilityRowSchema).min(6).max(6).default([
        {
            icon: "payments",
            dimensionLines: ["支付轨道", "Payment Rails"],
            chinaTitle: "超级 App 主导 · 实时结算",
            chinaDetail: {
                lead: "二维码普及率超90%，",
                highlight: "移动端流量垄断",
                tail: "，T+0成标配。",
            },
            usTitle: "卡组织主导 · 逐步实时化",
            usDetail: {
                lead: "信用卡根深蒂固，",
                highlight: "FedNow",
                tail: " 推动实时支付基建。",
            },
        },
        {
            icon: "open-banking",
            dimensionLines: ["开放银行", "Open Banking"],
            chinaTitle: "生态平台驱动",
            chinaDetail: {
                lead: "通过",
                highlight: "场景嵌入",
                tail: "开放，API标准在统一，生态壁垒高。",
            },
            usTitle: "聚合器驱动 (Aggregators)",
            usDetail: {
                lead: "市场化主导，",
                highlight: "Plaid",
                tail: " 连接数据，Fdx标准渐成熟。",
            },
        },
        {
            icon: "cloud",
            dimensionLines: ["云与架构", "Cloud & Arch"],
            chinaTitle: "云原生跨越式发展",
            chinaDetail: {
                lead: "核心系统",
                highlight: "分布式改造",
                tail: "激进，倾向私有云/行业云。",
            },
            usTitle: "混合云与大型机并存",
            usDetail: {
                lead: "成熟",
                highlight: "公有云",
                tail: "应用，核心账务层仍保留大型机。",
            },
        },
        {
            icon: "ai",
            dimensionLines: ["AI 与分析", "AI & Analytics"],
            chinaTitle: "消费端应用普及",
            chinaDetail: {
                lead: "人脸识别，",
                highlight: "极速信贷",
                tail: "广泛，海量数据训练C端模型。",
            },
            usTitle: "企业级风控与量化",
            usDetail: {
                lead: "深耕",
                highlight: "MLOps",
                tail: "，在量化交易及复杂衍生品定价领先。",
            },
        },
        {
            icon: "regtech",
            dimensionLines: ["合规科技", "RegTech"],
            chinaTitle: "大数据实时监测",
            chinaDetail: {
                lead: "侧重",
                highlight: "资金流向",
                tail: "监控，反洗钱规则迭代速度极快。",
            },
            usTitle: "模型验证与制裁筛查",
            usDetail: {
                lead: "强调",
                highlight: "模型风险管理",
                tail: "，全球制裁名单筛查更成熟。",
            },
        },
        {
            icon: "cybersecurity",
            dimensionLines: ["网络安全", "Cybersecurity"],
            chinaTitle: "数据主权与隐私计算",
            chinaDetail: {
                lead: "推行",
                highlight: "数据本地化",
                tail: "，多方安全计算在共享中活跃。",
            },
            usTitle: "零信任架构 (Zero Trust)",
            usDetail: {
                lead: "防御边界消失，身份认证与",
                highlight: "威胁情报",
                tail: "高度工业化。",
            },
        },
    ]),
    footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
    pageNumber: z.string().min(2).max(4).default("13"),
});

export const layoutId = "china-us-fintech-capabilities";
export const layoutName = "China US Fintech Capabilities";
export const layoutDescription =
    "A China-US fintech capability comparison slide with six editable matrix rows for payments, open banking, cloud, AI, regtech, and cybersecurity.";

const BlockDivider = ({
    color,
    segments = 22,
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

const CountryMark = ({ country }: { country: "cn" | "us" }) => {
    if (country === "cn") {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[14px] w-[14px]" fill="currentColor">
                <path d="m12 3.5 2.18 4.42 4.88.7-3.53 3.44.84 4.86L12 14.6l-4.37 2.32.84-4.86-3.53-3.44 4.88-.7Z" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[16px] w-[16px]" fill="none">
            <path d="M4.5 20V4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path
                d="M6.2 5.6c2.1-1.1 3.9-.7 5.7.25 1.8.96 3.4 1.32 5.4.18.86-.5 1.62-.72 2.22-.74v7.95c-.6.02-1.36.24-2.22.74-2 1.14-3.6.78-5.4-.18-1.8-.95-3.6-1.35-5.7-.24Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
            />
            <path d="M9 7.4h7.8M7.8 9.5h9M9 11.6h7.8" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity="0.95" />
            <path d="M7.5 7.2h2.3M7.5 8.9h2.3" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity="0.95" />
        </svg>
    );
};

const CountryBadge = ({
    label,
    country,
}: {
    label: string;
    country: "cn" | "us";
}) => {
    const isChina = country === "cn";

    return (
        <div
            className="inline-flex h-[34px] items-center gap-[8px] rounded-[8px] px-[12px] text-[13px] font-black"
            style={{
                backgroundColor: isChina ? "var(--primary-color,#B71C1C)" : "#1565C0",
                color: "#FFFFFF",
                boxShadow: isChina ? "0 4px 10px rgba(183,28,28,0.16)" : "0 4px 10px rgba(21,101,192,0.16)",
            }}
        >
            <CountryMark country={country} />
            <span className="whitespace-nowrap">{label}</span>
        </div>
    );
};

const CapabilityIcon = ({ name }: { name: z.infer<typeof capabilityRowSchema>["icon"] }) => {
    const className = "h-[16px] w-[16px]";
    const style = { color: "var(--background-text,#212121)" };

    switch (name) {
        case "payments":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <rect x="5" y="5" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8 2.8v3M12 2.8v3M16 2.8v3M8 18.2v3M12 18.2v3M16 18.2v3M2.8 8h3M2.8 12h3M2.8 16h3M18.2 8h3M18.2 12h3M18.2 16h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M9.2 9.2h5.6v5.6H9.2z" stroke="currentColor" strokeWidth="1.6" />
                </svg>
            );
        case "open-banking":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <circle cx="6.5" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="17.5" cy="7" r="2.3" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="17.5" cy="17" r="2.3" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8.8 11 15 8.4M8.8 13l6.2 2.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "cloud":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M7.5 17.5h8.6a3.4 3.4 0 0 0 .3-6.8 4.8 4.8 0 0 0-9-.8 3.2 3.2 0 0 0 .1 6.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 11v6M9.8 14.2 12 16.4l2.2-2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case "ai":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M9 6.8A3.1 3.1 0 0 1 12 4a3.1 3.1 0 0 1 3 2.8 3.7 3.7 0 0 1 2.5 3.5 3.5 3.5 0 0 1-1.3 2.7V16a2.2 2.2 0 0 1-2.2 2.2h-4A2.2 2.2 0 0 1 7.8 16v-3a3.5 3.5 0 0 1-1.3-2.7A3.7 3.7 0 0 1 9 6.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M10 21h4M10 14h4M12 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "regtech":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M12 4 18 6.5V11c0 4.1-2.2 7-6 9-3.8-2-6-4.9-6-9V6.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="m9.3 12.2 1.8 1.8 3.8-4.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case "cybersecurity":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M12 4.5c3.7 0 6.5 2.9 6.5 6.4 0 2.5-1.1 4.8-3 6.4V19H8.5v-1.7a8.4 8.4 0 0 1-3-6.4C5.5 7.4 8.3 4.5 12 4.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M9.5 12.2 11.4 14l3.1-3.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        default:
            return null;
    }
};

const MatrixCell = ({
    title,
    detail,
    accentColor,
    backgroundColor,
    align,
}: {
    title: string;
    detail: {
        lead: string;
        highlight: string;
        tail: string;
    };
    accentColor: string;
    backgroundColor: string;
    align: "left" | "right";
}) => {
    const isRight = align === "right";

    return (
        <div
            className="flex flex-1 items-stretch rounded-[12px] px-[16px] py-[10px]"
            style={{ backgroundColor }}
        >
            {!isRight ? <div className="mr-[12px] w-[4px] rounded-full" style={{ backgroundColor: accentColor }} /> : null}
            <div className={`flex flex-1 flex-col justify-center ${isRight ? "items-end text-right" : "items-start text-left"}`}>
                <div
                    className="w-[220px] whitespace-nowrap text-[14px] font-bold leading-[1.15]"
                    style={{ color: "var(--background-text,#212121)" }}
                >
                    {title}
                </div>
                <div className="mt-[8px] max-w-full text-[11px] leading-[1.24]" style={{ color: "var(--text-muted,#616161)" }}>
                    <span>{detail.lead}</span>
                    <span style={{ color: accentColor, fontWeight: 700 }}>{detail.highlight}</span>
                    <span>{detail.tail}</span>
                </div>
            </div>
            {isRight ? <div className="ml-[12px] w-[4px] rounded-full" style={{ backgroundColor: accentColor }} /> : null}
        </div>
    );
};

const DimensionCard = ({
    icon,
    lines,
}: {
    icon: z.infer<typeof capabilityRowSchema>["icon"];
    lines: string[];
}) => (
    <div
        className="flex w-[170px] flex-none flex-col items-center justify-center rounded-[12px] px-[10px] py-[10px]"
        style={{
            backgroundColor: "#FFFFFF",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
        }}
    >
        <div
            className="mb-[8px] flex h-[32px] w-[32px] items-center justify-center rounded-full"
            style={{ backgroundColor: "#FAFAFA" }}
        >
            <CapabilityIcon name={icon} />
        </div>
        <div className="flex flex-col items-center gap-[2px] text-center">
            {lines.map((line, index) => (
                <div
                    key={`${line}-${index}`}
                    className={index === 0 ? "text-[12px] font-bold leading-[1.1]" : "text-[10px] font-semibold leading-[1.1]"}
                    style={{ color: index === 0 ? "var(--background-text,#212121)" : "var(--text-muted,#616161)" }}
                >
                    {line}
                </div>
            ))}
        </div>
    </div>
);

const ChinaUsFintechCapabilities = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const parsed = Schema.parse(data ?? {});

    return (
        <RedFinanceCanvas>
            <div className="relative z-10 flex h-full flex-col">
                <div className="mx-[60px] flex items-end justify-between pb-[10px] pt-[28px]">
                    <div className="flex items-center gap-[15px]">
                        <div className="h-[34px] w-[6px] rounded-[2px]" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                        <h1 className="text-[34px] font-black tracking-[-0.02em]" style={{ color: "var(--background-text,#212121)" }}>
                            {parsed.title}
                        </h1>
                    </div>
                    <div className="flex items-center gap-[10px] whitespace-nowrap text-[13px] font-medium" style={{ color: "var(--text-muted,#616161)" }}>
                        <FinanceIcon name="microchip" className="h-[18px] w-[18px]" color="var(--primary-color,#B71C1C)" />
                        <span>{parsed.metaLabel}</span>
                    </div>
                </div>

                <div className="mx-[60px] mb-[10px] flex-none">
                    <div className="h-[2px] w-full rounded-full" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />
                </div>

                <div className="flex flex-1 flex-col px-[60px] pb-[8px]">
                    <div className="flex items-center justify-between pb-[8px]">
                        <div className="flex flex-1 justify-start">
                            <CountryBadge label={parsed.chinaLabel} country="cn" />
                        </div>
                        <div className="flex w-[170px] flex-none justify-center">
                            <div className="whitespace-nowrap text-[12px] font-bold" style={{ color: "var(--text-muted,#616161)" }}>
                                {parsed.dimensionLabel}
                            </div>
                        </div>
                        <div className="flex flex-1 justify-end">
                            <CountryBadge label={parsed.usLabel} country="us" />
                        </div>
                    </div>

                    <div className="mb-[10px]">
                        <BlockDivider color="#E6E6E6" segments={30} height={2} gap={4} />
                    </div>

                    <div className="flex flex-1 flex-col justify-between gap-[8px]">
                        {parsed.rows.map((row) => (
                            <div key={row.dimensionLines.join("-")} className="flex h-[72px] items-stretch gap-[12px]">
                                <MatrixCell
                                    title={row.chinaTitle}
                                    detail={row.chinaDetail}
                                    accentColor="var(--primary-color,#B71C1C)"
                                    backgroundColor="#FFEBEE"
                                    align="right"
                                />
                                <DimensionCard icon={row.icon} lines={row.dimensionLines} />
                                <MatrixCell
                                    title={row.usTitle}
                                    detail={row.usDetail}
                                    accentColor="#1565C0"
                                    backgroundColor="#E3F2FD"
                                    align="left"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mx-[60px] mt-[10px] flex-none">
                    <div className="h-[1px] w-full rounded-full" style={{ backgroundColor: "#F1F1F1" }} />
                </div>

                <div className="mx-[60px] flex h-[30px] flex-none items-center justify-between text-[11px]" style={{ color: "#9E9E9E" }}>
                    <div>{parsed.footerText}</div>
                    <div className="font-bold" style={{ color: "var(--primary-color,#B71C1C)" }}>
                        {parsed.pageNumber}
                    </div>
                </div>
            </div>
        </RedFinanceCanvas>
    );
};

export default ChinaUsFintechCapabilities;
