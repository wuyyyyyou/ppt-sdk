import React from "react";
import * as z from "zod";

import SlideCanvas from "../components/SlideCanvas.tsx";

export const Schema = z.object({});
export const sampleData = {};
export const layoutId = "blank-slide";
export const layoutName = "Blank Slide";
export const layoutDescription = "A neutral canvas with optional technical and reference components for Agent-authored pages.";
export const layoutTags = ["blank", "freestyle", "agent-authored", "component-assisted"];
export const layoutRole = "content";
export const contentElements: string[] = [];
export const useCases = ["custom-composition", "agent-authored-slide", "visual-quality-experiment"];
export const suitableFor = "A technical starting point for original page-specific composition.";
export const avoidFor = "Do not treat the starter or reference components as a fixed page blueprint.";
export const density = "low";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const BlankSlide = () => <SlideCanvas />;

export default BlankSlide;
