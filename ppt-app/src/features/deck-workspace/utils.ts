import type { Messages } from "../../i18n/messages";
import type { MainStage } from "./types";

export const sleep = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

export function formatSlideNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

export function formatSlideCount(count: number) {
  return String(count).padStart(2, "0");
}

export function deckReadyStatus(t: Messages, count: number) {
  return `${t.status.draftReady} · ${count} slides`;
}

export function stageOrder(stage: MainStage) {
  return { brief: 1, outline: 2, deck: 3 }[stage];
}
