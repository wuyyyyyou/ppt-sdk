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

const agendaItemSchema = z.object({
  number: z.string().default("01"),
  title: z.string().default("封面"),
  subtitle: z.string().default("COVER"),
  highlighted: z.boolean().default(false),
});

export const Schema = z.object({
  title: z.string().default("INDEX"),
  subtitle: z.string().default("目录概览 CONTENT OVERVIEW"),
  sideMark: z.string().default("目次"),
  footerTag: z.string().default("ANIME FILE / 02"),
  items: z.array(agendaItemSchema).default([
    { number: "01", title: "封面", subtitle: "COVER", highlighted: false },
    { number: "02", title: "动漫历史", subtitle: "HISTORY", highlighted: true },
    { number: "03", title: "经典作品", subtitle: "CLASSICS", highlighted: false },
    { number: "04", title: "产业现状", subtitle: "INDUSTRY", highlighted: false },
    { number: "05", title: "文化影响", subtitle: "INFLUENCE", highlighted: false },
    { number: "06", title: "未来展望", subtitle: "FUTURE", highlighted: false },
  ]),
  topImage: imageSchema(
    "https://commons.wikimedia.org/wiki/Special:FilePath/Akihabara%20-09.jpg",
    "Akihabara streetscape",
  ),
  bottomImage: imageSchema(
    "https://commons.wikimedia.org/wiki/Special:FilePath/Anime%20Center%20%40%20Akiba%20ICHI%20%40%20Akihabara%20%289479831876%29.jpg",
    "Anime Center at Akihabara",
  ),
  accentImage: imageSchema(
    "https://commons.wikimedia.org/wiki/Special:FilePath/Anime%20Contents%20Expo%2020130331b.jpg",
    "Anime Contents Expo exhibition hall",
  ),
});

export const layoutId = "agenda-collage";
export const layoutName = "Agenda Collage";
export const layoutDescription =
  "A split-layout agenda slide with a numbered list on the left and a three-image anime collage on the right.";
export const layoutTags = ["agenda", "anime", "split-layout", "collage"];
export const layoutRole = "agenda";
export const contentElements = ["numbered-list", "image-collage", "title"];
export const useCases = ["agenda", "table-of-contents", "section-overview"];
export const suitableFor =
  "Suitable for agenda and chapter overview pages when the deck needs both structure and visual mood.";
export const avoidFor =
  "Avoid using this layout for dense explanation, metrics, or long body copy.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const AgendaCollage = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const gridColumns = Array.from({ length: 17 }, (_, index) => index * 44);
  const gridRows = Array.from({ length: 17 }, (_, index) => index * 44);

  return (
    <AnimeCanvas background="#0A0A14">
      <div className="absolute left-0 top-0 h-full w-[576px] bg-[#080A12]" />
      <div className="absolute left-[576px] top-0 h-full w-[4px] bg-[#FF00FF]" />

      <div className="absolute right-0 top-0 h-full w-[704px] bg-[#1B1B31]" />
      <div className="absolute right-0 top-0 h-full w-[704px] overflow-hidden">
        {gridRows.map((top) => (
          <div
            key={`grid-row-${top}`}
            className="absolute left-0 h-px w-full"
            style={{ top, backgroundColor: "rgba(255,255,255,0.06)" }}
          />
        ))}
        {gridColumns.map((left) => (
          <div
            key={`grid-column-${left}`}
            className="absolute top-0 h-full w-px"
            style={{ left, backgroundColor: "rgba(255,255,255,0.06)" }}
          />
        ))}
      </div>

      <div
        className="absolute left-[52px] top-[28px] z-10 text-[102px] font-bold leading-none tracking-[0.03em]"
        style={{
          color: "#FFFFFF",
          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
          WebkitTextStroke: "2px #FFFFFF",
          textShadow: "5px 0 0 rgba(34,234,244,0.92)",
        }}
      >
        {parsed.title}
      </div>

      <div className="absolute left-[52px] top-[218px] z-10 flex items-center gap-[14px]">
        <div
          className="text-[29px] font-black tracking-[0.16em]"
          style={{ color: "#FF00FF" }}
        >
          {parsed.subtitle}
        </div>
        <div
          className="h-[3px] w-[110px]"
          style={{ boxShadow: "0 0 10px rgba(255,0,255,0.75)", backgroundColor: "#FF00FF" }}
        />
      </div>

      <div className="absolute left-[74px] top-[282px] z-10 grid gap-[28px]">
        {parsed.items.map((item) => (
          <div key={item.number} className="flex items-center gap-[26px]">
            <div
              className="w-[44px] text-center text-[46px] font-bold leading-none"
              style={{
                color: "#19F0FF",
                textShadow: "0 0 12px rgba(25,240,255,0.72)",
                fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
              }}
            >
              {item.number}
            </div>
            <div className="h-[38px] w-px bg-white/18" />
            <div className="text-[24px] font-semibold tracking-[0.02em] text-white">
              {item.title} / {item.subtitle}
            </div>
          </div>
        ))}
      </div>

      <img
        src={parsed.topImage.__image_url__}
        alt={parsed.topImage.__image_prompt__ || "Anime collage top image"}
        className="absolute right-[18px] top-[0] z-10 h-[328px] w-[492px] object-cover"
      />
      <div className="absolute right-[176px] top-0 z-20 h-full w-[3px] bg-[#22EAF4]/55 shadow-[0_0_12px_rgba(34,234,244,0.6)]" />

      <div className="absolute left-[790px] top-[510px] z-10 h-[5px] w-[366px] bg-[#22EAF4]/78" />
      <div className="absolute left-[876px] top-[570px] z-10 h-[3px] w-[316px] bg-white/18" />

      <div className="absolute left-[614px] top-[518px] z-20 h-[194px] w-[326px] overflow-hidden border-[4px] border-[#22EAF4] bg-black">
        <img
          src={parsed.bottomImage.__image_url__}
          alt={parsed.bottomImage.__image_prompt__ || "Anime collage bottom image"}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="absolute left-[844px] top-[248px] z-30 h-[336px] w-[296px] bg-black/38 shadow-[16px_16px_0_rgba(0,0,0,0.34)]" />
      <div className="absolute left-[826px] top-[232px] z-40 h-[336px] w-[296px] overflow-hidden border-[6px] border-[#FF00FF] bg-black">
        <img
          src={parsed.accentImage.__image_url__}
          alt={parsed.accentImage.__image_prompt__ || "Anime collage accent image"}
          className="h-full w-full object-cover"
        />
      </div>

      <div
        className="absolute bottom-[42px] right-[32px] z-30 flex h-[48px] w-[210px] items-center justify-center border text-[14px] font-black tracking-[0.16em]"
        style={{
          borderColor: "rgba(255,255,255,0.55)",
          backgroundColor: "rgba(0,0,0,0.28)",
          color: "#22EAF4",
          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
        }}
      >
        {parsed.footerTag}
      </div>
    </AnimeCanvas>
  );
};

export default AgendaCollage;
