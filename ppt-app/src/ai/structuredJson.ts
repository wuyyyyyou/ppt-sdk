function isLikelyChineseText(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

function isOpeningBracket(char: string) {
  return char === "{" || char === "[";
}

function matchingClosingBracket(char: string) {
  return char === "{" ? "}" : "]";
}

function extractBalancedJsonCandidate(text: string): string | null {
  for (let start = 0; start < text.length; start += 1) {
    const firstChar = text[start];
    if (!isOpeningBracket(firstChar)) continue;

    const stack: string[] = [];
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === "\\") {
          escaped = true;
          continue;
        }

        if (char === "\"") {
          inString = false;
        }

        continue;
      }

      if (char === "\"") {
        inString = true;
        continue;
      }

      if (isOpeningBracket(char)) {
        stack.push(char);
        continue;
      }

      if (char === "}" || char === "]") {
        const open = stack.pop();
        if (!open || matchingClosingBracket(open) !== char) {
          break;
        }

        if (stack.length === 0) {
          return text.slice(start, index + 1);
        }
      }
    }
  }

  return null;
}

export function extractStructuredJsonText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Response did not contain JSON text.");
  }

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // Continue with tolerant extraction.
  }

  const fencedBlocks = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean);

  for (const block of fencedBlocks) {
    try {
      JSON.parse(block);
      return block;
    } catch {
      // Keep searching.
    }
  }

  const balanced = extractBalancedJsonCandidate(trimmed);
  if (balanced) {
    try {
      JSON.parse(balanced);
      return balanced;
    } catch {
      // Keep falling through.
    }
  }

  throw new Error("Response did not contain a parseable JSON value.");
}

export function parseStructuredJson<T>(text: string): T {
  return JSON.parse(extractStructuredJsonText(text)) as T;
}

export function buildStructuredJsonRepairPrompt(
  sourceText: string,
  expectedShape: string,
  parseError: string
) {
  if (isLikelyChineseText(sourceText)) {
    return [
      "上一次回复不是合法 JSON。",
      `解析错误：${parseError}`,
      "请只返回一个 JSON 值，并且不要输出 Markdown、代码块、解释或任何额外文字。",
      "请严格使用下面的结构：",
      expectedShape,
    ].join("\n");
  }

  return [
    "The previous response was not valid JSON.",
    `Parse error: ${parseError}`,
    "Return exactly one JSON value only.",
    "Do not include markdown, code fences, explanations, or any extra text.",
    "Use this shape exactly:",
    expectedShape,
  ].join("\n");
}
