import React from "react";
import * as z from "zod";

import AnimeCanvas from "./shared/AnimeCanvas.tsx";

const bulletSchema = z.object({
  label: z.string().default("勇气与正义"),
  text: z.string().default("面对困难不退缩的精神"),
});

const cardSchema = z.object({
  accent: z
    .enum(["magenta", "cyan", "yellow", "green", "purple"])
    .default("magenta"),
  icon: z.enum(["heart", "bolt", "eye", "users", "language"]).default("heart"),
  variant: z.enum(["small", "large"]).default("small"),
  title: z.string().default("价值观"),
  englishTitle: z.string().default("Values"),
  bullets: z.array(bulletSchema).length(3).default([
    { label: "勇气与正义", text: "面对困难不退缩的精神" },
    { label: "友情羁绊", text: "团队合作与彼此信任" },
    { label: "责任感", text: "守护重要之人的决心" },
  ]),
  quote: z.string().default("“如果是为了伙伴，我什么都愿意做！”"),
  quoteSource: z.string().default("—— 蒙奇·D·路飞《海贼王》"),
  statValue: z.string().default(""),
  statLabel: z.string().default(""),
});

export const Schema = z.object({
  backgroundTitle: z.string().default("GROWTH"),
  title: z.string().default("动漫与个人成长"),
  subtitle: z
    .string()
    .default("IMPACT: VALUES, DREAMS & COMMUNITY"),
  statusLabel: z.string().default("AUDIENCE_IMPACT"),
  statusNote: z
    .string()
    .default("ANALYSIS: PSYCHOLOGY & CULTURE"),
  cards: z.array(cardSchema).length(5).default([
    {
      accent: "magenta",
      icon: "heart",
      variant: "small",
      title: "价值观",
      englishTitle: "Values",
      bullets: [
        { label: "勇气与正义", text: "面对困难不退缩的精神" },
        { label: "友情羁绊", text: "团队合作与彼此信任" },
        { label: "责任感", text: "守护重要之人的决心" },
      ],
      quote: "“如果是为了伙伴，我什么都愿意做！”",
      quoteSource: "—— 蒙奇·D·路飞《海贼王》",
      statValue: "",
      statLabel: "",
    },
    {
      accent: "cyan",
      icon: "bolt",
      variant: "small",
      title: "梦想与自律",
      englishTitle: "Dreams",
      bullets: [
        { label: "长期目标", text: "确立人生方向与热血追求" },
        { label: "刻意练习", text: "日常训练与自我超越" },
        { label: "抗挫折力", text: "失败后重新站起的韧性" },
      ],
      quote: "“直到最后一刻都不能放弃。”",
      quoteSource: "—— 安西教练《灌篮高手》",
      statValue: "",
      statLabel: "",
    },
    {
      accent: "yellow",
      icon: "eye",
      variant: "small",
      title: "审美与想象",
      englishTitle: "Aesthetics",
      bullets: [
        { label: "世界观构建", text: "拓展对未来的无限想象" },
        { label: "视觉语言", text: "独特的色彩与构图美学" },
        { label: "情感共鸣", text: "通过画面传达细腻情感" },
      ],
      quote: "“只要走的方向正确，都接近幸福。”",
      quoteSource: "——《千与千寻》",
      statValue: "",
      statLabel: "",
    },
    {
      accent: "green",
      icon: "users",
      variant: "large",
      title: "社交与社群",
      englishTitle: "Social",
      bullets: [
        { label: "同好连接", text: "打破地域限制的兴趣圈层" },
        { label: "漫展文化", text: "Comic Market 与 Cosplay 经济" },
        { label: "二创活力", text: "同人创作激发创造力" },
      ],
      quote: "",
      quoteSource: "",
      statValue: "30M+",
      statLabel: "GLOBAL COMMUNITY",
    },
    {
      accent: "purple",
      icon: "language",
      variant: "large",
      title: "语言与学习",
      englishTitle: "Culture",
      bullets: [
        { label: "语言启蒙", text: "全球日语学习者的第一动力" },
        { label: "跨文化理解", text: "了解日本传统与现代社会" },
        { label: "历史兴趣", text: "通过战国与幕末题材延展历史兴趣" },
      ],
      quote: "",
      quoteSource: "",
      statValue: "TOP 1",
      statLabel: "REASON TO LEARN JP",
    },
  ]),
});

export const layoutId = "personal-growth-matrix";
export const layoutName = "Personal Growth Matrix";
export const layoutDescription =
  "A five-card editorial slide about anime's influence on personal values, discipline, aesthetics, community, and cultural learning.";
export const layoutTags = ["anime", "growth", "culture", "cards", "editorial"];
export const layoutRole = "content";
export const contentElements = ["headline", "card-grid", "quotes", "stat-panels"];
export const useCases = ["cultural-impact", "audience-insight", "personal-growth"];
export const suitableFor =
  "Suitable for impact-analysis slides that summarize several qualitative effects with short supporting bullets and one or two headline stats.";
export const avoidFor =
  "Avoid using this layout for dense quantitative dashboards, long prose pages, or image-led storytelling.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const accentPalette = {
  magenta: {
    line: "#FF4FD8",
    border: "rgba(255,79,216,0.28)",
    panel: "rgba(19,18,26,0.88)",
    iconPanel: "#17111B",
    iconStroke: "#FF4FD8",
    title: "#FF4FD8",
    label: "#F1E3F4",
    body: "#E9E7EE",
    bullet: "#74707B",
    separator: "rgba(255,255,255,0.12)",
    muted: "#8F8696",
    statPanel: "rgba(18,14,22,0.82)",
  },
  cyan: {
    line: "#00F6FF",
    border: "rgba(0,246,255,0.26)",
    panel: "rgba(15,20,28,0.88)",
    iconPanel: "#101924",
    iconStroke: "#00F6FF",
    title: "#00F6FF",
    label: "#DBFBFD",
    body: "#EBF1F6",
    bullet: "#748596",
    separator: "rgba(255,255,255,0.12)",
    muted: "#82909F",
    statPanel: "rgba(12,17,24,0.82)",
  },
  yellow: {
    line: "#FFD24A",
    border: "rgba(255,210,74,0.26)",
    panel: "rgba(23,19,12,0.88)",
    iconPanel: "#1A150D",
    iconStroke: "#FFD24A",
    title: "#FFD24A",
    label: "#FFF1BE",
    body: "#EEE6D6",
    bullet: "#8C8065",
    separator: "rgba(255,255,255,0.12)",
    muted: "#8F836B",
    statPanel: "rgba(23,19,12,0.82)",
  },
  green: {
    line: "#45E688",
    border: "rgba(69,230,136,0.24)",
    panel: "rgba(12,22,17,0.9)",
    iconPanel: "#102018",
    iconStroke: "#45E688",
    title: "#45E688",
    label: "#DDF8E7",
    body: "#E7F0EA",
    bullet: "#6F8F7B",
    separator: "rgba(255,255,255,0.12)",
    muted: "#7F9E89",
    statPanel: "rgba(13,20,15,0.82)",
  },
  purple: {
    line: "#B15CFF",
    border: "rgba(177,92,255,0.28)",
    panel: "rgba(22,16,30,0.9)",
    iconPanel: "#17111F",
    iconStroke: "#B15CFF",
    title: "#C98CFF",
    label: "#F0E4FF",
    body: "#ECE5F6",
    bullet: "#85789A",
    separator: "rgba(255,255,255,0.12)",
    muted: "#90839E",
    statPanel: "rgba(21,15,28,0.82)",
  },
} as const;

const gridColumns = Array.from({ length: 33 }, (_, index) => index * 40);
const gridRows = Array.from({ length: 19 }, (_, index) => index * 40);

const PeopleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" aria-hidden="true">
    <circle cx="12" cy="8" r="2.8" fill="#00F6FF" />
    <circle cx="6.9" cy="10.6" r="2.1" fill="#00F6FF" />
    <circle cx="17.1" cy="10.6" r="2.1" fill="#00F6FF" />
    <path d="M5 19c0-2.4 2.8-4.3 7-4.3s7 1.9 7 4.3" fill="#00F6FF" />
  </svg>
);

const HeartIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <path
      d="M12 19.8 5.9 13.7a4.4 4.4 0 0 1 6.2-6.2l.2.2.2-.2a4.4 4.4 0 1 1 6.2 6.2L12 19.8Z"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

const BoltIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <path
      d="M13.5 3 6.8 12.1h4.8l-1.1 8.9 6.7-9.1h-4.8L13.5 3Z"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

const EyeIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <path
      d="M2.8 12c2.1-3.5 5.4-5.3 9.2-5.3s7.1 1.8 9.2 5.3c-2.1 3.5-5.4 5.3-9.2 5.3S4.9 15.5 2.8 12Z"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="2.6" fill="none" stroke={color} strokeWidth="2" />
  </svg>
);

const UsersIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <circle cx="12" cy="8.1" r="2.6" fill="none" stroke={color} strokeWidth="2" />
    <circle cx="6.8" cy="10.7" r="1.9" fill="none" stroke={color} strokeWidth="2" />
    <circle cx="17.2" cy="10.7" r="1.9" fill="none" stroke={color} strokeWidth="2" />
    <path
      d="M5.1 18.6c.3-2.3 2.8-3.9 6.9-3.9s6.6 1.6 6.9 3.9M3.8 17.9c.2-1.4 1.3-2.6 3.2-3.1M17 14.8c1.9.5 3 1.7 3.2 3.1"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LanguageIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <path
      d="M5 6.2h8.7M9.3 6.2c0 4.5-1.8 8-4.3 10.1M7.2 10.7c1.3 1.8 3 3.3 5 4.4M15.8 7.7l3.5 9.1M14.6 13.4h4.4"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CardIcon = ({
  icon,
  color,
}: {
  icon: z.infer<typeof cardSchema>["icon"];
  color: string;
}) => {
  switch (icon) {
    case "heart":
      return <HeartIcon color={color} />;
    case "bolt":
      return <BoltIcon color={color} />;
    case "eye":
      return <EyeIcon color={color} />;
    case "users":
      return <UsersIcon color={color} />;
    case "language":
      return <LanguageIcon color={color} />;
  }
};

const CornerMark = ({
  position,
  color,
}: {
  position: "top-left" | "bottom-right";
  color: string;
}) => {
  if (position === "top-left") {
    return (
      <div className="absolute left-[10px] top-[10px]">
        <div className="absolute left-0 top-0 h-[3px] w-[18px]" style={{ backgroundColor: color }} />
        <div className="absolute left-0 top-0 h-[18px] w-[3px]" style={{ backgroundColor: color }} />
      </div>
    );
  }

  return (
    <div className="absolute bottom-[10px] right-[10px]">
      <div className="absolute bottom-0 right-0 h-[3px] w-[18px]" style={{ backgroundColor: color }} />
      <div className="absolute bottom-0 right-0 h-[18px] w-[3px]" style={{ backgroundColor: color }} />
    </div>
  );
};

const TitleBlock = ({
  backgroundTitle,
  title,
  subtitle,
}: {
  backgroundTitle: string;
  title: string;
  subtitle: string;
}) => (
  <div className="relative z-10">
    <div
      aria-hidden="true"
      className="absolute left-0 top-[-6px] whitespace-nowrap text-[66px] font-bold leading-none tracking-[0.04em]"
      style={{
        color: "#252A36",
        fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
      }}
    >
      {backgroundTitle}
    </div>
    <div className="relative pt-[26px]">
      <div
        aria-hidden="true"
        className="absolute left-[5px] top-[28px] whitespace-nowrap text-[46px] font-black tracking-[0.01em]"
        style={{ color: "#00F6FF" }}
      >
        {title}
      </div>
      <div className="relative whitespace-nowrap text-[46px] font-black tracking-[0.01em] text-white">
        {title}
      </div>
      <div className="mt-[12px] h-[6px] w-[112px] bg-[#FF00FF]" />
      <div
        className="mt-[16px] whitespace-nowrap text-[13px] font-bold tracking-[0.14em]"
        style={{
          color: "#A8AFBC",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }}
      >
        {subtitle}
      </div>
    </div>
  </div>
);

const StatusPanel = ({
  label,
  note,
}: {
  label: string;
  note: string;
}) => (
  <div className="flex flex-col items-end">
    <div className="inline-flex h-[24px] items-center gap-[10px]">
      <div className="flex h-[16px] w-[16px] items-center justify-center">
        <PeopleIcon />
      </div>
      <div
        className="whitespace-nowrap text-[16px] font-bold tracking-[0.04em]"
        style={{
          color: "#F3F4F7",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }}
      >
        {label}
      </div>
    </div>
    <div
      className="mt-[8px] whitespace-nowrap text-[11px] font-medium tracking-[0.03em]"
      style={{ color: "#7D8493" }}
    >
      {note}
    </div>
  </div>
);

const ImpactCard = ({
  card,
}: {
  card: z.infer<typeof cardSchema>;
} & React.Attributes) => {
  const accent = accentPalette[card.accent];
  const isLarge = card.variant === "large";

  return (
    <div
      className={`relative flex h-full overflow-hidden rounded-[2px] border ${
        isLarge ? "col-span-3" : "col-span-2"
      }`}
      style={{
        borderColor: accent.border,
        backgroundColor: accent.panel,
      }}
    >
      <div
        className="absolute left-0 right-0 top-0 h-[3px]"
        style={{ backgroundColor: accent.line }}
      />
      <CornerMark
        position={isLarge ? "bottom-right" : "top-left"}
        color={accent.line}
      />

      <div className="relative z-10 flex h-full w-full flex-col px-[20px] pb-[14px] pt-[20px]">
        <div className="flex items-center gap-[14px]">
          <div
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[8px] border"
            style={{
              borderColor: accent.line,
              backgroundColor: accent.iconPanel,
              boxShadow: `0 0 14px ${accent.line}33`,
            }}
          >
            <CardIcon icon={card.icon} color={accent.iconStroke} />
          </div>

          <div className="min-w-0">
            <div className="flex items-end gap-[10px]">
              <div
                className="whitespace-nowrap text-[18px] font-black leading-none"
                style={{ color: accent.title }}
              >
                {card.title}
              </div>
              <div
                className="whitespace-nowrap text-[16px] font-bold leading-none"
                style={{
                  color: accent.title,
                  fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
                }}
              >
                {card.englishTitle.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        <div
          className="mt-[12px] h-px w-full"
          style={{ backgroundColor: accent.separator }}
        />

        {isLarge ? (
          <div className="mt-[12px] grid flex-1 grid-cols-[1fr_1px_172px] gap-[14px]">
            <div className="grid gap-[10px] self-start">
              {card.bullets.map((bullet) => (
                <div
                  key={`${card.title}-${bullet.label}`}
                  className="grid grid-cols-[18px_108px_1fr] items-start gap-[10px]"
                >
                  <div
                    className="pt-[1px] text-[14px] font-black leading-none"
                    style={{ color: accent.bullet }}
                  >
                    &gt;
                  </div>
                  <div
                    className="text-[14px] font-black leading-[1.35] whitespace-nowrap"
                    style={{ color: accent.label }}
                  >
                    {bullet.label}:
                  </div>
                  <div
                    className="pt-[1px] text-[14px] leading-[1.42]"
                    style={{ color: accent.body }}
                  >
                    {bullet.text}
                  </div>
                </div>
              ))}
            </div>

            <div
              className="h-full w-px"
              style={{ backgroundColor: accent.separator }}
            />

            <div className="flex items-center justify-center pl-[6px]">
              <div
                className="flex h-[112px] w-[142px] flex-col items-center justify-center rounded-[16px] border"
                style={{
                  borderColor: accent.border,
                  backgroundColor: accent.statPanel,
                }}
              >
                <div
                  className="whitespace-nowrap text-[40px] font-bold leading-none"
                  style={{
                    color: accent.line,
                    fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
                  }}
                >
                  {card.statValue}
                </div>
                <div
                  className="mt-[10px] text-center text-[11px] font-bold leading-[1.35] tracking-[0.12em]"
                  style={{ color: accent.muted }}
                >
                  {card.statLabel}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-[12px] flex flex-1 flex-col">
            <div className="grid gap-[8px]">
              {card.bullets.map((bullet) => (
                <div
                  key={`${card.title}-${bullet.label}`}
                  className="grid grid-cols-[18px_110px_1fr] items-start gap-[8px]"
                >
                  <div
                    className="pt-[1px] text-[14px] font-black leading-none"
                    style={{ color: accent.bullet }}
                  >
                    &gt;
                  </div>
                  <div
                    className="whitespace-nowrap text-[14px] font-black leading-[1.35]"
                    style={{ color: accent.label }}
                  >
                    {bullet.label}:
                  </div>
                  <div
                    className="text-[14px] leading-[1.35]"
                    style={{ color: accent.body }}
                  >
                    {bullet.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-[12px]">
              <div
                className="mb-[10px] h-px w-full"
                style={{ backgroundColor: accent.separator, borderStyle: "dashed" }}
              />
              <div
                className="text-[14px] italic leading-[1.45]"
                style={{ color: "#C8CCD4" }}
              >
                {card.quote}
              </div>
              <div
                className="mt-[6px] text-right text-[11px] font-bold italic tracking-[0.02em]"
                style={{ color: accent.muted }}
              >
                {card.quoteSource}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PersonalGrowthMatrix = ({
  data,
}: {
  data: Partial<z.infer<typeof Schema>>;
}) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <AnimeCanvas background="#090A11">
      <div className="absolute inset-0 bg-[#0A0A0F]" />

      <div className="absolute inset-0">
        {gridRows.map((top) => (
          <div
            key={`grid-row-${top}`}
            className="absolute left-0 h-px w-full"
            style={{ top, backgroundColor: "rgba(255,255,255,0.018)" }}
          />
        ))}
        {gridColumns.map((left) => (
          <div
            key={`grid-column-${left}`}
            className="absolute top-0 h-full w-px"
            style={{ left, backgroundColor: "rgba(255,255,255,0.015)" }}
          />
        ))}
      </div>

      <div
        className="absolute left-0 right-0 top-[154px] h-px"
        style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
      />

      <div className="absolute left-[16px] right-[16px] top-[10px] z-10 flex items-start justify-between">
        <TitleBlock
          backgroundTitle={parsed.backgroundTitle}
          title={parsed.title}
          subtitle={parsed.subtitle}
        />
        <div className="pt-[76px]">
          <StatusPanel label={parsed.statusLabel} note={parsed.statusNote} />
        </div>
      </div>

      <div className="absolute left-[16px] right-[16px] top-[180px] bottom-[16px] z-10 grid grid-cols-6 grid-rows-2 gap-[16px]">
        {parsed.cards.map((card) => (
          <ImpactCard
            key={`${card.title}-${card.englishTitle}-${card.variant}`}
            card={card}
          />
        ))}
      </div>
    </AnimeCanvas>
  );
};

export default PersonalGrowthMatrix;
