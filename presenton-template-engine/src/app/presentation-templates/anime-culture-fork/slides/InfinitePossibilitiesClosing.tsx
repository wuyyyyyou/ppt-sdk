import React from "react";
import * as z from "zod";

import AnimeCanvas from "./shared/AnimeCanvas.tsx";

const imageSchema = z
  .object({
    __image_url__: z
      .string()
      .default(
        "https://page.talentsecsite.com/slides_images/b7866a88c9214ac23704d39a6d2de96d.webp",
      ),
    __image_prompt__: z.string().default("Sci-fi city night"),
  })
  .default({
    __image_url__:
      "https://page.talentsecsite.com/slides_images/b7866a88c9214ac23704d39a6d2de96d.webp",
    __image_prompt__: "Sci-fi city night",
  });

export const Schema = z.object({
  backgroundTitle: z.string().default("POSSIBILITIES"),
  title: z.string().default("动漫的无限可能"),
  englishTitle: z.string().default("INFINITE POSSIBILITIES"),
  subtitle: z.string().default("故事 × 技术 × 全球粉丝"),
  ctaText: z.string().default("探索 · 创造 · 协作"),
  statusLabel: z.string().default("SYSTEM_STATUS"),
  statusDivider: z.string().default("//"),
  statusValue: z.string().default("INFINITE_LOOP"),
  backgroundImage: imageSchema,
});

export const layoutId = "infinite-possibilities-closing";
export const layoutName = "Infinite Possibilities Closing";
export const layoutDescription =
  "A final cyberpunk closing slide with layered headline text, concentric neon rings, and a concise call to action.";
export const layoutTags = ["anime", "closing", "transition", "cyberpunk", "neon"];
export const layoutRole = "conclusion";
export const contentElements = ["headline", "background-title", "cta", "status-meta"];
export const useCases = ["closing", "finale", "end-slide", "visual-pause"];
export const suitableFor =
  "Suitable for the final slide of an anime or youth-culture deck when the presentation should end with a strong visual statement and minimal editable text.";
export const avoidFor =
  "Avoid using this layout for dense summaries, chart-heavy content, or slides that need multi-paragraph conclusions.";
export const density = "low";
export const visualWeight = "visual-heavy";
export const editableTextPriority = "high";

const scanlineRows = Array.from({ length: 180 }, (_, index) => index * 4);

const CornerFrame = ({
  position,
  color,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  color: string;
}) => {
  const edgeClass =
    position === "top-left" || position === "bottom-left" ? "left-[34px]" : "right-[34px]";
  const verticalClass =
    position === "top-left" || position === "top-right" ? "top-[34px]" : "bottom-[34px]";
  const horizontalAlign =
    position === "top-left" || position === "bottom-left" ? "left-0" : "right-0";
  const verticalAlign =
    position === "top-left" || position === "top-right" ? "top-0" : "bottom-0";

  return (
    <div className={`absolute ${edgeClass} ${verticalClass} z-20 h-[42px] w-[42px]`}>
      <div
        className={`absolute ${horizontalAlign} ${verticalAlign} h-[3px] w-[42px]`}
        style={{ backgroundColor: color }}
      />
      <div
        className={`absolute ${horizontalAlign} ${verticalAlign} h-[42px] w-[3px]`}
        style={{ backgroundColor: color }}
      />
    </div>
  );
};

const TitleStack = ({ text }: { text: string }) => (
  <div className="relative h-[118px]">
    <div
      aria-hidden="true"
      className="absolute left-[8px] top-[8px] whitespace-nowrap text-[88px] font-black leading-none tracking-[0.06em]"
      style={{ color: "#FF4FD8" }}
    >
      {text}
    </div>
    <div
      aria-hidden="true"
      className="absolute left-[-5px] top-[-5px] whitespace-nowrap text-[88px] font-black leading-none tracking-[0.06em]"
      style={{ color: "#00F6FF" }}
    >
      {text}
    </div>
    <div className="relative whitespace-nowrap text-[88px] font-black leading-none tracking-[0.06em] text-white">
      {text}
    </div>
  </div>
);

const ConcentricRings = () => (
  <div className="absolute inset-0 z-[8] flex items-center justify-center" aria-hidden="true">
    <svg width="760" height="760" viewBox="0 0 760 760" fill="none">
      <circle cx="380" cy="380" r="250" stroke="#183645" strokeWidth="2" />
      <circle cx="380" cy="380" r="236" stroke="#00F6FF" strokeWidth="1.5" strokeDasharray="10 10" />
      <circle cx="380" cy="380" r="188" stroke="#3A173B" strokeWidth="3" />
      <circle cx="380" cy="380" r="172" stroke="#FF4FD8" strokeWidth="1.5" strokeDasharray="22 14" />
      <circle cx="380" cy="380" r="128" stroke="#1A2332" strokeWidth="6" />
      <circle cx="380" cy="380" r="112" stroke="#D8E4EF" strokeWidth="1.2" />
      <circle cx="380" cy="380" r="6" fill="#00F6FF" />
      <circle cx="126" cy="380" r="4" fill="#00F6FF" />
      <circle cx="634" cy="380" r="4" fill="#00F6FF" />
      <circle cx="380" cy="126" r="4" fill="#FF4FD8" />
      <circle cx="380" cy="634" r="4" fill="#FF4FD8" />
    </svg>
  </div>
);

const InfinitePossibilitiesClosing = ({
  data,
}: {
  data: Partial<z.infer<typeof Schema>>;
}) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <AnimeCanvas background="#080910">
      <img
        src={parsed.backgroundImage.__image_url__}
        alt={parsed.backgroundImage.__image_prompt__ || "Infinite possibilities background"}
        className="absolute inset-0 h-full w-full object-cover object-center"
        style={{ opacity: 0.3 }}
      />

      <div className="absolute inset-0 bg-[#05060C]" style={{ opacity: 0.72 }} />
      <div className="absolute left-0 top-0 h-full w-[190px] bg-[#060812]" style={{ opacity: 0.78 }} />
      <div className="absolute right-0 top-0 h-full w-[190px] bg-[#060812]" style={{ opacity: 0.78 }} />
      <div className="absolute inset-x-0 bottom-0 h-[150px] bg-[#05060C]" style={{ opacity: 0.8 }} />

      {scanlineRows.map((top, index) => (
        <div
          key={`scanline-${top}`}
          className="absolute left-0 right-0 h-px"
          style={{
            top,
            backgroundColor: index % 2 === 0 ? "#0C0E15" : "#10131A",
          }}
        />
      ))}

      <div className="absolute left-[56px] top-0 z-10 h-full w-px bg-[#1F2834]" />
      <div className="absolute right-[56px] top-0 z-10 h-full w-px bg-[#1F2834]" />
      <div className="absolute left-0 top-[56px] z-10 h-px w-full bg-[#1F2834]" />
      <div className="absolute bottom-[56px] left-0 z-10 h-px w-full bg-[#1F2834]" />

      <CornerFrame position="top-left" color="#00F6FF" />
      <CornerFrame position="top-right" color="#00F6FF" />
      <CornerFrame position="bottom-left" color="#00F6FF" />
      <CornerFrame position="bottom-right" color="#00F6FF" />

      <ConcentricRings />

      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-[208px] z-[6] text-center whitespace-nowrap text-[148px] font-bold leading-none tracking-[0.16em]"
        style={{
          color: "#121722",
          fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
        }}
      >
        {parsed.backgroundTitle}
      </div>

      <div className="absolute inset-x-0 top-[154px] z-20 flex flex-col items-center">
        <div className="h-[4px] w-[360px] bg-[#00F6FF]" />

        <div className="mt-[26px]">
          <TitleStack text={parsed.title} />
        </div>

        <div
          className="mt-[10px] flex h-[30px] w-[680px] items-center justify-center whitespace-nowrap text-[20px] font-semibold tracking-[0.42em]"
          style={{
            color: "#E8EEF6",
            fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
            textAlign: "center",
          }}
        >
          {parsed.englishTitle}
        </div>

        <div className="mt-[22px] h-[2px] w-[680px] bg-[#FF4FD8]" />

        <div
          className="mt-[22px] flex h-[74px] w-[450px] items-center justify-center rounded-[2px] border px-[44px] whitespace-nowrap text-center text-[28px] font-bold tracking-[0.14em]"
          style={{
            borderColor: "#30475A",
            backgroundColor: "#0E1118",
            color: "#00F6FF",
            textAlign: "center",
          }}
        >
          {parsed.subtitle}
        </div>
      </div>

      <div className="absolute bottom-[102px] left-0 right-0 z-20 flex justify-center">
        <div className="relative">
          <div className="absolute left-[-6px] top-[-6px] h-[12px] w-[12px] bg-[#00F6FF]" />
          <div className="absolute bottom-[-6px] right-[-6px] h-[12px] w-[12px] bg-[#00F6FF]" />
          <div
            className="flex h-[82px] w-[355px] items-center justify-center rounded-[2px] border px-[44px] whitespace-nowrap text-center text-[24px] font-bold tracking-[0.28em] text-white"
            style={{
              borderColor: "#FF4FD8",
              backgroundColor: "#130F19",
              fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
              textAlign: "center",
            }}
          >
            {parsed.ctaText}
          </div>
        </div>
      </div>

      <div className="absolute bottom-[26px] right-[86px] z-20 inline-flex h-[24px] items-center gap-[10px]">
        <div
          className="whitespace-nowrap text-[13px] font-bold tracking-[0.16em]"
          style={{
            color: "#8AEFFF",
            fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
          }}
        >
          {parsed.statusLabel}
        </div>
        <div className="h-[12px] w-px bg-[#35505D]" />
        <div
          className="whitespace-nowrap text-[13px] font-bold tracking-[0.18em]"
          style={{
            color: "#6E7686",
            fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
          }}
        >
          {parsed.statusDivider}
        </div>
        <div className="h-[12px] w-px bg-[#35505D]" />
        <div
          className="whitespace-nowrap text-[13px] font-bold tracking-[0.16em]"
          style={{
            color: "#8AEFFF",
            fontFamily: 'var(--heading-font-family,"Orbitron","Oswald",sans-serif)',
          }}
        >
          {parsed.statusValue}
        </div>
      </div>
    </AnimeCanvas>
  );
};

export default InfinitePossibilitiesClosing;
