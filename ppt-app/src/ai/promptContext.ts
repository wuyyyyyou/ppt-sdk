export const PROMPT_TIME_ZONE = "Asia/Shanghai";

export function formatCurrentDateForPrompt(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PROMPT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function currentDatePromptLine(now = new Date()): string {
  return `Current date (${PROMPT_TIME_ZONE}): ${formatCurrentDateForPrompt(now)}`;
}
