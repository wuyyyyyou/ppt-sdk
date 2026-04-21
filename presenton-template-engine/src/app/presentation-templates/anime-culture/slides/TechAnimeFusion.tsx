import React from "react";
import * as z from "zod";

import AnimeCanvas from "./shared/AnimeCanvas.tsx";

const fusionStepSchema = z.object({
  number: z.string().default("01"),
  title: z.string().default("企划・委员会"),
  description: z.string().default("传统项目立项流程。"),
  icon: z
    .enum(["handshake", "script", "layers", "palette", "motion", "magic", "voice", "vr"])
    .default("handshake"),
  mode: z.enum(["standard", "enhanced"]).default("standard"),
  tags: z.array(z.string()).default([]),
});

export const Schema = z.object({
  backgroundTitle: z.string().default("TECH x ANIME"),
  title: z.string().default("动漫与科技融合"),
  subtitle: z.string().default("AI / VIRTUAL PRODUCTION / VR / AR INTEGRATION"),
  systemLabel: z.string().default("SYSTEM UPGRADE"),
  systemProgress: z.number().min(0).max(100).default(75),
  footerTag: z.string().default("ANIME FILE / 18"),
  steps: z.array(fusionStepSchema).length(8).default([
    {
      number: "01",
      title: "企划・委员会",
      description: "传统项目立项流程。",
      icon: "handshake",
      mode: "standard",
      tags: [],
    },
    {
      number: "02",
      title: "脚本・系列构成",
      description: "剧本与台词创作。",
      icon: "script",
      mode: "standard",
      tags: [],
    },
    {
      number: "03",
      title: "分镜・演出",
      description: "引入 AI 辅助布局与 3D 预演。",
      icon: "layers",
      mode: "enhanced",
      tags: ["AI 布局", "预演"],
    },
    {
      number: "04",
      title: "角色・设定",
      description: "美术风格设定。",
      icon: "palette",
      mode: "standard",
      tags: [],
    },
    {
      number: "05",
      title: "原画・动画",
      description: "动作捕捉与 AI 辅助补帧技术。",
      icon: "motion",
      mode: "enhanced",
      tags: ["AI 中割", "动捕术"],
    },
    {
      number: "06",
      title: "上色・摄影",
      description: "自动上色工具与虚拟制片背景。",
      icon: "magic",
      mode: "enhanced",
      tags: ["自动色", "虚拟屏"],
    },
    {
      number: "07",
      title: "配音・音效",
      description: "声优配音与音效合成。",
      icon: "voice",
      mode: "standard",
      tags: [],
    },
    {
      number: "08",
      title: "宣发・体验",
      description: "VR/AR 沉浸式内容分发。",
      icon: "vr",
      mode: "enhanced",
      tags: ["VR 观影", "AR 特效"],
    },
  ]),
});

export const layoutId = "tech-anime-fusion";
export const layoutName = "Tech Anime Fusion";
export const layoutDescription =
  "A final anime technology slide with an eight-card production grid, a compact system status panel, and neon editorial framing.";
export const layoutTags = ["anime", "technology", "workflow", "card-grid", "future", "closing"];
export const layoutRole = "conclusion";
export const contentElements = ["headline", "status-panel", "workflow-grid", "decorative-frame"];
export const useCases = ["technology-outlook", "future-production", "closing-topic-highlight"];
export const suitableFor =
  "Suitable for a final thematic slide that summarizes where AI, virtual production, and immersive media are changing an established content pipeline.";
export const avoidFor =
  "Avoid using this layout for dense charts, long speaker notes on canvas, or pages that require large photos as the primary content.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const gridColumns = Array.from({ length: 33 }, (_, index) => index * 40);
const gridRows = Array.from({ length: 19 }, (_, index) => index * 40);
const monoFontFamily =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const standardCard = {
  panel: "#11151C",
  border: "#283240",
  accent: "#586270",
  iconPanel: "#161C24",
  iconBorder: "#293340",
  iconColor: "#7F8A9A",
  titleColor: "#FFFFFF",
  descriptionColor: "#9099A9",
  numberColor: "#1B232E",
  tagPanel: "#171E28",
  tagBorder: "#293340",
  tagText: "#A6AFBD",
};

const enhancedCard = {
  panel: "#0C1912",
  border: "#215039",
  accent: "#1CFF8A",
  iconPanel: "#11261A",
  iconBorder: "#23573C",
  iconColor: "#1CFF8A",
  titleColor: "#E8FFEE",
  descriptionColor: "#A9D9B7",
  numberColor: "#11301F",
  tagPanel: "#133221",
  tagBorder: "#2C6E4B",
  tagText: "#C9FFD9",
};

const getCardPalette = (mode: z.infer<typeof fusionStepSchema>["mode"]) =>
  mode === "enhanced" ? enhancedCard : standardCard;

const HudCorner = ({
  position,
  color,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  color: string;
}) => {
  const horizontalClass =
    position === "top-left" || position === "bottom-left" ? "left-[20px]" : "right-[20px]";
  const verticalClass =
    position === "top-left" || position === "top-right" ? "top-[20px]" : "bottom-[20px]";
  const horizontalEdge =
    position === "top-left" || position === "bottom-left" ? "left-0" : "right-0";
  const verticalEdge =
    position === "top-left" || position === "top-right" ? "top-0" : "bottom-0";

  return (
    <div className={`absolute ${horizontalClass} ${verticalClass} h-[30px] w-[30px]`}>
      <div
        className={`absolute ${verticalEdge} ${horizontalEdge} h-[3px] w-[30px]`}
        style={{ backgroundColor: color }}
      />
      <div
        className={`absolute ${verticalEdge} ${horizontalEdge} h-[30px] w-[3px]`}
        style={{ backgroundColor: color }}
      />
    </div>
  );
};

const ChipIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <rect x="7" y="7" width="10" height="10" rx="2" fill="none" stroke={color} strokeWidth="2" />
    <path
      d="M12 3.8v2.1M12 18.1v2.1M3.8 12h2.1M18.1 12h2.1M7 4.8v2M17 4.8v2M7 17.2v2M17 17.2v2M4.8 7h2M17.2 7h2M4.8 17h2M17.2 17h2"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const StepIcon = ({
  icon,
  color,
}: {
  icon: z.infer<typeof fusionStepSchema>["icon"];
  color: string;
}) => {
  switch (icon) {
    case "handshake":
      return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
          <path
            d="M4 8h4l2 2 2-2h8v3l-4.5 4.5a2.3 2.3 0 0 1-3.3 0L10 13.3l-2.2 2.2a2.3 2.3 0 0 1-3.3 0L3 14v-3Z"
            fill="none"
            stroke={color}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path d="m7.5 7.6-2 2M18.5 7.6l-2 2" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );
    case "script":
      return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
          <rect x="5.5" y="4.5" width="13" height="15" rx="2" fill="none" stroke={color} strokeWidth="1.9" />
          <path d="M9 8.5h6M9 12h6M9 15.5h4.2" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );
    case "layers":
      return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
          <path
            d="m12 4 7 4-7 4-7-4 7-4Zm-7 8 7 4 7-4M5 16l7 4 7-4"
            fill="none"
            stroke={color}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "palette":
      return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
          <path
            d="M12 4.5c4.7 0 8 3.1 8 7.1 0 3.5-2.3 7-6.1 7-1.3 0-2-.7-2-1.8 0-.7.4-1.2.4-1.8 0-.7-.7-1.2-1.8-1.2-2.9 0-6.5-1.9-6.5-5.4 0-2.6 2.5-4.9 8-4.9Z"
            fill="none"
            stroke={color}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <circle cx="8.6" cy="10.2" r="1" fill={color} />
          <circle cx="12.2" cy="8.6" r="1" fill={color} />
          <circle cx="15.3" cy="11.5" r="1" fill={color} />
        </svg>
      );
    case "motion":
      return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
          <path
            d="M7.5 18.5h4.8l2.8-5.8 2.6 1.3 1.8-3.4M5 15.5h3.5M4 11.5h4.5M6.5 7.5h3"
            fill="none"
            stroke={color}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="15.3" cy="8.8" r="2" fill="none" stroke={color} strokeWidth="1.9" />
        </svg>
      );
    case "magic":
      return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
          <path
            d="m5 17.5 6.2-6.2 4.3 4.3L9.3 21.8H5v-4.3ZM13.5 9l1.8-1.8m1.6-1.6L18.7 3m-1.8 6 2.9 2.9M12 5.5h2.2M18.5 11.8V14M7.5 4.5l.8 1.8L10 7l-1.7.7-.8 1.8-.7-1.8L5 7l1.8-.7.7-1.8Z"
            fill="none"
            stroke={color}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "voice":
      return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
          <rect x="9" y="4.5" width="6" height="9" rx="3" fill="none" stroke={color} strokeWidth="1.9" />
          <path
            d="M6.8 11.2c0 3.1 2.1 5.8 5.2 5.8s5.2-2.7 5.2-5.8M12 17v3M8.8 20h6.4"
            fill="none"
            stroke={color}
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      );
    case "vr":
      return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
          <path
            d="M4.5 9.5h15a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H16l-2-3h-4l-2 3H4.5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Z"
            fill="none"
            stroke={color}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="13" r="1.5" fill={color} />
          <circle cx="16" cy="13" r="1.5" fill={color} />
        </svg>
      );
  }
};

const OffsetHeadline = ({ text }: { text: string }) => (
  <div className="relative" style={{ height: "72px" }}>
    <div
      aria-hidden="true"
      className="absolute left-[6px] top-[6px] whitespace-nowrap text-[56px] font-black leading-none"
      style={{
        color: "#1CFF8A",
        fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
      }}
    >
      {text}
    </div>
    <div
      className="relative whitespace-nowrap text-[56px] font-black leading-none text-white"
      style={{ fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)' }}
    >
      {text}
    </div>
  </div>
);

const TechTag = ({ text, active }: { text: string; active: boolean }) => {
  const palette = active ? enhancedCard : standardCard;

  return (
    <div
      className="inline-flex h-[28px] items-center rounded-[6px] border px-[10px]"
      style={{
        borderColor: palette.tagBorder,
        backgroundColor: palette.tagPanel,
      }}
    >
      <div className="mr-[8px] h-[8px] w-[8px] rounded-full" style={{ backgroundColor: palette.accent }} />
      <div
        className="whitespace-nowrap text-[11px] font-bold tracking-[0.16em]"
        style={{
          color: palette.tagText,
          fontFamily: monoFontFamily,
        }}
      >
        {text}
      </div>
    </div>
  );
};

const TechAnimeFusion = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});
  const progressWidth = `${Math.max(0, Math.min(100, parsed.systemProgress))}%`;

  return (
    <AnimeCanvas background="#05070B">
      <div className="absolute inset-0 bg-[#05070B]" />

      <svg
        viewBox="0 0 1280 720"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        style={{ opacity: 0.18 }}
      >
        <rect x="42" y="42" width="1196" height="636" fill="none" stroke="#1A3626" strokeWidth="1.2" />
        <rect x="72" y="72" width="220" height="120" fill="none" stroke="#00E66F" strokeWidth="1" />
        <rect x="986" y="520" width="222" height="132" fill="none" stroke="#00E66F" strokeWidth="1" />
        <path d="M182 72v-30M182 192v50M292 132h56M986 586h-70M1098 652v26" fill="none" stroke="#00E66F" strokeWidth="1" />
        <path d="M390 118h218M390 118v80M608 118v120M608 238h116" fill="none" stroke="#173320" strokeWidth="1" />
        <path d="M920 486h172M920 486v-88M1092 486v-60" fill="none" stroke="#173320" strokeWidth="1" />
      </svg>

      {gridRows.map((top) => (
        <div
          key={`row-${top}`}
          className="absolute left-0 h-px w-full"
          style={{ top, backgroundColor: "#11151D" }}
        />
      ))}
      {gridColumns.map((left) => (
        <div
          key={`column-${left}`}
          className="absolute top-0 h-full w-px"
          style={{ left, backgroundColor: "#11151D" }}
        />
      ))}

      <div className="absolute inset-x-[40px] top-[40px] h-px bg-[#1A1F28]" />
      <div className="absolute inset-x-[40px] bottom-[40px] h-px bg-[#1A1F28]" />

      <HudCorner position="top-left" color="#1CFF8A" />
      <HudCorner position="top-right" color="#1CFF8A" />
      <HudCorner position="bottom-left" color="#1CFF8A" />
      <HudCorner position="bottom-right" color="#1CFF8A" />

      <div
        aria-hidden="true"
        className="absolute left-[72px] top-[36px] whitespace-nowrap text-[56px] font-bold uppercase leading-none"
        style={{
          color: "#11161E",
          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
        }}
      >
        {parsed.backgroundTitle}
      </div>

      <div className="absolute left-[72px] top-[74px] z-10">
        <OffsetHeadline text={parsed.title} />
        <div className="mt-[10px] h-[4px] w-[76px] rounded-full bg-[#1CFF8A]" />
        <div
          className="mt-[14px] whitespace-nowrap text-[14px] font-bold tracking-[0.22em]"
          style={{
            color: "#B3FFC9",
            fontFamily: monoFontFamily,
          }}
        >
          {parsed.subtitle}
        </div>
      </div>

      <div
        className="absolute right-[74px] top-[76px] w-[286px] rounded-[16px] border px-[18px] py-[16px]"
        style={{
          borderColor: "#215039",
          backgroundColor: "#0D1711",
        }}
      >
        <div className="flex items-center justify-between gap-[12px]">
          <div className="flex items-center gap-[10px]">
            <div
              className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border"
              style={{
                borderColor: "#23573C",
                backgroundColor: "#11261A",
              }}
            >
              <ChipIcon color="#1CFF8A" />
            </div>
            <div
              className="whitespace-nowrap text-[12px] font-bold tracking-[0.22em]"
              style={{
                color: "#C7FFD7",
                fontFamily: monoFontFamily,
              }}
            >
              {parsed.systemLabel}
            </div>
          </div>
        </div>

        <div
          className="mt-[14px] h-[10px] overflow-hidden rounded-full border"
          style={{
            borderColor: "#203227",
            backgroundColor: "#111820",
          }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: progressWidth,
              backgroundColor: "#1CFF8A",
            }}
          />
        </div>
      </div>

      <div className="absolute left-[72px] right-[72px] top-[214px] bottom-[74px] grid grid-cols-4 grid-rows-2 gap-[18px]">
        {parsed.steps.map((step, index) => {
          const palette = getCardPalette(step.mode);

          return (
            <div
              key={`${index}-${step.number}-${step.title}`}
              className="relative flex h-full flex-col overflow-hidden rounded-[20px] border px-[18px] pb-[18px] pt-[16px]"
              style={{
                borderColor: palette.border,
                backgroundColor: palette.panel,
              }}
            >
              <div className="absolute left-0 top-0 h-[4px] w-full" style={{ backgroundColor: palette.accent }} />

              <div className="flex items-start justify-between gap-[12px]">
                <div
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border"
                  style={{
                    borderColor: palette.iconBorder,
                    backgroundColor: palette.iconPanel,
                  }}
                >
                  <StepIcon icon={step.icon} color={palette.iconColor} />
                </div>

                <div
                  className="whitespace-nowrap text-[38px] font-bold leading-none"
                  style={{
                    color: palette.numberColor,
                    fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
                  }}
                >
                  {step.number}
                </div>
              </div>

              <div className="mt-[16px]">
                <div className="text-[22px] font-black leading-[1.15]" style={{ color: palette.titleColor }}>
                  {step.title}
                </div>
                <div className="mt-[10px] text-[14px] leading-[1.55]" style={{ color: palette.descriptionColor }}>
                  {step.description}
                </div>
              </div>

              <div className="mt-auto flex flex-wrap gap-[8px] pt-[16px]">
                {step.tags.length > 0 ? (
                  step.tags.map((tag, tagIndex) => (
                    <TechTag key={`${tagIndex}-${tag}`} text={tag} active={step.mode === "enhanced"} />
                  ))
                ) : (
                  <TechTag text="STANDARD" active={false} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="absolute bottom-[48px] left-[72px] whitespace-nowrap text-[12px] font-bold tracking-[0.2em]"
        style={{
          color: "#1CFF8A",
          fontFamily: monoFontFamily,
        }}
      >
        {parsed.footerTag}
      </div>
    </AnimeCanvas>
  );
};

export default TechAnimeFusion;
