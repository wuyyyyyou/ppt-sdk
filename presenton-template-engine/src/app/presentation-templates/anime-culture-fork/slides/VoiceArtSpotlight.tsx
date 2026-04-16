import React from "react";
import * as z from "zod";

import AnimeCanvas from "./shared/AnimeCanvas.tsx";

const imageSchema = (url: string, prompt: string) =>
  z
    .object({
      __image_url__: z.string().default(url),
      __image_prompt__: z.string().default(prompt),
    })
    .default({
      __image_url__: url,
      __image_prompt__: prompt,
    });

const voiceActorSchema = z.object({
  accent: z.enum(["pink", "cyan", "yellow"]).default("cyan"),
  name: z.string().default("KANA HANAZAWA"),
  nativeName: z.string().default("花澤 香菜"),
  honorTitle: z.string().default("ANGELIC VOICE"),
  worksLabel: z.string().default("REPRESENTATIVE WORKS"),
  works: z.array(z.string()).min(2).max(3).default(["《作品 A》", "《作品 B》"]),
  description: z
    .string()
    .default("通过极具辨识度的声线与情绪控制，为角色注入真实灵魂与鲜明个性。"),
  image: imageSchema(
    "https://www.talentsec.ai/image_placeholder.png",
    "Anime voice actor portrait placeholder",
  ),
});

export const Schema = z.object({
  backgroundTitle: z.string().default("VOICE ART"),
  title: z.string().default("动漫配音艺术"),
  subtitle: z.string().default("SEIYUU CULTURE & PERFORMANCE"),
  signalLabel: z.string().default("CULTURE_DEPTH"),
  signalValue: z.string().default("SOUL OF ANIME"),
  voiceActors: z.array(voiceActorSchema).length(3).default([
    {
      accent: "pink",
      name: "KANA HANAZAWA",
      nativeName: "花澤 香菜",
      honorTitle: "ANGELIC VOICE",
      worksLabel: "REPRESENTATIVE WORKS",
      works: ["《PSYCHO-PASS》常守朱", "《化物语》千石抚子"],
      description:
        "拥有温暖清澈的治愈声线，以细腻情感让角色具备真实温度与沉浸感。",
      image: {
        __image_url__: "https://www.talentsec.ai/image_placeholder.png",
        __image_prompt__: "Kana Hanazawa portrait placeholder",
      },
    },
    {
      accent: "cyan",
      name: "HIROSHI KAMIYA",
      nativeName: "神谷 浩史",
      honorTitle: "PRECISION MASTER",
      worksLabel: "REPRESENTATIVE WORKS",
      works: ["《进击的巨人》利威尔", "《物语系列》阿良良木历"],
      description:
        "以冷静精准的台词节奏著称，展现了声优作为专业声音演员的控制力与层次感。",
      image: {
        __image_url__: "https://www.talentsec.ai/image_placeholder.png",
        __image_prompt__: "Hiroshi Kamiya portrait placeholder",
      },
    },
    {
      accent: "yellow",
      name: "RIE KUGIMIYA",
      nativeName: "釘宮 理恵",
      honorTitle: "TSUNDERE QUEEN",
      worksLabel: "REPRESENTATIVE WORKS",
      works: ["《龙与虎》逢坂大河", "《零之使魔》露易丝"],
      description:
        "把声优影响力延展到粉丝文化与舞台活动，证明配音表演也是驱动 IP 情感经济的核心力量。",
      image: {
        __image_url__: "https://www.talentsec.ai/image_placeholder.png",
        __image_prompt__: "Rie Kugimiya portrait placeholder",
      },
    },
  ]),
});

export const layoutId = "voice-art-spotlight";
export const layoutName = "Voice Art Spotlight";
export const layoutDescription =
  "A three-card seiyuu spotlight slide with portrait-led panels, editorial metadata, and concise descriptions of voice performance styles.";
export const layoutTags = ["anime", "voice-actor", "seiyuu", "profile-cards", "editorial"];
export const layoutRole = "content";
export const contentElements = ["headline", "status-tag", "profile-cards", "portraits"];
export const useCases = ["voice-actor-overview", "culture-spotlight", "people-highlights"];
export const suitableFor =
  "Suitable for showcasing notable voice actors, performers, or character interpreters with representative works and a short artistic summary.";
export const avoidFor =
  "Avoid using this layout for dense statistics, timeline explanations, or slides that require more than three long biographies.";
export const density = "medium";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const accentPalette = {
  pink: {
    line: "#FF77FF",
    title: "#FF77FF",
    border: "#403047",
    panel: "#14141A",
    imageTint: "rgba(8,8,12,0.18)",
    titlePanel: "rgba(16,14,20,0.78)",
    contentPanel: "rgba(16,14,20,0.90)",
    badgeBackground: "#231824",
    badgeBorder: "#654268",
    badgeText: "#FFB8FF",
    descriptionBorder: "#2F2735",
    descriptionText: "#B8B5C4",
    label: "#8F8B9B",
  },
  cyan: {
    line: "#00F6FF",
    title: "#00F6FF",
    border: "#2A3E46",
    panel: "#13171C",
    imageTint: "rgba(7,10,12,0.16)",
    titlePanel: "rgba(10,18,22,0.76)",
    contentPanel: "rgba(11,19,24,0.90)",
    badgeBackground: "#122129",
    badgeBorder: "#28515E",
    badgeText: "#A7FBFF",
    descriptionBorder: "#25323B",
    descriptionText: "#AEBCC7",
    label: "#8A96A2",
  },
  yellow: {
    line: "#FFD700",
    title: "#FFD700",
    border: "#463D24",
    panel: "#17161A",
    imageTint: "rgba(10,10,10,0.16)",
    titlePanel: "rgba(20,18,14,0.76)",
    contentPanel: "rgba(22,18,14,0.90)",
    badgeBackground: "#262012",
    badgeBorder: "#66542A",
    badgeText: "#FFE58D",
    descriptionBorder: "#363024",
    descriptionText: "#C4BDA7",
    label: "#978E77",
  },
} as const;

const gridColumns = Array.from({ length: 33 }, (_, index) => index * 40);
const gridRows = Array.from({ length: 19 }, (_, index) => index * 40);

const monoFontFamily =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const MicrophoneIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" aria-hidden="true">
    <rect x="8" y="3" width="8" height="12" rx="4" fill="none" stroke="#00F6FF" strokeWidth="2" />
    <path
      d="M6.5 11.5c0 3.1 2.4 5.5 5.5 5.5s5.5-2.4 5.5-5.5M12 17v4M9 21h6"
      fill="none"
      stroke="#00F6FF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const QuoteIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" aria-hidden="true">
    <path
      d="M7.5 7.2c-1.8 1-3 2.6-3 4.8 0 2 1.3 3.8 3.3 3.8 1.9 0 3.2-1.4 3.2-3.2 0-1.7-1.1-3-2.6-3.2.2-.8.8-1.5 1.8-2.2l-2.7 0ZM16.2 7.2c-1.8 1-3 2.6-3 4.8 0 2 1.3 3.8 3.3 3.8 1.9 0 3.2-1.4 3.2-3.2 0-1.7-1.1-3-2.6-3.2.2-.8.8-1.5 1.8-2.2l-2.7 0Z"
      fill={color}
    />
  </svg>
);

const CornerMark = ({
  position,
  color,
}: {
  position: "top-right" | "bottom-left";
  color: string;
}) => {
  if (position === "top-right") {
    return (
      <div className="absolute right-[10px] top-[10px] z-30 h-[20px] w-[20px]">
        <div className="absolute right-0 top-0 h-[3px] w-[20px]" style={{ backgroundColor: color }} />
        <div className="absolute right-0 top-0 h-[20px] w-[3px]" style={{ backgroundColor: color }} />
      </div>
    );
  }

  return (
    <div className="absolute bottom-[10px] left-[10px] z-30 h-[20px] w-[20px]">
      <div className="absolute bottom-0 left-0 h-[3px] w-[20px]" style={{ backgroundColor: color }} />
      <div className="absolute bottom-0 left-0 h-[20px] w-[3px]" style={{ backgroundColor: color }} />
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
      className="absolute left-0 top-[-10px] whitespace-nowrap text-[80px] font-bold uppercase leading-none tracking-[0.03em]"
      style={{
        color: "#191D26",
        fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
      }}
    >
      {backgroundTitle}
    </div>
    <div className="relative pt-[26px]">
      <div
        aria-hidden="true"
        className="absolute left-[5px] top-[30px] whitespace-nowrap text-[40px] font-black tracking-[0.03em]"
        style={{ color: "#00F6FF" }}
      >
        {title}
      </div>
      <div className="relative whitespace-nowrap text-[40px] font-black tracking-[0.03em] text-white">
        {title}
      </div>
      <div className="mt-[8px] h-[4px] w-[84px] bg-[#FF00FF]" />
      <div
        className="mt-[10px] whitespace-nowrap text-[13px] font-bold tracking-[0.26em]"
        style={{ color: "#8B96A9", fontFamily: monoFontFamily }}
      >
        {subtitle}
      </div>
    </div>
  </div>
);

const SignalTag = ({ label, value }: { label: string; value: string }) => (
  <div className="relative z-10 flex flex-col items-end gap-[8px]">
    <div
      className="inline-flex h-[34px] items-center gap-[10px] rounded-[6px] border px-[12px]"
      style={{ borderColor: "#22384A", backgroundColor: "#0B1218" }}
    >
      <div className="flex h-[18px] w-[18px] items-center justify-center">
        <MicrophoneIcon />
      </div>
      <div
        className="whitespace-nowrap text-[12px] font-bold tracking-[0.22em]"
        style={{ color: "#00F6FF", fontFamily: monoFontFamily }}
      >
        {label}
      </div>
    </div>
    <div
      className="whitespace-nowrap text-[11px] font-bold tracking-[0.24em]"
      style={{ color: "#586071", fontFamily: monoFontFamily }}
    >
      {value}
    </div>
  </div>
);

const VoiceActorCard = ({
  actor,
}: {
  actor: z.infer<typeof voiceActorSchema>;
}) => {
  const palette = accentPalette[actor.accent];
  const imageUrl = actor.image.__image_url__;

  return (
    <div
      className="relative h-[470px] overflow-hidden border"
      style={{
        width: "376px",
        borderColor: palette.border,
        backgroundColor: palette.panel,
      }}
    >
      <div className="absolute left-0 top-0 h-[4px] w-full" style={{ backgroundColor: palette.line }} />
      <CornerMark position="top-right" color={palette.line} />
      <CornerMark position="bottom-left" color={palette.line} />

      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full"
          style={{ objectFit: "cover", objectPosition: "center top" }}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: "#181A22", color: "#6E7583" }}
        >
          PORTRAIT
        </div>
      )}

      <div className="absolute inset-0" style={{ backgroundColor: palette.imageTint }} />

      <div
        className="absolute left-0 top-[160px] w-full px-[18px] pb-[16px] pt-[18px]"
        style={{ backgroundColor: palette.titlePanel }}
      >
        <div
          className="whitespace-nowrap text-[27px] font-bold uppercase leading-[0.92]"
          style={{
            color: palette.title,
            fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
          }}
        >
          {actor.name}
        </div>
        <div className="mt-[4px] whitespace-nowrap text-[13px] font-medium tracking-[0.18em] text-white">
          {actor.nativeName}
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 h-[242px] w-full border-t px-[18px] py-[16px]"
        style={{
          borderColor: palette.descriptionBorder,
          backgroundColor: palette.contentPanel,
        }}
      >
        <div className="flex h-full flex-col">
          <div
            className="inline-flex h-[28px] items-center rounded-[4px] border px-[10px]"
            style={{
              borderColor: palette.badgeBorder,
              backgroundColor: palette.badgeBackground,
            }}
          >
            <div className="whitespace-nowrap text-[11px] font-bold tracking-[0.12em]" style={{ color: palette.badgeText }}>
              {actor.honorTitle}
            </div>
          </div>

          <div className="mt-[14px]">
            <div
              className="whitespace-nowrap text-[11px] font-bold tracking-[0.22em]"
              style={{
                color: palette.label,
                fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
              }}
            >
              {actor.worksLabel}
            </div>
            <div className="mt-[7px] grid gap-[5px]">
              {actor.works.map((work, index) => (
                <div key={`${index}-${work}`} className="text-[15px] font-medium leading-[1.35] text-white">
                  {work}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto border-t pt-[14px]" style={{ borderColor: palette.descriptionBorder }}>
            <div className="flex items-start gap-[10px]">
              <div className="mt-[2px] flex h-[16px] w-[16px] shrink-0 items-center justify-center">
                <QuoteIcon color={palette.line} />
              </div>
              <div className="text-[14px] leading-[1.55]" style={{ color: palette.descriptionText }}>
                {actor.description}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const VoiceArtSpotlight = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <AnimeCanvas background="#0A0A0F">
      <div className="absolute inset-0 bg-[#0A0A0F]" />
      <div className="absolute left-0 top-0 h-full w-[712px] bg-[#080A10]" />
      <div className="absolute right-0 top-0 h-full w-[568px] bg-[#10131C]" />

      {gridRows.map((top) => (
        <div
          key={`grid-row-${top}`}
          className="absolute left-0 h-px w-full"
          style={{ top, backgroundColor: "#1A1E28" }}
        />
      ))}
      {gridColumns.map((left) => (
        <div
          key={`grid-column-${left}`}
          className="absolute top-0 h-full w-px"
          style={{ left, backgroundColor: "#1A1E28" }}
        />
      ))}

      <div className="absolute left-0 top-[354px] h-px w-full bg-[#202531]" />

      <div className="absolute left-[54px] top-[52px] h-[54px] w-[54px] border border-[#202431]" />
      <div className="absolute right-[58px] top-[110px] h-[54px] w-[54px] border border-[#202431]" />

      <div className="absolute left-[64px] top-[22px]">
        <TitleBlock
          backgroundTitle={parsed.backgroundTitle}
          title={parsed.title}
          subtitle={parsed.subtitle}
        />
      </div>

      <div className="absolute right-[64px] top-[42px]">
        <SignalTag label={parsed.signalLabel} value={parsed.signalValue} />
      </div>

      <div className="absolute left-[54px] top-[214px] grid grid-cols-3 gap-[22px]">
        {parsed.voiceActors.map((actor, index) => (
          <VoiceActorCard key={`${index}-${actor.name}`} actor={actor} />
        ))}
      </div>
    </AnimeCanvas>
  );
};

export default VoiceArtSpotlight;
