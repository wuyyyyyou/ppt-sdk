import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";
import { FinanceIcon } from "./shared/icons.js";

const strategyItemSchema = z.object({
    lead: z.string().min(2).max(20),
    body: z.string().min(8).max(72),
});

const strategyPanelSchema = z.object({
    number: z.string().min(2).max(2),
    icon: z.enum(["compass", "database", "network"]),
    title: z.string().min(2).max(20),
    items: z.array(strategyItemSchema).min(3).max(3),
});

const metricItemSchema = z.object({
    value: z.string().min(2).max(12),
    name: z.string().min(2).max(24),
});

export const Schema = z.object({
    title: z.string().min(4).max(24).default("银行业数字化转型"),
    metaLabel: z.string().min(4).max(40).default("DIGITAL TRANSFORMATION"),
    introText: z
        .string()
        .min(20)
        .max(120)
        .default("为应对数字经济时代的挑战，银行需构建以客户为中心的“3+1”转型策略体系，从顶层设计、数据底座到前台运营进行全面重塑，实现业务模式的根本性变革。"),
    panels: z.array(strategyPanelSchema).min(3).max(3).default([
        {
            number: "01",
            icon: "compass",
            title: "目标蓝图",
            items: [
                { lead: "端到端数字化", body: "重塑客户旅程，打通前中后台断点，实现全流程在线化。" },
                { lead: "业技融合", body: "业务架构与IT架构深度融合，消除部门壁垒，提升响应速度。" },
                { lead: "敏捷组织", body: "建立跨职能敏捷小组，推动产品快速迭代与创新。" },
            ],
        },
        {
            number: "02",
            icon: "database",
            title: "数据与治理",
            items: [
                { lead: "统一数据平台", body: "打破数据孤岛，构建湖仓一体的实时数据底座。" },
                { lead: "主数据治理", body: "建立全行级数据标准体系，确保数据资产的高质量与可用性。" },
                { lead: "安全与隐私", body: "强化数据全生命周期安全管理，合规应用隐私计算技术。" },
            ],
        },
        {
            number: "03",
            icon: "network",
            title: "运营与渠道",
            items: [
                { lead: "全渠道无缝体验", body: "实现线上线下渠道协同，保证一致的服务体验与品牌形象。" },
                { lead: "智能营销决策", body: "基于AI模型的实时客户洞察，实现千人千面的精准营销。" },
                { lead: "流程自动化", body: "大规模应用RPA与智能流程挖掘，大幅降低运营成本。" },
            ],
        },
    ]),
    metricsLabel: z.string().min(6).max(28).default("成功衡量指标 (KPIs)"),
    metrics: z.array(metricItemSchema).min(4).max(4).default([
        { value: "60%+", name: "数字渠道渗透率" },
        { value: "<35%", name: "成本收入比 (CIR)" },
        { value: "55+", name: "净推荐值 (NPS)" },
        { value: "25%", name: "IT投入年均增长" },
    ]),
    footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
    pageNumber: z.string().min(2).max(4).default("05"),
});

export const layoutId = "banking-digital-transformation";
export const layoutName = "Banking Digital Transformation";
export const layoutDescription = "A three-panel banking transformation slide with strategic pillars, highlighted priorities, and KPI targets.";

const PanelIcon = ({ name }: { name: z.infer<typeof strategyPanelSchema>["icon"] }) => {
    const className = "h-7 w-7";
    const style = { color: "var(--primary-color,#B71C1C)" };

    switch (name) {
        case "compass":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
                    <path d="m9.2 14.8 1.8-5.4 5.4-1.8-1.8 5.4-5.4 1.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M12 4v2.2M12 17.8V20M4 12h2.2M17.8 12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "database":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <ellipse cx="12" cy="6.8" rx="5.8" ry="2.8" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M6.2 6.8v4.5c0 1.55 2.6 2.8 5.8 2.8s5.8-1.25 5.8-2.8V6.8M6.2 11.3v4.5c0 1.55 2.6 2.8 5.8 2.8s5.8-1.25 5.8-2.8v-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "network":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <circle cx="6" cy="12" r="2" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="18" cy="7" r="2" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="18" cy="17" r="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8 11.2 16 7.8M8 12.8 16 16.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        default:
            return null;
    }
};

const MetricsIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" style={{ color: "var(--primary-color,#B71C1C)" }}>
        <path d="M4.5 18.5h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="6" y="11.5" width="2.6" height="5" rx="0.8" fill="currentColor" stroke="none" />
        <rect x="10.7" y="8.5" width="2.6" height="8" rx="0.8" fill="currentColor" stroke="none" />
        <rect x="15.4" y="5.5" width="2.6" height="11" rx="0.8" fill="currentColor" stroke="none" />
    </svg>
);

const BankingDigitalTransformation = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
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
                    <div className="flex items-center gap-[10px] text-[14px] font-medium" style={{ color: "var(--text-muted,#616161)" }}>
                        <FinanceIcon name="laptop-code" className="h-[18px] w-[18px]" color="var(--primary-color,#B71C1C)" />
                        <span>{parsed.metaLabel}</span>
                    </div>
                </div>

                <div className="mx-[60px] mb-[20px] h-[2px]" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />

                <div className="flex flex-1 flex-col px-[60px] pb-[20px]">
                    <div className="relative mb-[30px] max-w-[900px] pl-[19px]">
                        <div className="absolute bottom-0 left-0 top-0 w-[4px] rounded-full" style={{ backgroundColor: "#FFEBEE" }} />
                        <p className="text-[16px] leading-[1.6]" style={{ color: "var(--text-muted,#616161)" }}>
                            {parsed.introText}
                        </p>
                    </div>

                    <div className="mb-[20px] grid flex-1 grid-cols-3 gap-[30px]">
                        {parsed.panels.map((panel) => (
                            <div
                                key={panel.number}
                                className="relative flex flex-col overflow-hidden rounded-[8px] border px-[24px] pb-[24px] pt-[30px]"
                                style={{
                                    borderColor: "var(--stroke,#EEEEEE)",
                                    backgroundColor: "var(--background-color,#FFFFFF)",
                                    boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
                                }}
                            >
                                <div className="absolute left-0 top-0 h-[6px] w-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                                <div
                                    className="absolute right-[20px] top-[20px] text-[48px] font-black leading-none"
                                    style={{ color: "#FDEBEC" }}
                                >
                                    {panel.number}
                                </div>

                                <div
                                    className="mb-[20px] flex h-[64px] w-[64px] items-center justify-center rounded-[12px]"
                                    style={{ backgroundColor: "#FFEBEE" }}
                                >
                                    <PanelIcon name={panel.icon} />
                                </div>

                                <h2 className="text-[20px] font-bold" style={{ color: "var(--background-text,#212121)" }}>
                                    {panel.title}
                                </h2>
                                <div className="mb-[16px] mt-[10px] h-px w-full" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />

                                <div className="flex-1">
                                    {panel.items.map((item, index) => (
                                        <div key={`${panel.number}-${index}`} className="mb-[12px] flex items-start gap-[12px] last:mb-0">
                                            <div
                                                className="mt-[8px] h-[6px] w-[6px] flex-none rounded-full"
                                                style={{ backgroundColor: "var(--primary-color,#B71C1C)" }}
                                            />
                                            <div className="flex flex-1 items-start gap-[8px] text-[14px] leading-[1.5]">
                                                <div className="shrink-0 font-bold" style={{ color: "var(--background-text,#212121)" }}>
                                                    {item.lead}：
                                                </div>
                                                <div className="flex-1" style={{ color: "var(--text-muted,#616161)" }}>
                                                    {item.body}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div
                        className="mt-auto flex items-center justify-between rounded-[8px] border px-[30px] py-[15px]"
                        style={{ backgroundColor: "#FAFAFA", borderColor: "var(--stroke,#EEEEEE)" }}
                    >
                        <div className="mr-[20px] flex items-center gap-[8px] text-[14px] font-bold" style={{ color: "var(--background-text,#212121)" }}>
                            <MetricsIcon />
                            <span>{parsed.metricsLabel}</span>
                        </div>

                        <div className="flex gap-[40px]">
                            {parsed.metrics.map((metric) => (
                                <div key={metric.name} className="flex items-center gap-[10px]">
                                    <span className="text-[18px] font-black" style={{ color: "var(--primary-color,#B71C1C)" }}>
                                        {metric.value}
                                    </span>
                                    <span className="text-[13px]" style={{ color: "var(--text-muted,#616161)" }}>
                                        {metric.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div
                    className="flex h-[40px] items-center justify-between border-t px-[60px] text-[12px]"
                    style={{ borderColor: "#F5F5F5", color: "#9E9E9E", backgroundColor: "var(--background-color,#FFFFFF)" }}
                >
                    <p>{parsed.footerText}</p>
                    <p className="font-bold" style={{ color: "var(--primary-color,#B71C1C)" }}>
                        {parsed.pageNumber}
                    </p>
                </div>
            </div>
        </RedFinanceCanvas>
    );
};

export default BankingDigitalTransformation;
