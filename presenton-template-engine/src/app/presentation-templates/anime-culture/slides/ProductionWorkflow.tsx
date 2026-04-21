import React from "react";
import * as z from "zod";

import AnimeCanvas from "./shared/AnimeCanvas.tsx";

const phaseSchema = z.object({
  label: z.string().default("PRE-PRODUCTION / 前期"),
  accent: z.enum(["cyan", "magenta", "yellow"]).default("cyan"),
});

const workflowStepSchema = z.object({
  number: z.string().default("01"),
  title: z.string().default("企划・委员会"),
  englishLabel: z.string().default("PLANNING"),
  description: z
    .string()
    .default("确定项目立项、预算筹集与核心主创人员。"),
  accent: z.enum(["cyan", "magenta", "yellow"]).default("cyan"),
  icon: z
    .enum([
      "handshake",
      "script",
      "storyboard",
      "design",
      "pencil",
      "camera",
      "audio",
      "broadcast",
    ])
    .default("handshake"),
});

export const Schema = z.object({
  backgroundLabel: z.string().default("PIPELINE"),
  title: z.string().default("动漫制作流程"),
  subtitle: z
    .string()
    .default("PRODUCTION WORKFLOW: FROM CONCEPT TO SCREEN"),
  modeLabel: z.string().default("FLOWCHART"),
  footerTag: z.string().default("ANIME FILE / 06"),
  phases: z.array(phaseSchema).length(3).default([
    { label: "PRE-PRODUCTION / 前期", accent: "cyan" },
    { label: "PRODUCTION / 中期", accent: "magenta" },
    { label: "POST / 后期", accent: "yellow" },
  ]),
  steps: z.array(workflowStepSchema).length(8).default([
    {
      number: "01",
      title: "企划・委员会",
      englishLabel: "PLANNING",
      description: "确定项目立项、预算筹集与核心主创人员。",
      accent: "cyan",
      icon: "handshake",
    },
    {
      number: "02",
      title: "脚本・系列构成",
      englishLabel: "SCRIPT",
      description: "编写剧本，确定每集大纲与台词内容。",
      accent: "cyan",
      icon: "script",
    },
    {
      number: "03",
      title: "分镜・演出",
      englishLabel: "STORYBOARD",
      description: "绘制画面蓝图，决定镜头调度、时间轴与画面构图。",
      accent: "cyan",
      icon: "storyboard",
    },
    {
      number: "04",
      title: "角色・美术设定",
      englishLabel: "DESIGN",
      description: "设计人物造型、服装、道具及背景美术风格。",
      accent: "cyan",
      icon: "design",
    },
    {
      number: "05",
      title: "Layout・原画",
      englishLabel: "KEY ANIMATION",
      description: "绘制关键动作帧与场景构图，并完成中间张补帧。",
      accent: "magenta",
      icon: "pencil",
    },
    {
      number: "06",
      title: "上色・摄影",
      englishLabel: "COLORING",
      description: "数字化上色，合成人物与背景，并补充光影特效。",
      accent: "magenta",
      icon: "camera",
    },
    {
      number: "07",
      title: "配音・音效",
      englishLabel: "AUDIO",
      description: "完成声优配音，叠加 BGM 背景音乐与环境音效。",
      accent: "yellow",
      icon: "audio",
    },
    {
      number: "08",
      title: "宣发・播出",
      englishLabel: "RELEASE",
      description: "制作 PV 宣发素材，并交付电视台与流媒体平台播出。",
      accent: "yellow",
      icon: "broadcast",
    },
  ]),
});

export const layoutId = "production-workflow";
export const layoutName = "Production Workflow";
export const layoutDescription =
  "An eight-step anime production workflow slide with three phase labels, neon-accented process cards, and a stable editorial grid.";
export const layoutTags = ["workflow", "anime", "process", "card-grid", "editorial"];
export const layoutRole = "content";
export const contentElements = ["title", "workflow", "phase-labels", "card-grid"];
export const useCases = ["process-overview", "workflow", "production-pipeline"];
export const suitableFor =
  "Suitable for explaining end-to-end production processes, stage-based workflows, and sequential operating models.";
export const avoidFor =
  "Avoid using this layout for long-form narrative, dense quantitative analysis, or image-led storytelling.";
export const density = "high";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const accentStyles = {
  cyan: {
    color: "#00F6FF",
    borderColor: "#23374C",
    backgroundColor: "#101723",
    panelColor: "#08131B",
    lineColor: "#1C3142",
    iconColor: "#00F6FF",
  },
  magenta: {
    color: "#FF4FD8",
    borderColor: "#372645",
    backgroundColor: "#16111F",
    panelColor: "#140C1D",
    lineColor: "#32263D",
    iconColor: "#FF4FD8",
  },
  yellow: {
    color: "#FFD24A",
    borderColor: "#433A20",
    backgroundColor: "#19150F",
    panelColor: "#16120B",
    lineColor: "#3C341F",
    iconColor: "#FFD24A",
  },
} as const;

const phaseWidths = ["50%", "25%", "25%"] as const;

const NetworkIcon = () => (
  <svg viewBox="0 0 32 32" className="h-[18px] w-[18px]" aria-hidden="true">
    <circle cx="7" cy="8" r="3" fill="#00F6FF" />
    <circle cx="25" cy="8" r="3" fill="#00F6FF" />
    <circle cx="16" cy="24" r="3.5" fill="#00F6FF" />
    <path
      d="M9.7 9.8 14.2 20M22.3 9.8 17.8 20M10 8h12"
      stroke="#00F6FF"
      strokeWidth="2.2"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

const WorkflowIcon = ({
  name,
  color,
}: {
  name: z.infer<typeof workflowStepSchema>["icon"];
  color: string;
}) => {
  switch (name) {
    case "handshake":
      return (
        <svg viewBox="0 0 40 40" className="h-[20px] w-[20px]" aria-hidden="true">
          <path
            d="M8 14h7l3 4 4-4h10v4l-6 6c-2 2-5 2-7 0l-3-3-3 3c-2 2-5 2-7 0l-4-4v-6Z"
            fill="none"
            stroke={color}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path d="M14 13 9 18M31 13l-5 5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case "script":
      return (
        <svg viewBox="0 0 40 40" className="h-[20px] w-[20px]" aria-hidden="true">
          <rect x="9" y="7" width="22" height="26" rx="3" fill="none" stroke={color} strokeWidth="2.2" />
          <path d="M15 14h10M15 20h10M15 26h7" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case "storyboard":
      return (
        <svg viewBox="0 0 40 40" className="h-[20px] w-[20px]" aria-hidden="true">
          <rect x="7" y="9" width="26" height="22" rx="3" fill="none" stroke={color} strokeWidth="2.2" />
          <path d="M20 9v22M7 20h26" stroke={color} strokeWidth="2.2" />
          <circle cx="14" cy="16" r="2.4" fill={color} />
          <path d="m12 25 4-4 4 4 4-6 4 6" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "design":
      return (
        <svg viewBox="0 0 40 40" className="h-[20px] w-[20px]" aria-hidden="true">
          <path
            d="M20 8c7 0 12 5 12 12 0 6-4 12-10 12-2 0-3-1-3-3 0-1 1-2 1-3 0-1-1-2-3-2-4 0-9-3-9-8 0-5 5-8 12-8Z"
            fill="none"
            stroke={color}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="14" cy="16" r="1.8" fill={color} />
          <circle cx="20" cy="13" r="1.8" fill={color} />
          <circle cx="25" cy="18" r="1.8" fill={color} />
        </svg>
      );
    case "pencil":
      return (
        <svg viewBox="0 0 40 40" className="h-[20px] w-[20px]" aria-hidden="true">
          <path
            d="m11 28 2-7L24 10l6 6-11 11-8 1Z"
            fill="none"
            stroke={color}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path d="m21 13 6 6" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case "camera":
      return (
        <svg viewBox="0 0 40 40" className="h-[20px] w-[20px]" aria-hidden="true">
          <rect x="7" y="11" width="20" height="18" rx="3" fill="none" stroke={color} strokeWidth="2.2" />
          <path d="m27 16 6-3v14l-6-3" fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="17" cy="20" r="4.5" fill="none" stroke={color} strokeWidth="2.2" />
        </svg>
      );
    case "audio":
      return (
        <svg viewBox="0 0 40 40" className="h-[20px] w-[20px]" aria-hidden="true">
          <rect x="16" y="8" width="8" height="14" rx="4" fill="none" stroke={color} strokeWidth="2.2" />
          <path d="M12 18c0 5 3 9 8 9s8-4 8-9M20 27v5M15 32h10" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </svg>
      );
    case "broadcast":
      return (
        <svg viewBox="0 0 40 40" className="h-[20px] w-[20px]" aria-hidden="true">
          <circle cx="20" cy="20" r="3.2" fill={color} />
          <path
            d="M12 12c4 4 4 12 0 16M28 12c-4 4-4 12 0 16M8 8c6 6 6 18 0 24M32 8c-6 6-6 18 0 24"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );
  }
};

const ModeBadge = ({ label }: { label: string }) => (
  <div
    className="inline-flex h-[42px] items-center gap-[12px] rounded-[12px] border px-[16px]"
    style={{
      borderColor: "#22304A",
      backgroundColor: "#0A121C",
    }}
  >
    <div className="flex h-[18px] w-[18px] items-center justify-center">
      <NetworkIcon />
    </div>
    <div
      className="whitespace-nowrap text-[14px] font-bold tracking-[0.18em]"
      style={{
        color: "#D7F9FF",
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      }}
    >
      {label}
    </div>
  </div>
);

type StepCardProps = {
  item: z.infer<typeof workflowStepSchema>;
  showConnector: boolean;
};

const StepCard = ({
  item,
  showConnector,
}: StepCardProps & React.Attributes) => {
  const accent = accentStyles[item.accent];

  return (
    <div
      className="relative flex h-[190px] flex-col rounded-[18px] border px-[18px] pb-[18px] pt-[18px]"
      style={{
        borderColor: accent.borderColor,
        backgroundColor: accent.backgroundColor,
      }}
    >
      <div
        className="absolute left-0 top-0 h-[4px] w-full rounded-t-[18px]"
        style={{ backgroundColor: accent.color }}
      />
      {showConnector ? (
        <div
          className="absolute right-[-20px] top-[94px] h-[2px] w-[20px]"
          style={{ backgroundColor: "#293349" }}
        />
      ) : null}

      <div
        aria-hidden="true"
        className="absolute bottom-[10px] right-[14px] whitespace-nowrap text-[58px] font-bold leading-none"
        style={{
          color: "#1A2132",
          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
        }}
      >
        {item.number}
      </div>

      <div className="relative z-10 flex items-start justify-between">
        <div
          className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px]"
          style={{ backgroundColor: accent.panelColor }}
        >
          <WorkflowIcon name={item.icon} color={accent.iconColor} />
        </div>
        <div
          className="inline-flex h-[28px] items-center justify-center rounded-full px-[12px] text-[12px] font-bold leading-none"
          style={{
            backgroundColor: accent.panelColor,
            color: accent.color,
            fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
          }}
        >
          <span className="whitespace-nowrap">{item.number}</span>
        </div>
      </div>

      <div
        className="relative z-10 mt-[16px] text-[11px] font-bold tracking-[0.18em]"
        style={{
          color: accent.color,
          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
        }}
      >
        <span className="whitespace-nowrap">{item.englishLabel}</span>
      </div>

      <div className="relative z-10 mt-[8px] text-[22px] font-black leading-[1.15]">
        {item.title}
      </div>

      <div
        className="relative z-10 mt-[10px] max-w-[228px] text-[14px] leading-[1.5]"
        style={{ color: "#ABB7CB" }}
      >
        {item.description}
      </div>
    </div>
  );
};

const ProductionWorkflow = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <AnimeCanvas background="#090A12">
      <div className="absolute left-0 top-0 h-full w-full bg-[#090A12]" />
      <div className="absolute left-[28px] top-[20px] h-[6px] w-[64px] bg-[#00F6FF]" />
      <div className="absolute left-[28px] top-[20px] h-[54px] w-[6px] bg-[#00F6FF]" />
      <div className="absolute bottom-[24px] right-[28px] h-[6px] w-[64px] bg-[#FF4FD8]" />
      <div className="absolute bottom-[24px] right-[28px] h-[54px] w-[6px] bg-[#FF4FD8]" />

      <div
        aria-hidden="true"
        className="absolute left-[74px] top-[18px] whitespace-nowrap text-[92px] font-black leading-none"
        style={{
          color: "#171C2D",
          fontFamily:
            'var(--body-font-family,"Noto Sans SC","Segoe UI",sans-serif)',
        }}
      >
        {parsed.backgroundLabel}
      </div>

      <div className="absolute left-[56px] right-[56px] top-[58px] z-10 flex items-end justify-between">
        <div className="w-[760px]">
          <div className="text-[42px] font-black leading-none">{parsed.title}</div>
          <div className="mt-[12px] h-[4px] w-[96px] bg-[#FF4FD8]" />
          <div
            className="mt-[14px] whitespace-nowrap text-[14px] font-bold tracking-[0.18em]"
            style={{
              color: "#9EAAC2",
              fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
            }}
          >
            {parsed.subtitle}
          </div>
        </div>

        <ModeBadge label={parsed.modeLabel} />
      </div>

      <div className="absolute left-[56px] right-[56px] top-[154px] z-10 flex items-start">
        {parsed.phases.map((phase, index) => {
          const accent = accentStyles[phase.accent];
          return (
            <div key={phase.label} style={{ width: phaseWidths[index] }}>
              <div
                className="whitespace-nowrap text-[13px] font-bold tracking-[0.14em]"
                style={{
                  color: accent.color,
                  fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
                }}
              >
                {phase.label}
              </div>
              <div className="mt-[10px] h-[2px] pr-[18px]">
                <div className="h-full w-full" style={{ backgroundColor: accent.lineColor }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute left-[56px] right-[56px] top-[210px] z-10 grid grid-cols-4 gap-[18px]">
        {parsed.steps.map((item, index) => (
          <StepCard
            key={`${item.number}-${item.title}`}
            item={item}
            showConnector={index !== 3 && index !== 7}
          />
        ))}
      </div>

      <div
        className="absolute bottom-[36px] left-[56px] z-10 inline-flex h-[36px] w-[112px] items-center justify-center rounded-full text-center text-[12px] font-bold leading-none"
        style={{
          backgroundColor: "#111724",
          color: "#8D9AB3",
          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
        }}
      >
        8 KEY STEPS
      </div>

      <div
        className="absolute bottom-[30px] right-[56px] z-10 inline-flex h-[42px] w-[190px] items-center justify-center rounded-[10px] border text-center text-[13px] font-black leading-none"
        style={{
          borderColor: "#2A364B",
          backgroundColor: "#0C111B",
          color: "#00F6FF",
          fontFamily: 'var(--heading-font-family,"Oswald",sans-serif)',
        }}
      >
        {parsed.footerTag}
      </div>
    </AnimeCanvas>
  );
};

export default ProductionWorkflow;
