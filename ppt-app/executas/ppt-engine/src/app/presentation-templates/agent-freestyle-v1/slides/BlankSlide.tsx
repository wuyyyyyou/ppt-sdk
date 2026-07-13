import React from "react";
import * as z from "zod";

import SlideCanvas from "../components/SlideCanvas.tsx";

// The registry currently requires a schema export. This empty schema carries no business data contract.
export const Schema = z.object({});
export const sampleData = {};

export const layoutId = "blank-slide";
export const layoutName = "Blank Slide";
export const layoutDescription =
  "A neutral 1280x720 canvas with no prescribed visual structure, content slots, or business components.";
export const layoutTags = ["blank", "freestyle", "agent-authored", "tsx-first"];
export const layoutRole = "content";
export const contentElements: string[] = [];
export const useCases = ["custom-composition", "agent-authored-slide", "visual-quality-experiment"];
export const suitableFor =
  "Suitable as a technical starting canvas when an AI Agent should design the final page from an approved art direction and visual page plan.";
export const avoidFor =
  "Avoid treating this starter as a finished page or adding generic cards, headers, and placeholders before the concrete page has been designed.";
export const density = "low";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const BlankSlide = () => <SlideCanvas />;

export default BlankSlide;
