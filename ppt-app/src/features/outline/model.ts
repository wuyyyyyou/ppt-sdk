import type { OutlineDetail } from "../../data/mockDeck";

const BULLET_PATTERN = /^(\s*)(?:[-*+•]|\d+[.)])\s+(.+)$/;
const EMPTY_BULLET_PATTERN = /^(\s*)(?:[-*+•]|\d+[.)])\s*$/;

export interface EditableOutline {
  title: string;
  items: OutlineDetail[];
}

export function createEmptyOutlineItem(): OutlineDetail {
  return {
    title: "",
    core_message: "",
    required_content: "- ",
  };
}

export function cloneOutlineItems(items: OutlineDetail[]): OutlineDetail[] {
  return items.map((item) => ({ ...item }));
}

export function normalizeRequiredContentMarkdown(value: string): string {
  const normalized = value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/u, ""))
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      const match = BULLET_PATTERN.exec(line);
      if (EMPTY_BULLET_PATTERN.test(line)) {
        throw new Error(`必要内容第 ${index + 1} 行不能为空。`);
      }
      const indentation = match?.[1] ?? line.match(/^(\s*)/)?.[1] ?? "";
      const content = (match?.[2] ?? line).trim();
      if (!content) {
        throw new Error(`必要内容第 ${index + 1} 行不能为空。`);
      }
      return `${indentation}- ${content}`;
    });
  if (normalized.length === 0) {
    throw new Error("必要内容至少需要一个项目。");
  }
  return normalized.join("\n");
}

function normalizeSingleLine(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label}不能为空。`);
  if (/\r|\n/u.test(normalized)) throw new Error(`${label}必须为单行文本。`);
  return normalized;
}

export function normalizeValidOutline(input: EditableOutline): EditableOutline {
  const title = normalizeSingleLine(input.title, "演示文稿标题");
  if (input.items.length === 0) throw new Error("大纲至少需要保留一页。");
  return {
    title,
    items: input.items.map((item, index) => ({
      title: normalizeSingleLine(item.title, `第 ${index + 1} 页标题`),
      core_message: normalizeSingleLine(item.core_message, `第 ${index + 1} 页核心信息`),
      required_content: normalizeRequiredContentMarkdown(item.required_content),
    })),
  };
}

export function outlinesEqual(left: EditableOutline, right: EditableOutline): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
