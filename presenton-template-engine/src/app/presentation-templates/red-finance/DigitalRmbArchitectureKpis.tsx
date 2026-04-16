import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";
import { FinanceIcon } from "./shared/icons.js";

const architectureNodeSchema = z.object({
    icon: z.enum(["central-bank", "operator-bank", "wallet-user"]),
    title: z.string().min(2).max(18),
    subtitle: z.string().min(4).max(24),
});

const kpiSchema = z.object({
    icon: z.enum(["wallet", "pilot", "volume", "merchant"]),
    value: z.string().min(1).max(12),
    label: z.string().min(4).max(20),
});

const scenarioSchema = z.object({
    category: z.string().min(2).max(12),
    mode: z.string().min(4).max(20),
    value: z.string().min(4).max(24),
});

export const Schema = z.object({
    title: z.string().min(6).max(28).default("中国数字人民币 (e-CNY)"),
    metaLabel: z.string().min(6).max(28).default("ARCHITECTURE & KPIs"),
    architectureTitle: z.string().min(4).max(16).default("双层运营体系"),
    architectureNodes: z.array(architectureNodeSchema).min(3).max(3).default([
        {
            icon: "central-bank",
            title: "中国人民银行",
            subtitle: "发行层 (PBoC)",
        },
        {
            icon: "operator-bank",
            title: "指定运营机构",
            subtitle: "分发层 (商业银行)",
        },
        {
            icon: "wallet-user",
            title: "用户 / 钱包",
            subtitle: "应用层 (流通)",
        },
    ]),
    flowLabels: z.array(z.string().min(4).max(16)).min(2).max(2).default(["100% 准备金", "兑换 / 流通"]),
    metricsTitle: z.string().min(4).max(16).default("关键运营数据"),
    metrics: z.array(kpiSchema).min(4).max(4).default([
        {
            icon: "wallet",
            value: "2.61亿+",
            label: "开立钱包数量",
        },
        {
            icon: "pilot",
            value: "26+",
            label: "试点城市区域",
        },
        {
            icon: "volume",
            value: "1.8万亿+",
            label: "累计交易金额",
        },
        {
            icon: "merchant",
            value: "1000万+",
            label: "支持商户门店",
        },
    ]),
    scenariosTitle: z.string().min(4).max(16).default("核心应用场景"),
    scenarioColumns: z
        .object({
            category: z.string().min(2).max(8).default("场景分类"),
            mode: z.string().min(2).max(8).default("应用模式"),
            value: z.string().min(2).max(8).default("核心价值"),
        })
        .default({
            category: "场景分类",
            mode: "应用模式",
            value: "核心价值",
        }),
    scenarios: z.array(scenarioSchema).min(4).max(4).default([
        {
            category: "零售消费",
            mode: "扫码/被扫/碰一碰",
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
    footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
    pageNumber: z.string().min(1).max(4).default("18"),
});

export const layoutId = "digital-rmb-architecture-kpis";
export const layoutName = "Digital RMB Architecture KPIs";
export const layoutDescription =
    "An e-CNY overview slide with a three-layer operating architecture, four editable KPI cards, and a text-first scenario matrix.";

const SectionHeading = ({ title }: { title: string }) => (
    <div className="mb-[14px] flex items-center gap-[10px]">
        <div className="h-[18px] w-[4px] flex-none rounded-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
        <div className="whitespace-nowrap text-[16px] font-bold leading-none" style={{ width: "180px", color: "var(--background-text,#212121)" }}>
            {title}
        </div>
    </div>
);

const HeaderWalletIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none">
        <path
            d="M5 8.2h12.4A2.6 2.6 0 0 1 20 10.8v5.4a2.6 2.6 0 0 1-2.6 2.6H6.6A2.6 2.6 0 0 1 4 16.2V8.8A2.8 2.8 0 0 1 6.8 6H17"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path d="M15.2 12.4H20v3.2h-4.8a1.6 1.6 0 1 1 0-3.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M16.8 14h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
);

const ArchitectureNodeIcon = ({ name }: { name: z.infer<typeof architectureNodeSchema>["icon"] }) => {
    switch (name) {
        case "central-bank":
            return <FinanceIcon name="landmark" className="h-[24px] w-[24px]" color="currentColor" />;
        case "operator-bank":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[24px] w-[24px]" fill="none">
                    <path d="M4 9.2 12 5l8 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6.7 10.3v6.1M10.2 10.3v6.1M13.8 10.3v6.1M17.3 10.3v6.1M4.8 18.2h14.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M8.1 8.1h7.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
            );
        case "wallet-user":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[24px] w-[24px]" fill="none">
                    <rect x="7" y="4.6" width="10" height="14.8" rx="2.3" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M10 7.8h4M9.2 15.4h5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="12" cy="15.4" r="1.1" fill="currentColor" stroke="none" />
                </svg>
            );
        default:
            return null;
    }
};

const KpiIcon = ({ name }: { name: z.infer<typeof kpiSchema>["icon"] }) => {
    switch (name) {
        case "wallet":
            return <HeaderWalletIcon />;
        case "pilot":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none">
                    <path d="M6.2 18.2A6.8 6.8 0 1 1 18 13.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M12 12.2 15.8 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M16.6 18.6h3.2M18.2 17v3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "volume":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none">
                    <path d="M6 7.5h12M6 12h12M6 16.5h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M9.2 5.2v13.6M14.8 5.2v13.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
                </svg>
            );
        case "merchant":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none">
                    <path d="M5 9.6h14v8.8a1.6 1.6 0 0 1-1.6 1.6H6.6A1.6 1.6 0 0 1 5 18.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M6.2 9.6 7.6 5h8.8l1.4 4.6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M9.2 13.2h5.6M10 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        default:
            return null;
    }
};

const DownArrow = () => (
    <div className="flex h-[56px] w-[180px] items-center justify-center gap-[12px]">
        <div className="flex h-full flex-col items-center justify-center">
            <div className="h-[34px] w-[2px] rounded-full" style={{ backgroundColor: "#BDBDBD" }} />
            <svg viewBox="0 0 12 8" aria-hidden="true" className="mt-[2px] h-[8px] w-[12px]" fill="none">
                <path d="M1 1.2 6 6.2l5-5" stroke="#BDBDBD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    </div>
);

const ArchitectureNode = ({ item }: { item: z.infer<typeof architectureNodeSchema> }) => (
    <div
        className="relative flex h-[104px] w-[248px] items-center overflow-hidden rounded-[10px] border px-[18px] py-[16px]"
        style={{
            backgroundColor: "#FFFFFF",
            borderColor: "var(--stroke,#EEEEEE)",
            boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
        }}
    >
        <div className="absolute left-0 top-0 h-full w-[6px]" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
        <div
            className="mr-[16px] flex h-[48px] w-[48px] flex-none items-center justify-center rounded-[10px]"
            style={{ backgroundColor: "#FFEBEE", color: "var(--primary-color,#B71C1C)" }}
        >
            <ArchitectureNodeIcon name={item.icon} />
        </div>
        <div className="min-w-0 flex-1 text-center">
            <div
                className="mb-[6px] whitespace-nowrap text-[17px] font-bold leading-none"
                style={{ width: "150px", color: "var(--background-text,#212121)", margin: "0 auto" }}
            >
                {item.title}
            </div>
            <div
                className="whitespace-nowrap text-[12px] font-medium leading-none"
                style={{ width: "150px", color: "var(--text-muted,#616161)", margin: "0 auto" }}
            >
                {item.subtitle}
            </div>
        </div>
    </div>
);

const KpiCard = ({ item }: { item: z.infer<typeof kpiSchema> }) => (
    <div
        className="flex h-[98px] items-center gap-[14px] rounded-[10px] border px-[18px]"
        style={{
            backgroundColor: "#FFFFFF",
            borderColor: "var(--stroke,#EEEEEE)",
            boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
        }}
    >
        <div
            className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[10px]"
            style={{ backgroundColor: "#FFEBEE", color: "var(--primary-color,#B71C1C)" }}
        >
            <KpiIcon name={item.icon} />
        </div>
        <div className="min-w-0">
            <div className="mb-[6px] whitespace-nowrap text-[24px] font-black leading-none" style={{ width: "148px", color: "var(--background-text,#212121)" }}>
                {item.value}
            </div>
            <div className="whitespace-nowrap text-[13px] font-medium leading-none" style={{ width: "152px", color: "var(--text-muted,#616161)" }}>
                {item.label}
            </div>
        </div>
    </div>
);

const ScenarioRow = ({
    item,
    index,
}: {
    item: z.infer<typeof scenarioSchema>;
    index: number;
}) => (
    <div
        className="rounded-[8px] px-[18px] py-[10px]"
        style={{
            backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
        }}
    >
        <div className="grid items-center gap-[16px]" style={{ gridTemplateColumns: "160px 210px minmax(0, 1fr)" }}>
            <div className="whitespace-nowrap text-[13px] font-bold leading-none" style={{ width: "140px", color: "var(--background-text,#212121)" }}>
                {item.category}
            </div>
            <div className="whitespace-nowrap text-[13px] font-medium leading-none" style={{ width: "190px", color: "var(--background-text,#212121)" }}>
                {item.mode}
            </div>
            <div className="text-[13px] font-medium leading-[1.35]" style={{ color: "var(--background-text,#212121)" }}>
                {item.value}
            </div>
        </div>
    </div>
);

const DigitalRmbArchitectureKpis = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const parsed = Schema.parse(data ?? {});

    return (
        <RedFinanceCanvas>
            <div className="relative h-full">
                <div className="absolute left-[60px] right-[60px] top-[30px] flex items-end justify-between pb-[10px]">
                    <div className="flex items-center gap-[15px]">
                        <div className="h-[36px] w-[6px] rounded-[2px]" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                        <h1
                            className="whitespace-nowrap text-[34px] font-black leading-none tracking-[-0.03em]"
                            style={{ width: "420px", color: "var(--background-text,#212121)" }}
                        >
                            {parsed.title}
                        </h1>
                    </div>
                    <div
                        className="flex w-[240px] items-center justify-end gap-[10px] whitespace-nowrap text-[14px] font-medium"
                        style={{ color: "var(--text-muted,#616161)" }}
                    >
                        <div style={{ color: "var(--primary-color,#B71C1C)" }}>
                            <HeaderWalletIcon />
                        </div>
                        <span>{parsed.metaLabel}</span>
                    </div>
                </div>

                <div className="absolute left-[60px] right-[60px] top-[101px] h-[2px] rounded-full" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />

                <div className="absolute left-[60px] right-[60px] top-[122px] bottom-[52px] flex gap-[36px]">
                    <div
                        className="relative flex w-[350px] flex-none flex-col items-center rounded-[14px] border px-[22px] pb-[22px] pt-[18px]"
                        style={{
                            backgroundColor: "#FAFAFA",
                            borderColor: "var(--stroke,#EEEEEE)",
                        }}
                    >
                        <div className="absolute left-[20px] top-[16px] whitespace-nowrap text-[15px] font-bold leading-none" style={{ width: "140px", color: "var(--primary-color,#B71C1C)" }}>
                            {parsed.architectureTitle}
                        </div>

                        <div className="mt-[40px] flex flex-col items-center">
                            <ArchitectureNode item={parsed.architectureNodes[0]} />
                            <div className="relative flex h-[56px] w-[248px] items-center justify-center">
                                <DownArrow />
                                <div
                                    className="absolute left-[142px] top-[17px] flex h-[22px] min-w-[88px] items-center justify-center rounded-[999px] px-[10px] text-[11px] font-medium leading-none whitespace-nowrap"
                                    style={{ backgroundColor: "#FFFFFF", color: "#757575" }}
                                >
                                    {parsed.flowLabels[0]}
                                </div>
                            </div>
                            <ArchitectureNode item={parsed.architectureNodes[1]} />
                            <div className="relative flex h-[56px] w-[248px] items-center justify-center">
                                <DownArrow />
                                <div
                                    className="absolute left-[142px] top-[17px] flex h-[22px] min-w-[88px] items-center justify-center rounded-[999px] px-[10px] text-[11px] font-medium leading-none whitespace-nowrap"
                                    style={{ backgroundColor: "#FFFFFF", color: "#757575" }}
                                >
                                    {parsed.flowLabels[1]}
                                </div>
                            </div>
                            <ArchitectureNode item={parsed.architectureNodes[2]} />
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                        <SectionHeading title={parsed.metricsTitle} />
                        <div className="grid grid-cols-2 gap-[16px]">
                            {parsed.metrics.map((item) => (
                                <KpiCard key={item.label} item={item} />
                            ))}
                        </div>

                        <div className="mt-[18px] flex-1 rounded-[12px] border px-[20px] pb-[14px] pt-[16px]" style={{ backgroundColor: "#FFFFFF", borderColor: "var(--stroke,#EEEEEE)" }}>
                            <SectionHeading title={parsed.scenariosTitle} />

                            <div className="rounded-[8px] px-[18px] py-[10px]" style={{ backgroundColor: "#FAFAFA" }}>
                                <div className="grid items-center gap-[16px]" style={{ gridTemplateColumns: "160px 210px minmax(0, 1fr)" }}>
                                    <div className="whitespace-nowrap text-[13px] font-bold leading-none" style={{ width: "140px", color: "var(--primary-color,#B71C1C)" }}>
                                        {parsed.scenarioColumns.category}
                                    </div>
                                    <div className="whitespace-nowrap text-[13px] font-bold leading-none" style={{ width: "190px", color: "var(--primary-color,#B71C1C)" }}>
                                        {parsed.scenarioColumns.mode}
                                    </div>
                                    <div className="whitespace-nowrap text-[13px] font-bold leading-none" style={{ width: "160px", color: "var(--primary-color,#B71C1C)" }}>
                                        {parsed.scenarioColumns.value}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-[6px] flex flex-col gap-[6px]">
                                {parsed.scenarios.map((item, index) => (
                                    <ScenarioRow key={item.category} item={item} index={index} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-[40px] left-[60px] right-[60px] h-[1px]" style={{ backgroundColor: "#F5F5F5" }} />

                <div className="absolute bottom-0 left-0 right-0 flex h-[40px] items-center justify-between px-[60px] text-[12px]" style={{ color: "#9E9E9E", backgroundColor: "#FFFFFF" }}>
                    <div className="whitespace-nowrap font-medium tracking-[0.02em]" style={{ width: "280px" }}>
                        {parsed.footerText}
                    </div>
                    <div className="whitespace-nowrap text-[14px] font-black leading-none" style={{ width: "28px", color: "var(--primary-color,#B71C1C)" }}>
                        {parsed.pageNumber}
                    </div>
                </div>
            </div>
        </RedFinanceCanvas>
    );
};

export default DigitalRmbArchitectureKpis;
