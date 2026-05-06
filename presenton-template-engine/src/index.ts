import { templates } from "./app/presentation-templates/index.js";
import type {
  TemplateLayoutsWithSettings,
  TemplateWithData,
} from "./app/presentation-templates/utils.js";
import {
  getAllDiscoveredTemplateGroups,
  getDiscoveredTemplateGroup,
  listDiscoveredTemplateGroupSummaries,
  type DiscoverTemplateGroupsInput,
  type DiscoveredTemplateGroupInfo,
  type DiscoveredTemplateGroupSummaryInfo,
  type DiscoveredTemplateLayoutInfo,
  type GetDiscoveredTemplateGroupInput,
  type LocalTemplateCatalog,
  type LocalTemplateCatalogSlide,
  type LocalTemplateGroupMetadata,
  type TemplateDiscoverySourceType,
} from "./discovery/index.js";
import {
  forkTemplateGroup,
  type ForkTemplateGroupInput,
  type ForkTemplateGroupResult,
} from "./fork/fork-template-group.js";
import {
  convertDeckHtmlToPptxModel,
  convertDeckPageToPptxModel,
  extractDeckPageToSlideAttributes,
  convertElementAttributesToPptxSlides,
  convertSlideElementAttributesToPptxSlideModel,
  sortElementsForPpt,
  shouldKeepRootLevelElement,
  type ConvertDeckHtmlToPptxModelInput,
  type ConvertDeckPageToPptxModelInput,
  type OrderedExtractedElement,
} from "./html-to-pptx-model/index.js";
import { buildDeckHtmlFromManifest } from "./render/build-deck-from-manifest.js";
import { buildDeckHtml, buildStandaloneDeckHtml } from "./render/build-deck.js";
import { renderSlideHtml } from "./render/render-slide.js";
import type {
  BuildDeckHtmlFromManifestInput,
  BuildDeckHtmlInput,
  BuildDeckHtmlSlideInput,
  BuildStandaloneDeckHtmlInput,
  BuildStandaloneDeckHtmlSlideInput,
  BuiltinDeckManifestSlideSource,
  DeckManifestInput,
  DeckManifestSlideInput,
  DeckManifestSlideSource,
  LocalDeckManifestSlideSource,
  RenderSlideHtmlInput,
  TemplateRenderThemeInput,
} from "./render/types.js";
import {
  listThemePresets,
  type ThemePresetInfo,
} from "./themes/default-theme-presets.js";
import {
  CENTERED_TEXT_SEMANTICS_RULE,
  collectRenderedSlideInfos,
  DEFAULT_DECK_SELECTOR,
  DEFAULT_SLIDE_SELECTOR,
  disposeRenderedValidationContext,
  FIXED_HEIGHT_VERTICAL_ALIGN_RULE,
  GRAPHIC_MODULE_SCREENSHOT_RULE,
  GRADIENT_CARD_RISK_RULE,
  inspectRenderedSlides,
  prepareRenderedValidationArtifacts,
  prepareRenderedValidationContext,
  runDeckValidation,
  runRenderedRules,
  runStaticRules,
  SINGLE_LINE_KEY_TEXT_RULE,
  SVG_CURRENT_COLOR_RULE,
  TEXT_MODULE_SCREENSHOT_RULE,
  TEXT_STROKE_RISK_RULE,
  TRANSLATE_CENTER_RISK_RULE,
  type PersistedValidationReport,
  type RenderedElementSummary,
  type RenderedValidationArtifacts,
  type RenderedValidationContext,
  type RenderedValidationRuntimeOptions,
  type RenderedSlideInfo,
  type RenderedSlideInspection,
  type StabilityDiagnostic,
  type StabilityDiagnosticCounts,
  type StabilityDiagnosticLocation,
  type StabilityRule,
  type ValidationBrowserLike,
  type ValidationAppliesTo,
  type ValidationContext,
  type ValidationElementHandleLike,
  type ValidationPhase,
  type ValidationPageLike,
  type ValidationReport,
  type ValidationSeverity,
  type ValidationViewport,
  waitForDeckRenderReady,
  writeValidationReport,
} from "./validate/index.js";

export interface TemplateLayoutInfo {
  layout_id: string;
  layout_name: string;
  layout_description: string;
  json_schema: Record<string, unknown>;
  sample_data?: Record<string, unknown>;
  tags?: string[];
  layout_role?: string;
  content_elements?: string[];
  use_cases?: string[];
  suitable_for?: string;
  avoid_for?: string;
  density?: "low" | "medium" | "high";
  visual_weight?: "text-heavy" | "balanced" | "visual-heavy";
  editable_text_priority?: "high" | "medium" | "low";
  catalog?: LocalTemplateCatalogSlide;
}

export interface TemplateGroupInfo {
  group_id: string;
  group_name: string;
  group_description: string;
  ordered: boolean;
  default: boolean;
  group_brief?: string;
  style_tags?: string[];
  industry_tags?: string[];
  use_cases?: string[];
  audience_tags?: string[];
  tone_tags?: string[];
  cover_layout_id?: string;
  agenda_layout_id?: string;
  closing_layout_id?: string;
  layout_roles_summary?: string[];
  content_elements_summary?: string[];
  catalog?: LocalTemplateCatalog;
  layouts: TemplateLayoutInfo[];
}

export interface TemplateGroupSummaryInfo {
  group_id: string;
  group_name: string;
  group_description: string;
  ordered: boolean;
  default: boolean;
  group_brief?: string;
  style_tags?: string[];
  industry_tags?: string[];
  use_cases?: string[];
  audience_tags?: string[];
  tone_tags?: string[];
  cover_layout_id?: string;
  agenda_layout_id?: string;
  closing_layout_id?: string;
  layout_roles_summary?: string[];
  content_elements_summary?: string[];
  catalog?: LocalTemplateCatalog;
  layout_count: number;
}

function collectUniqueStrings(values: Array<string | string[] | undefined>): string[] | undefined {
  const collected = new Set<string>();

  values.forEach((value) => {
    if (typeof value === "string" && value.length > 0) {
      collected.add(value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === "string" && item.length > 0) {
          collected.add(item);
        }
      });
    }
  });

  if (collected.size === 0) {
    return undefined;
  }

  return Array.from(collected).sort((left, right) => left.localeCompare(right));
}

function mapGroupSummary(group: TemplateLayoutsWithSettings): TemplateGroupSummaryInfo {
  return {
    group_id: group.id,
    group_name: group.name,
    group_description: group.description,
    ordered: group.settings.ordered,
    default: group.settings.default,
    group_brief: group.settings.groupBrief,
    style_tags: group.settings.styleTags,
    industry_tags: group.settings.industryTags,
    use_cases: group.settings.useCases,
    audience_tags: group.settings.audienceTags,
    tone_tags: group.settings.toneTags,
    cover_layout_id: group.settings.coverLayoutId,
    agenda_layout_id: group.settings.agendaLayoutId,
    closing_layout_id: group.settings.closingLayoutId,
    layout_roles_summary: collectUniqueStrings(group.layouts.map((layout) => layout.layoutRole)),
    content_elements_summary: collectUniqueStrings(
      group.layouts.map((layout) => layout.contentElements),
    ),
    layout_count: group.layouts.length,
  };
}

function mapGroup(group: TemplateLayoutsWithSettings): TemplateGroupInfo {
  return {
    group_id: group.id,
    group_name: group.name,
    group_description: group.description,
    ordered: group.settings.ordered,
    default: group.settings.default,
    group_brief: group.settings.groupBrief,
    style_tags: group.settings.styleTags,
    industry_tags: group.settings.industryTags,
    use_cases: group.settings.useCases,
    audience_tags: group.settings.audienceTags,
    tone_tags: group.settings.toneTags,
    cover_layout_id: group.settings.coverLayoutId,
    agenda_layout_id: group.settings.agendaLayoutId,
    closing_layout_id: group.settings.closingLayoutId,
    layout_roles_summary: collectUniqueStrings(group.layouts.map((layout) => layout.layoutRole)),
    content_elements_summary: collectUniqueStrings(
      group.layouts.map((layout) => layout.contentElements),
    ),
    layouts: group.layouts.map((layout: TemplateWithData) => ({
      layout_id: layout.layoutId,
      layout_name: layout.layoutName,
      layout_description: layout.layoutDescription,
      json_schema: layout.schemaJSON as Record<string, unknown>,
      sample_data: layout.sampleData,
      tags: layout.layoutTags,
      layout_role: layout.layoutRole,
      content_elements: layout.contentElements,
      use_cases: layout.useCases,
      suitable_for: layout.suitableFor,
      avoid_for: layout.avoidFor,
      density: layout.density,
      visual_weight: layout.visualWeight,
      editable_text_priority: layout.editableTextPriority,
    })),
  };
}

export function listTemplateGroupSummaries(): TemplateGroupSummaryInfo[] {
  return templates.map(mapGroupSummary);
}

export function getAllGroupsWithTemplates(): TemplateGroupInfo[] {
  return templates.map(mapGroup);
}

export function getTemplateGroup(groupId: string): TemplateGroupInfo | null {
  const group = templates.find((item) => item.id === groupId);
  return group ? mapGroup(group) : null;
}

export type {
  BuildDeckHtmlFromManifestInput,
  BuildDeckHtmlInput,
  BuildDeckHtmlSlideInput,
  BuildStandaloneDeckHtmlInput,
  BuildStandaloneDeckHtmlSlideInput,
  BuiltinDeckManifestSlideSource,
  DeckManifestInput,
  DeckManifestSlideInput,
  DeckManifestSlideSource,
  DiscoverTemplateGroupsInput,
  DiscoveredTemplateGroupInfo,
  DiscoveredTemplateGroupSummaryInfo,
  DiscoveredTemplateLayoutInfo,
  ForkTemplateGroupInput,
  ForkTemplateGroupResult,
  GetDiscoveredTemplateGroupInput,
  LocalTemplateGroupMetadata,
  LocalTemplateCatalog,
  LocalTemplateCatalogSlide,
  LocalDeckManifestSlideSource,
  ConvertDeckHtmlToPptxModelInput,
  ConvertDeckPageToPptxModelInput,
  OrderedExtractedElement,
  RenderSlideHtmlInput,
  TemplateDiscoverySourceType,
  TemplateRenderThemeInput,
  ThemePresetInfo,
};
export {
  buildDeckHtml,
  buildDeckHtmlFromManifest,
  buildStandaloneDeckHtml,
  convertDeckHtmlToPptxModel,
  convertDeckPageToPptxModel,
  convertElementAttributesToPptxSlides,
  convertSlideElementAttributesToPptxSlideModel,
  CENTERED_TEXT_SEMANTICS_RULE,
  extractDeckPageToSlideAttributes,
  forkTemplateGroup,
  getAllDiscoveredTemplateGroups,
  getDiscoveredTemplateGroup,
  listDiscoveredTemplateGroupSummaries,
  listThemePresets,
  renderSlideHtml,
  shouldKeepRootLevelElement,
  sortElementsForPpt,
  collectRenderedSlideInfos,
  DEFAULT_DECK_SELECTOR,
  DEFAULT_SLIDE_SELECTOR,
  disposeRenderedValidationContext,
  FIXED_HEIGHT_VERTICAL_ALIGN_RULE,
  GRAPHIC_MODULE_SCREENSHOT_RULE,
  GRADIENT_CARD_RISK_RULE,
  inspectRenderedSlides,
  prepareRenderedValidationArtifacts,
  prepareRenderedValidationContext,
  runDeckValidation,
  runRenderedRules,
  runStaticRules,
  SINGLE_LINE_KEY_TEXT_RULE,
  SVG_CURRENT_COLOR_RULE,
  TEXT_MODULE_SCREENSHOT_RULE,
  TEXT_STROKE_RISK_RULE,
  TRANSLATE_CENTER_RISK_RULE,
  waitForDeckRenderReady,
  writeValidationReport,
};
export type {
  PersistedValidationReport,
  RenderedElementSummary,
  RenderedValidationArtifacts,
  RenderedValidationContext,
  RenderedValidationRuntimeOptions,
  RenderedSlideInfo,
  RenderedSlideInspection,
  StabilityDiagnostic,
  StabilityDiagnosticCounts,
  StabilityDiagnosticLocation,
  StabilityRule,
  ValidationBrowserLike,
  ValidationAppliesTo,
  ValidationContext,
  ValidationElementHandleLike,
  ValidationPhase,
  ValidationPageLike,
  ValidationReport,
  ValidationSeverity,
  ValidationViewport,
};
export * from "./html-to-pptx-model/types/browser.js";
export * from "./html-to-pptx-model/types/element-attributes.js";
export * from "./html-to-pptx-model/types/pptx-models.js";
