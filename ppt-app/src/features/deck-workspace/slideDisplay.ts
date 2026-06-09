import type { Slide } from "../../data/mockDeck";

export function visibleSlideSubtitle(slide: Pick<Slide, "subtitle">) {
  const subtitle = slide.subtitle.trim();
  if (subtitle.startsWith("template:")) return "";
  return subtitle;
}
