import * as z from "zod";

import RedFinanceCanvas from "./shared/RedFinanceCanvas.js";
import { FinanceIcon } from "./shared/icons.js";

const focusCardSchema = z.object({
    icon: z.enum(["landmark", "anchor", "microchip"]),
    title: z.string().min(6).max(32),
    description: z.string().min(12).max(84),
});

export const Schema = z.object({
    sectionTag: z.string().min(8).max(40).default("PART 05 · STRATEGIC FOCUS"),
    title: z.string().min(2).max(12).default("数字货币"),
    subtitle: z.string().min(8).max(28).default("重塑全球价值流转的新基石"),
    description: z
        .string()
        .min(24)
        .max(120)
        .default("从国家主权的央行数字货币到私人部门的稳定币与加密资产，数字化形态正在根本性改变货币的发行、流通与治理机制。"),
    cards: z.array(focusCardSchema).min(3).max(3).default([
        {
            icon: "landmark",
            title: "央行数字货币（CBDC）",
            description: "国家信用背书的法定货币数字化形态，兼顾支付效率、可追踪性与金融安全。",
        },
        {
            icon: "anchor",
            title: "稳定币（Stablecoins）",
            description: "连接法币与加密世界的桥梁，正在演进为跨境支付和实时清算的新型基础设施。",
        },
        {
            icon: "microchip",
            title: "加密资产（Crypto Assets）",
            description: "去中心化网络原生的价值载体，也是 Web3 经济体系中的关键流通单元。",
        },
    ]),
    footerText: z.string().min(8).max(88).default("金融行业战略分析报告 | DIGITAL CURRENCY & ASSETS"),
    pageNumber: z.string().min(1).max(4).default("15"),
});

export const layoutId = "digital-currency-focus";
export const layoutName = "Digital Currency Focus";
export const layoutDescription =
    "A strategic transition slide with a bold digital-currency headline, short explanatory text, and three editable finance focus cards.";

const ChevronIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[14px] w-[14px]" fill="none">
        <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const backgroundDotsSvg = Array.from({ length: 25 })
    .map((_, index) => {
        const column = index % 5;
        const row = Math.floor(index / 5);
        const x = 452 + column * 19;
        const y = 108 + row * 22;

        return `<circle cx="${x}" cy="${y}" r="2" fill="rgba(229,57,53,0.45)" />`;
    })
    .join("");

const backgroundRingsSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="630" height="670" viewBox="0 0 630 670" fill="none">
  <circle cx="430" cy="360" r="400" stroke="rgba(183,28,28,0.12)" stroke-width="1" />
  <circle cx="430" cy="360" r="280" stroke="rgba(255,235,238,0.7)" stroke-width="40" />
  ${backgroundDotsSvg}
</svg>
`;

const backgroundRingsDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(backgroundRingsSvg)}`;
const accentMatrixSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120" viewBox="0 0 300 120" fill="none">
  ${Array.from({ length: 32 })
      .map((_, index) => {
          const column = index % 8;
          const row = Math.floor(index / 8);
          const x = 8 + column * 34;
          const y = 16 + row * 24;

          return `<rect x="${x}" y="${y}" width="24" height="4" rx="2" transform="rotate(-35 ${x + 12} ${y + 2})" fill="rgba(224,224,224,0.72)" />`;
      })
      .join("")}
</svg>
`;

const accentMatrixDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(accentMatrixSvg)}`;

const BackgroundRings = () => (
    <img
        src={backgroundRingsDataUri}
        alt=""
        aria-hidden="true"
        className="absolute left-[650px] top-0 z-0 h-[670px] w-[630px]"
    />
);

const FocusCard = ({ item }: { item: z.infer<typeof focusCardSchema> }) => (
    <div
        className="flex h-[118px] items-stretch overflow-hidden rounded-[12px]"
        style={{
            backgroundColor: "#FFFFFF",
            boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
        }}
    >
        <div className="w-[8px] flex-none" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
        <div className="flex flex-1 items-center gap-[18px] px-[20px] py-[18px]">
            <div
                className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[14px]"
                style={{ backgroundColor: "#FFEBEE", color: "var(--primary-color,#B71C1C)" }}
            >
                <FinanceIcon name={item.icon} className="h-[24px] w-[24px]" color="currentColor" />
            </div>
            <div className="min-w-0 flex-1">
                <div
                    className="mb-[6px] whitespace-nowrap text-[18px] font-bold leading-none"
                    style={{
                        width: "280px",
                        color: "var(--background-text,#1A1A1A)",
                    }}
                >
                    {item.title}
                </div>
                <div className="text-[13px] leading-[1.5]" style={{ color: "var(--text-muted,#616161)" }}>
                    {item.description}
                </div>
            </div>
            <div
                className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full"
                style={{
                    backgroundColor: "#FFF3F2",
                    color: "#E53935",
                }}
            >
                <ChevronIcon />
            </div>
        </div>
    </div>
);

const DigitalCurrencyFocus = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    const parsed = Schema.parse(data ?? {});

    return (
        <RedFinanceCanvas>
            <div className="absolute left-0 top-0 z-20 h-[12px] w-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />

            <BackgroundRings />

            <img
                src={accentMatrixDataUri}
                alt=""
                aria-hidden="true"
                className="absolute bottom-[88px] left-[54px] z-0 h-[120px] w-[300px] opacity-80"
            />

            <div className="relative z-10 flex h-[670px] px-[96px] pb-[58px] pt-[82px]">
                <div className="flex w-[596px] flex-none flex-col justify-center pr-[62px]">
                    <div className="mb-[22px] flex items-center gap-[12px]">
                        <div className="h-[2px] w-[42px] flex-none rounded-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />
                        <div
                            className="whitespace-nowrap text-[14px] font-bold uppercase tracking-[0.18em]"
                            style={{ width: "290px", color: "var(--primary-color,#B71C1C)" }}
                        >
                            {parsed.sectionTag}
                        </div>
                    </div>

                    <div
                        className="whitespace-nowrap text-[84px] font-black leading-[0.98] tracking-[-0.05em]"
                        style={{ width: "380px", color: "var(--background-text,#1A1A1A)" }}
                    >
                        {parsed.title}
                    </div>

                    <div
                        className="mt-[18px] whitespace-nowrap text-[28px] font-light leading-none"
                        style={{ width: "420px", color: "var(--text-muted,#616161)" }}
                    >
                        {parsed.subtitle}
                    </div>

                    <div className="mt-[38px] h-[6px] w-[84px] rounded-full" style={{ backgroundColor: "var(--primary-color,#B71C1C)" }} />

                    <div
                        className="mt-[34px] text-[16px] leading-[1.7]"
                        style={{
                            width: "490px",
                            color: "var(--text-muted,#616161)",
                        }}
                    >
                        {parsed.description}
                    </div>
                </div>

                <div className="flex flex-1 items-center">
                    <div className="flex w-full flex-col gap-[18px]">
                        {parsed.cards.map((item) => (
                            <FocusCard key={item.title} item={item} />
                        ))}
                    </div>
                </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-20 h-[50px]" style={{ backgroundColor: "#FFFFFF" }}>
                <div className="absolute left-[60px] right-[60px] top-0 h-[1px]" style={{ backgroundColor: "#EEEEEE" }} />
                <div className="flex h-full items-center justify-between px-[60px]">
                    <div
                        className="whitespace-nowrap text-[12px] font-medium tracking-[0.08em]"
                        style={{ width: "520px", color: "#9E9E9E" }}
                    >
                        {parsed.footerText}
                    </div>
                    <div
                        className="whitespace-nowrap text-[14px] font-black leading-none"
                        style={{ width: "28px", color: "var(--primary-color,#B71C1C)" }}
                    >
                        {parsed.pageNumber}
                    </div>
                </div>
            </div>
        </RedFinanceCanvas>
    );
};

export default DigitalCurrencyFocus;
