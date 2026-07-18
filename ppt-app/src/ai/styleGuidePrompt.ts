import type { PresentationRequirements, WorkspaceOutline } from "../api/types";
import type { AiOperationLogContext } from "./interactionLog";

export interface GenerateWorkspaceStyleGuideInput {
  brief: string;
  requirements: PresentationRequirements;
  outline: WorkspaceOutline;
  logContext?: AiOperationLogContext;
}

export function buildWorkspaceStyleGuidePrompt(input: GenerateWorkspaceStyleGuideInput): string {
  return [
    "你是一名资深演示文稿艺术指导。请为一套由 TSX 实现的 PPT 页面生成完整的 Markdown 艺术指导文件。",
    "页面画布固定为 1280 × 720。此文件会被每一页的页面创作 Agent 阅读，因此规则必须具体、可直接执行，同时允许不同页面根据内容需要做适度变化。",
    "",
    "上下文优先级：",
    "1. Brief 是用户最初的原始输入，用于保留原始意图和语境。",
    "2. Presentation Requirements Review 是用户后续确认的演示需求。",
    "3. Confirmed Outline 是用户后续确认的页面标题与页面意图。",
    "若三者冲突，以 Presentation Requirements Review 和 Confirmed Outline 为准。",
    "",
    `## Brief（用户原始输入）\n${input.brief.trim() || "（空）"}`,
    `## Presentation Requirements Review（已确认演示需求）\n${JSON.stringify(input.requirements, null, 2)}`,
    `## Confirmed Outline（已确认大纲）\n${JSON.stringify(input.outline, null, 2)}`,
    "",
    "请至少明确：整体视觉概念、构图与留白原则、精确色值及使用规则、常见系统字体选择、标题/正文/注释的字号与字重层级、图表与数据表达、卡片/线条/圆角/阴影规则、图片与插图方向、各类页面的变化边界、应避免的做法。",
    "字体优先选择常见系统字体；不要求提供 fallback font stack。不要指定模板、Page Plan、blueprint、运行时 Theme Token，也不要输出 JSON。",
    "只返回最终 Markdown 文件正文，不要添加代码围栏或解释。",
  ].join("\n");
}
