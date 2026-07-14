export const RECORD_SCHEMA_VERSION = 1;

export function nowIso() {
  return new Date().toISOString();
}

export function elapsedMs(startedAt, endedAt = performance.now()) {
  return Math.max(0, Math.round((endedAt - startedAt) * 1000) / 1000);
}

export function createRecordId(category) {
  const random = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${category}-${random}`;
}

export function extractCompletionText(result) {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";
  if (typeof result.text === "string") return result.text;
  return extractContentText(result.content) || extractContentText(result.message?.content);
}

function extractContentText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(extractContentText).join("");
  return content?.type === "text" && typeof content.text === "string" ? content.text : "";
}

export function toSerializable(value) {
  const seen = new WeakMap();

  function visit(input, path) {
    if (input === null || typeof input === "string" || typeof input === "boolean") return input;
    if (typeof input === "number") return Number.isFinite(input) ? input : String(input);
    if (typeof input === "undefined") return "[Undefined]";
    if (typeof input === "bigint") return `${input}n`;
    if (typeof input === "symbol") return `[Symbol ${input.description || ""}]`;
    if (typeof input === "function") return `[Function ${input.name || "anonymous"}]`;
    if (typeof input !== "object") return String(input);

    const previousPath = seen.get(input);
    if (previousPath) return `[Circular ${previousPath}]`;
    seen.set(input, path);

    if (input instanceof Date) return input.toISOString();
    if (input instanceof RegExp) return String(input);
    if (input instanceof Error) {
      const result = {
        name: input.name,
        message: input.message,
        stack: input.stack,
      };
      for (const key of Reflect.ownKeys(input)) {
        if (typeof key !== "string" || key in result) continue;
        try {
          result[key] = visit(input[key], `${path}.${key}`);
        } catch (error) {
          result[key] = `[Unreadable: ${String(error?.message || error)}]`;
        }
      }
      return result;
    }
    if (Array.isArray(input)) {
      return input.map((item, index) => visit(item, `${path}[${index}]`));
    }

    const result = {};
    for (const key of Reflect.ownKeys(input)) {
      if (typeof key !== "string") continue;
      try {
        result[key] = visit(input[key], `${path}.${key}`);
      } catch (error) {
        result[key] = `[Unreadable: ${String(error?.message || error)}]`;
      }
    }
    if (Object.keys(result).length === 0) {
      const name = input.constructor?.name;
      if (name && name !== "Object") return `[${name}]`;
    }
    return result;
  }

  return visit(value, "$root");
}

export function isTimeoutError(error) {
  const message = String(error?.message || error || "");
  return /timeout|timed out|超时/i.test(message);
}
