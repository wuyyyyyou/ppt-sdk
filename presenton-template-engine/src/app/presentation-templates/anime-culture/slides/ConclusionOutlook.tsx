import React from "react";
import * as z from "zod";

import AnimeCanvas from "./shared/AnimeCanvas.tsx";

const imageSchema = z
  .object({
    __image_url__: z
      .string()
      .default(
        "https://page.talentsecsite.com/slides_images/4153552054434ac02f2b2361b630472e.webp",
      ),
    __image_prompt__: z.string().default("Tokyo night city with neon atmosphere"),
  })
  .default({
    __image_url__:
      "https://page.talentsecsite.com/slides_images/4153552054434ac02f2b2361b630472e.webp",
    __image_prompt__: "Tokyo night city with neon atmosphere",
  });

const reviewItemSchema = z.object({
  accent: z.enum(["cyan", "magenta", "yellow"]).default("cyan"),
  label: z.string().default("LEGACY"),
  title: z.string().default("历史传承"),
  description: z
    .string()
    .default("从1917年萌芽至今，百年的技术积累与匠人精神奠定了产业基石。"),
});

const futureCardSchema = z.object({
  accent: z.enum(["cyan", "magenta", "yellow"]).default("cyan"),
  icon: z.enum(["chip", "globe", "sprout"]).default("chip"),
  title: z.string().default("技术共创"),
  tag: z.string().default("TECH INNOVATION"),
  description: z
    .string()
    .default("AI辅助作画与3D技术深度融合，提升制作效率，拓展视觉表现边界。"),
});

export const Schema = z.object({
  backgroundTitle: z.string().default("FUTURE"),
  title: z.string().default("总结与未来展望"),
  subtitle: z.string().default("THE NEXT CHAPTER OF ANIME"),
  modeLabel: z.string().default("NEXT_PHASE"),
  footerLabel: z.string().default("END OF PRESENTATION // 2026"),
  backgroundImage: imageSchema,
  reviewItems: z.array(reviewItemSchema).length(3).default([
    {
      accent: "cyan",
      label: "LEGACY",
      title: "历史传承",
      description: "从1917年萌芽至今，百年的技术积累与匠人精神奠定了产业基石。",
    },
    {
      accent: "magenta",
      label: "DIVERSITY",
      title: "类型繁荣",
      description: "打破受众边界，从子供向到成人思考，构建了包罗万象的内容生态。",
    },
    {
      accent: "yellow",
      label: "IMPACT",
      title: "全球共鸣",
      description: "跨越语言与文化壁垒，成为日本最具影响力的软实力与文化名片。",
    },
  ]),
  futureCards: z.array(futureCardSchema).length(3).default([
    {
      accent: "cyan",
      icon: "chip",
      title: "技术共创",
      tag: "TECH INNOVATION",
      description: "AI辅助作画与3D技术深度融合，提升制作效率，拓展视觉表现边界。",
    },
    {
      accent: "magenta",
      icon: "globe",
      title: "全球协作",
      tag: "GLOBALIZATION",
      description: "深化跨国制作委员会模式，推行本地化合拍，打造真正国际化的IP。",
    },
    {
      accent: "yellow",
      icon: "sprout",
      title: "可持续生产",
      tag: "SUSTAINABILITY",
      description: "改善从业者劳动环境，建立更公平的薪酬体系，培育新一代动画人才。",
    },
  ]),
});

export const layoutId = "conclusion-outlook";
export const layoutName = "Conclusion Outlook";
export const layoutDescription =
  "A closing slide that summarizes anime's legacy on the left and presents three future-direction cards on the right.";
export const layoutTags = ["conclusion", "anime", "outlook", "summary", "cards"];
export const layoutRole = "conclusion";
export const contentElements = ["headline", "summary-rail", "future-cards", "footer-meta"];
export const useCases = ["conclusion", "future-outlook", "closing-summary"];
export const suitableFor =
  "Suitable for closing slides that need a concise recap plus a small set of forward-looking priorities.";
export const avoidFor =
  "Avoid using this layout for dense statistics, image galleries, or pages that require more than three major actions.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const accentPalette = {
  cyan: {
    line: "#00F6FF",
    border: "#26384A",
    panel: "#14161E",
    iconPanel: "#17343A",
    badgePanel: "#393B42",
    muted: "#ABB4C4",
  },
  magenta: {
    line: "#FF00FF",
    border: "#40253E",
    panel: "#15151D",
    iconPanel: "#3C1A3F",
    badgePanel: "#38343D",
    muted: "#B8ACBE",
  },
  yellow: {
    line: "#FFD400",
    border: "#453A1D",
    panel: "#16161C",
    iconPanel: "#40381B",
    badgePanel: "#3C3932",
    muted: "#C0B79A",
  },
} as const;

const gridColumns = Array.from({ length: 33 }, (_, index) => index * 40);
const gridRows = Array.from({ length: 19 }, (_, index) => index * 40);

const OffsetTitle = ({ text }: { text: string }) => (
  <div className="relative">
    <div
      aria-hidden="true"
      className="absolute left-[6px] top-[6px] whitespace-nowrap text-[56px] font-black leading-none"
      style={{ color: "#00F6FF" }}
    >
      {text}
    </div>
    <div className="relative whitespace-nowrap text-[56px] font-black leading-none text-white">
      {text}
    </div>
  </div>
);

const RocketIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" aria-hidden="true">
    <g transform="rotate(-36 12 12)">
      <path
        d="M12 3.2c2.9 0 5.2 2.3 5.2 5.2v6.4c0 2.2-1.8 4-4 4h-2.4c-2.2 0-4-1.8-4-4V8.4c0-2.9 2.3-5.2 5.2-5.2Z"
        fill="#FFFFFF"
      />
      <path
        d="M9 5.4 12 2l3 3.4"
        fill="#FFFFFF"
      />
      <path
        d="M7.3 13.4 4.8 15.2V11.4l2.5.8ZM16.7 13.4l2.5 1.8v-3.8l-2.5.8Z"
        fill="#FFFFFF"
      />
      <path
        d="M9.6 18.3 8.2 21l2.6-1.1L12 22l1.2-2.1L15.8 21l-1.4-2.7Z"
        fill="#FFFFFF"
      />
      <circle cx="12" cy="8.8" r="1.5" fill="#0A0A0F" />
    </g>
  </svg>
);

const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[32px] w-[32px]" aria-hidden="true">
    <path
      d="m9 6 6 6-6 6"
      fill="none"
      stroke="#51545E"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChipIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" className="h-[40px] w-[40px]" aria-hidden="true">
    <rect x="9" y="9" width="14" height="14" rx="2.5" fill="none" stroke={color} strokeWidth="2.4" />
    <path
      d="M16 5v3M16 24v3M5 16h3M24 16h3M9 5.5v3M23 5.5v3M9 23.5v3M23 23.5v3M5.5 9h3M23.5 9h3M5.5 23h3M23.5 23h3"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

const GlobeIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" className="h-[40px] w-[40px]" aria-hidden="true">
    <circle cx="16" cy="16" r="10" fill="none" stroke={color} strokeWidth="2.4" />
    <path
      d="M6 16h20M16 6.4c2.8 2.8 4.7 5.9 4.7 9.6 0 3.7-1.9 6.8-4.7 9.6-2.8-2.8-4.7-5.9-4.7-9.6 0-3.7 1.9-6.8 4.7-9.6Z"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
  </svg>
);

const SproutIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 32 32" className="h-[40px] w-[40px]" aria-hidden="true">
    <path
      d="M15.8 25.5v-9.2M15.8 16.8c-3.6.2-6.8-1.2-8.9-4.5 5.1-1.9 8.7-.9 10.9 2.7M15.8 16.8c3.8-.1 6.8-1.8 8.5-5.7-5.3-.8-8.4.7-9.8 4.8"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FutureIcon = ({
  icon,
  color,
}: {
  icon: z.infer<typeof futureCardSchema>["icon"];
  color: string;
}) => {
  switch (icon) {
    case "chip":
      return <ChipIcon color={color} />;
    case "globe":
      return <GlobeIcon color={color} />;
    case "sprout":
      return <SproutIcon color={color} />;
  }
};

const ConclusionOutlook = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <AnimeCanvas background="#090A11">
      <div className="absolute inset-0 bg-[#080910]" />

      <img
        src={parsed.backgroundImage.__image_url__}
        alt={parsed.backgroundImage.__image_prompt__ || "Tokyo night city"}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: 0.18 }}
      />

      <div className="absolute inset-0 bg-[#090A11]" style={{ opacity: 0.76 }} />

      {gridRows.map((top) => (
        <div
          key={`grid-row-${top}`}
          className="absolute left-0 h-px w-full"
          style={{ top, backgroundColor: "#21242E" }}
        />
      ))}
      {gridColumns.map((left) => (
        <div
          key={`grid-column-${left}`}
          className="absolute top-0 h-full w-px"
          style={{ left, backgroundColor: "#21242E" }}
        />
      ))}

      <div
        aria-hidden="true"
        className="absolute left-[48px] top-[16px] whitespace-nowrap text-[96px] font-bold uppercase leading-none"
        style={{
          color: "#1B1E27",
          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
        }}
      >
        {parsed.backgroundTitle}
      </div>

      <div className="absolute left-[68px] top-[50px] z-10">
        <OffsetTitle text={parsed.title} />
        <div className="mt-[22px] h-[6px] w-[88px] bg-[#FF00FF]" />
        <div
          className="mt-[18px] whitespace-nowrap text-[21px] font-bold tracking-[0.12em]"
          style={{
            color: "#B7BAC7",
            fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
          }}
        >
          {parsed.subtitle}
        </div>
      </div>

      <div className="absolute right-[74px] top-[152px] z-10 inline-flex items-center gap-[10px]">
        <div className="flex h-[22px] w-[22px] items-center justify-center">
          <RocketIcon />
        </div>
        <div
          className="inline-flex h-[28px] items-center whitespace-nowrap text-[20px] font-bold leading-none"
          style={{
            color: "#FFFFFF",
            fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
          }}
        >
          {parsed.modeLabel}
        </div>
      </div>

      <div className="absolute left-[68px] top-[220px] z-10 w-[372px]">
        <div className="absolute left-0 top-[8px] h-[356px] w-[3px] bg-[#4A4E59]" />

        <div className="flex flex-col gap-[24px]">
          {parsed.reviewItems.map((item) => {
            const accent = accentPalette[item.accent];

            return (
              <div key={`${item.label}-${item.title}`} className="relative min-h-[102px] pl-[48px]">
                <div
                  className="absolute left-[-10px] top-[4px] h-[22px] w-[22px] rounded-full border-[3px] bg-[#090A11]"
                  style={{
                    borderColor: accent.line,
                    boxShadow: `0 0 14px ${accent.line}`,
                  }}
                />

                <div
                  className="whitespace-nowrap text-[21px] font-bold tracking-[0.12em]"
                  style={{
                    color: "#8D8D94",
                    fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
                  }}
                >
                  {item.label}
                </div>

                <div className="mt-[8px] text-[30px] font-black leading-[1.02] text-white">
                  {item.title}
                </div>

                <div
                  className="mt-[8px] max-w-[308px] text-[14px] font-semibold leading-[1.42]"
                  style={{ color: "#D2D3DA" }}
                >
                  {item.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="absolute left-[504px] right-[38px] top-[236px] z-10 flex flex-col gap-[16px]">
        {parsed.futureCards.map((card) => {
          const accent = accentPalette[card.accent];

          return (
            <div
              key={`${card.title}-${card.tag}`}
              className="relative flex min-h-[114px] items-center overflow-hidden rounded-[6px] border px-[28px] py-[16px]"
              style={{
                borderColor: accent.border,
                backgroundColor: accent.panel,
              }}
            >
              <div
                className="absolute right-0 top-0 h-full w-[6px]"
                style={{ backgroundColor: accent.line }}
              />

              <div
                className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-[12px]"
                style={{ backgroundColor: accent.iconPanel }}
              >
                <FutureIcon icon={card.icon} color={accent.line} />
              </div>

              <div className="ml-[20px] min-w-0 flex-1">
                <div className="flex items-center gap-[16px]">
                  <div className="whitespace-nowrap text-[22px] font-black leading-none text-white">
                    {card.title}
                  </div>
                  <div
                    className="inline-flex h-[28px] items-center rounded-[3px] px-[10px] whitespace-nowrap text-[13px] font-bold leading-none"
                    style={{
                      backgroundColor: accent.badgePanel,
                      color: "#F7F7F9",
                      fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
                    }}
                  >
                    {card.tag}
                  </div>
                </div>

                <div
                  className="mt-[12px] text-[16px] font-semibold leading-[1.45]"
                  style={{ color: accent.muted }}
                >
                  {card.description}
                </div>
              </div>

              <div className="ml-[16px] flex h-[36px] w-[36px] shrink-0 items-center justify-center">
                <ChevronIcon />
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-0 left-0 z-20 flex h-[6px] w-full">
        <div className="h-full w-[35%] bg-[#00F6FF]" />
        <div className="h-full w-[25%] bg-[#FF00FF]" />
        <div className="h-full w-[40%] bg-[#FFD400]" />
      </div>

      <div
        className="absolute bottom-[48px] right-[64px] z-20 inline-flex h-[56px] items-center border px-[16px] whitespace-nowrap text-[19px] font-bold leading-none"
        style={{
          borderColor: "#4E525C",
          color: "#666A75",
          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
        }}
      >
        {parsed.footerLabel}
      </div>
    </AnimeCanvas>
  );
};

export default ConclusionOutlook;
