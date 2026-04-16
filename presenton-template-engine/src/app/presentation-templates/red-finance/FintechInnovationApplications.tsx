import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";
import { FinanceIcon } from "./shared/icons.js";

const innovationItemSchema = z.object({
    icon: z.enum(["wallet", "brain", "architecture", "regtech", "security"]),
    title: z.string().min(4).max(28),
    tag: z.string().min(4).max(18),
    description: z.string().min(18).max(92),
});

export const Schema = z.object({
    title: z.string().min(4).max(24).default("金融科技创新与应用"),
    metaLabel: z.string().min(4).max(32).default("FINTECH INNOVATION"),
    visualTitle: z.string().min(4).max(24).default("技术驱动金融重构"),
    visualDescription: z
        .string()
        .min(24)
        .max(120)
        .default("以人工智能、大数据、云计算为核心的新技术集群，正在重塑金融服务的基础设施与交互模式，推动行业向智能化、开放化演进。"),
    innovations: z.array(innovationItemSchema).min(5).max(5).default([
        {
            icon: "wallet",
            title: "支付与嵌入式金融",
            tag: "Infrastructure",
            description: "推动实时支付网络建设，将信贷、保险等金融服务嵌入电商、物流等非金融场景，实现“金融即服务”能力输出。",
        },
        {
            icon: "brain",
            title: "GenAI 应用",
            tag: "AI / LLM",
            description: "部署金融垂类大模型，支撑客户经营 Copilot、投研报告生成与自动化合规审单，显著提升人效与响应速度。",
        },
        {
            icon: "architecture",
            title: "开放架构",
            tag: "Architecture",
            description: "从传统单体系统转向云原生与微服务架构，通过标准化 API 治理实现跨机构协同与业务敏捷迭代。",
        },
        {
            icon: "regtech",
            title: "RegTech 与合规",
            tag: "Risk Mgmt",
            description: "结合知识图谱与 NLP，提升 KYC、AML 与模型监控的自动化水平，满足穿透式监管与可解释要求。",
        },
        {
            icon: "security",
            title: "安全与隐私",
            tag: "Security",
            description: "建设零信任安全架构，结合联邦学习与多方安全计算，在保障数据隐私前提下释放数据协同价值。",
        },
    ]),
    footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
    pageNumber: z.string().min(2).max(4).default("06"),
});

export const layoutId = "fintech-innovation-applications";
export const layoutName = "Fintech Innovation Applications";
export const layoutDescription = "A fintech innovation slide with a controlled concept visual on the left and five application cards on the right.";

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

const CardIcon = ({ name }: { name: z.infer<typeof innovationItemSchema>["icon"] }) => {
    const className = "h-6 w-6";
    const style = { color: "var(--primary-color,#B71C1C)" };

    switch (name) {
        case "wallet":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M5 8.5h12.5A2.5 2.5 0 0 1 20 11v6A2.5 2.5 0 0 1 17.5 19H6.5A2.5 2.5 0 0 1 4 16.5v-8A2.5 2.5 0 0 1 6.5 6H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M15.5 13.2h4.5v3.6h-4.5a1.8 1.8 0 1 1 0-3.6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M16.9 15h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
            );
        case "brain":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M9.2 6.3a3 3 0 0 1 5.6 1.5 2.7 2.7 0 0 1 2.6 2.8 2.7 2.7 0 0 1-.9 2 2.8 2.8 0 0 1 .4 1.5 3 3 0 0 1-3 3H10a3.2 3.2 0 0 1-3.2-3.2 3 3 0 0 1 .5-1.7 2.7 2.7 0 0 1-.8-1.9 2.7 2.7 0 0 1 2.7-2.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M10.8 8.8v6.8M13.4 9.6v5.2M10.8 12h2.6M13.4 11.2h2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        case "architecture":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <rect x="4.5" y="5" width="6.5" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
                    <rect x="13" y="5" width="6.5" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
                    <rect x="8.8" y="14.2" width="6.5" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M7.8 9.8v2.3h8.4V9.8M12 12.1v2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case "regtech":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M8 4.8h6.6l3.4 3.5v9.9A1.8 1.8 0 0 1 16.2 20H8a2 2 0 0 1-2-2V6.8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M14.6 4.8v3.8h3.4M9 12.2h6M9 15.4h4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="m10.2 9.2 1.2 1.2 2.5-2.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        case "security":
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" style={style}>
                    <path d="M12 4 18 6.3v4.9c0 4-2.2 6.8-6 8.8-3.8-2-6-4.8-6-8.8V6.3L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M12 10.4a1.8 1.8 0 0 1 1.8 1.8v2.8h-3.6v-2.8a1.8 1.8 0 0 1 1.8-1.8Zm0 0V9.1a1.8 1.8 0 1 1 3.6 0v1.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        default:
            return null;
    }
};

const FintechInnovationApplications = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const parsed = Schema.parse(data ?? {});
    const coreGraphicUri = svgDataUri(createFintechCoreSvg());

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
                        <FinanceIcon name="microchip" className="h-[18px] w-[18px]" color="var(--primary-color,#B71C1C)" />
                        <span>{parsed.metaLabel}</span>
                    </div>
                </div>

                <div className="mx-[60px] mb-[20px] h-[2px]" style={{ backgroundColor: "var(--stroke,#EEEEEE)" }} />

                <div className="flex flex-1 px-[60px] pb-[28px]">
                    <div className="flex w-full gap-[50px]">
                        <div
                            className="flex w-[370px] flex-none flex-col items-center justify-center rounded-[14px] border px-[28px] py-[24px]"
                            style={{ backgroundColor: "#FAFAFA", borderColor: "var(--stroke,#EEEEEE)" }}
                        >
                            <div className="mb-[28px] flex h-[260px] w-[260px] items-center justify-center rounded-[18px]" style={{ backgroundColor: "#F7F2F2" }}>
                                <img src={coreGraphicUri} alt="" className="h-[240px] w-[240px]" />
                            </div>
                            <div className="w-full text-center">
                                <h2 className="mb-[8px] text-[22px] font-bold" style={{ color: "var(--background-text,#212121)" }}>
                                    {parsed.visualTitle}
                                </h2>
                                <p className="text-[14px] leading-[1.6]" style={{ color: "var(--text-muted,#616161)" }}>
                                    {parsed.visualDescription}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-1 flex-col justify-center gap-[14px]">
                            {parsed.innovations.map((item, index) => (
                                <div
                                    key={item.title}
                                    className="flex overflow-hidden rounded-[10px] border"
                                    style={{
                                        borderColor: "var(--stroke,#EEEEEE)",
                                        backgroundColor: "var(--background-color,#FFFFFF)",
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                                    }}
                                >
                                    <div
                                        className="w-[5px] flex-none"
                                        style={{ backgroundColor: "#D9D9D9" }}
                                    />
                                    <div className="flex flex-1 items-center px-[20px] py-[16px]">
                                        <div
                                            className="mr-[18px] flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[10px]"
                                            style={{ backgroundColor: "#FFEBEE" }}
                                        >
                                            <CardIcon name={item.icon} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-[6px] flex items-start justify-between gap-[12px]">
                                                <div className="pr-[8px] text-[16px] font-bold leading-[1.3]" style={{ color: "var(--background-text,#212121)" }}>
                                                    {item.title}
                                                </div>
                                                <div
                                                    className="flex-none whitespace-nowrap rounded-[4px] border px-[6px] py-[2px] text-[10px] font-semibold uppercase tracking-[0.06em]"
                                                    style={{ color: "var(--text-muted,#616161)", borderColor: "#E0E0E0", backgroundColor: "#FAFAFA" }}
                                                >
                                                    {item.tag}
                                                </div>
                                            </div>
                                            <p className="text-[13px] leading-[1.45]" style={{ color: "var(--text-muted,#616161)" }}>
                                                {item.description}
                                            </p>
                                        </div>
                                    </div>
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

export default FintechInnovationApplications;
