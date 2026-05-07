import React from "react";
import * as z from "zod";

import FinanceContentFrame from "../components/FinanceContentFrame.js";
import { FinanceIcon } from "../components/FinanceIcons.js";
import VerticalMilestoneTimeline from "../components/VerticalMilestoneTimeline.js";

const timelineIconSchema = z.enum([
  "smartphone",
  "gavel",
  "document",
  "health",
  "globe",
]);

const timelineToneSchema = z.enum(["default", "accent", "future"]);

const timelineEventSchema = z.object({
  period: z.string().min(4).max(16),
  stage: z.string().min(2).max(18),
  title: z.string().min(6).max(28),
  description: z.string().min(20).max(120),
  icon: timelineIconSchema,
  tag: z.string().min(2).max(16).optional(),
  tone: timelineToneSchema.default("default"),
});

export const Schema = z.object({
  title: z.string().min(4).max(24).default("金融行业发展时间线"),
  metaLabel: z.string().min(8).max(40).default("TIMELINE (2010-2026)"),
  items: z.array(timelineEventSchema).min(3).max(7).default([
    {
      period: "2010-2012",
      stage: "移动支付萌芽",
      title: "移动支付与二维码时代开启",
      description:
        "支付宝与微信支付开始普及，二维码支付标准逐步确立，打破传统 POS 机收单格局，金融服务开始向移动端大规模迁移。",
      icon: "smartphone",
      tag: "支付创新",
      tone: "default",
    },
    {
      period: "2015",
      stage: "监管政策与创新",
      title: "互联网金融监管元年",
      description:
        "十部委发布《关于促进互联网金融健康发展的指导意见》，P2P 等新兴业态进入合规整顿期，金融科技开始回归科技赋能本质。",
      icon: "gavel",
      tag: "监管框架",
      tone: "default",
    },
    {
      period: "2018",
      stage: "资管新规落地",
      title: "资管新规重塑市场",
      description:
        "打破刚性兑付，统一资管产品监管标准，推动理财业务向净值化转型，财富管理行业进入规范发展新阶段。",
      icon: "document",
      tag: "财富管理",
      tone: "default",
    },
    {
      period: "2020",
      stage: "数字化加速",
      title: "疫情倒逼全流程数字化",
      description:
        "非接触式金融服务成为主流，远程银行、视频面签、零接触网点迅速落地，银行业数字化转型从“可选项”变为“必选项”。",
      icon: "health",
      tag: "数字运营",
      tone: "default",
    },
    {
      period: "2026",
      stage: "未来生态",
      title: "开放与智能生态融合",
      description:
        "API 经济走向成熟，跨境金融互联互通，构建以数据要素为核心的泛金融生态圈，AI 成为基础设施而非单一工具。",
      icon: "globe",
      tag: "未来趋势",
      tone: "future",
    },
  ]),
  footerText: z.string().min(6).max(80).default("金融行业战略分析报告 | 绝密资料"),
  pageNumber: z.string().min(2).max(4).default("11"),
});

export const layoutId = "industry-development-timeline";
export const layoutName = "Industry Development Timeline";
export const layoutDescription =
  "A component-oriented finance timeline slide with a stable vertical milestone axis, editable time labels, and reusable horizontal feature cards.";
export const layoutTags = ["timeline", "milestones", "industry-history", "componentized"];
export const layoutRole = "timeline";
export const contentElements = ["vertical-axis", "milestone-cards"];
export const useCases = ["industry-timeline", "milestone-history", "development-journey"];
export const suitableFor =
  "Suitable for historical evolution, milestone tracking, policy timelines, and narrative pages that need a vertical industry journey.";
export const avoidFor =
  "Avoid using this layout for comparison matrices, chart-heavy quantitative analysis, or pages with complex branched process flows.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const IndustryDevelopmentTimeline = ({
  data,
}: {
  data: Partial<z.infer<typeof Schema>>;
}) => {
  const parsed = Schema.parse(data ?? {});
  const timelineDensity =
    parsed.items.length >= 6 ||
    parsed.items.some((item) => item.title.length > 18 || item.description.length > 62)
      ? "compact"
      : "normal";

  return (
    <FinanceContentFrame
      title={parsed.title}
      titleAccent="left"
      metaIcon={<FinanceIcon name="clock" className="h-[22px] w-[22px]" />}
      metaText={parsed.metaLabel}
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      contentTop={144}
      contentHeight={526}
      contentBottomInset={0}
    >
      <VerticalMilestoneTimeline
        items={parsed.items}
        density={timelineDensity}
      />
    </FinanceContentFrame>
  );
};

export default IndustryDevelopmentTimeline;
