import type { DeckManifestInput, DeckManifestSlideInput } from "../../render/types.js";
import type { StabilityDiagnostic, StabilityRule } from "../types.js";
import {
  collectLocalManifestSlides,
  createRuleDiagnostic,
  groupJsonExists,
  isSharedModulePath,
  loadManifestState,
  validateLocalModuleExports,
  validateLocalSourcePath,
} from "./helpers.js";

function isSlideObject(value: unknown): value is DeckManifestSlideInput {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isManifestDataObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export const GROUP_JSON_REQUIRED_RULE: StabilityRule = {
  id: "STATIC-001",
  title: "Local template group requires group.json",
  phase: "static",
  severity: "error",
  docs: [
    ".docs/manifest-tsx-guide/tsx-authoring.md",
  ],
  appliesTo: ["group", "manifest"],
  async run(context) {
    const state = await loadManifestState(context);
    if (!state.manifest) {
      return [];
    }

    const localSlides = collectLocalManifestSlides(state.manifest);
    if (localSlides.length === 0) {
      return [];
    }

    if (await groupJsonExists(state.manifestDir)) {
      return [];
    }

    return [createRuleDiagnostic(this, {
      message: `Local manifest deck is missing group.json: ${state.manifestDir}`,
      suggestion: "Add a group.json file next to manifest.json before using local slides.",
      locations: [{
        filePath: state.manifestPath,
        jsonPath: "$.slides",
      }],
      evidence: {
        localSlideCount: localSlides.length,
      },
    })];
  },
};

export const MANIFEST_STRUCTURE_RULE: StabilityRule = {
  id: "STATIC-002",
  title: "Manifest structure must be valid",
  phase: "static",
  severity: "error",
  docs: [
    ".docs/manifest-tsx-guide/manifest-spec.md",
  ],
  appliesTo: ["manifest"],
  async run(context) {
    const state = await loadManifestState(context);
    const diagnostics: StabilityDiagnostic[] = [];

    if (state.readError) {
      diagnostics.push(createRuleDiagnostic(this, {
        message: `Failed to read manifest.json: ${state.readError}`,
        suggestion: "Ensure manifest.json exists and is readable before running validation.",
        locations: [{ filePath: state.manifestPath }],
      }));
      return diagnostics;
    }

    if (state.parseError) {
      diagnostics.push(createRuleDiagnostic(this, {
        message: `Invalid manifest.json content: ${state.parseError}`,
        suggestion: "Fix manifest.json so that it is valid JSON and the root value is an object.",
        locations: [{ filePath: state.manifestPath }],
      }));
      return diagnostics;
    }

    const manifest = state.manifest as DeckManifestInput;
    if (!Array.isArray(manifest.slides) || manifest.slides.length === 0) {
      diagnostics.push(createRuleDiagnostic(this, {
        message: 'Field "manifest.slides" must be a non-empty array',
        suggestion: 'Add at least one slide object to manifest.json under the "slides" field.',
        locations: [{ filePath: state.manifestPath, jsonPath: "$.slides" }],
      }));
      return diagnostics;
    }

    const seenSlideIds = new Set<string>();
    manifest.slides.forEach((slideValue, slideIndex) => {
      if (!isSlideObject(slideValue)) {
        diagnostics.push(createRuleDiagnostic(this, {
          message: `Slide at index ${slideIndex} must be an object`,
          suggestion: "Replace this slide entry with a JSON object containing id, source, and optional data.",
          locations: [{ filePath: state.manifestPath, jsonPath: `$.slides[${slideIndex}]` }],
        }));
        return;
      }

      if (typeof slideValue.id !== "string" || slideValue.id.length === 0) {
        diagnostics.push(createRuleDiagnostic(this, {
          message: `Slide at index ${slideIndex} is missing required field "id"`,
          suggestion: "Set a unique non-empty string id for every slide in manifest.json.",
          locations: [{ filePath: state.manifestPath, jsonPath: `$.slides[${slideIndex}].id` }],
        }));
      } else if (seenSlideIds.has(slideValue.id)) {
        diagnostics.push(createRuleDiagnostic(this, {
          message: `Duplicate manifest slide id "${slideValue.id}"`,
          suggestion: "Rename duplicate slide ids so that every slide id is unique inside one manifest.",
          locations: [{ filePath: state.manifestPath, jsonPath: `$.slides[${slideIndex}].id` }],
        }));
      } else {
        seenSlideIds.add(slideValue.id);
      }

      if (!slideValue.source || typeof slideValue.source !== "object") {
        diagnostics.push(createRuleDiagnostic(this, {
          message: `Slide "${slideValue.id ?? `index-${slideIndex}`}" is missing required field "source"`,
          suggestion: 'Add a "source" object with either builtin or local source configuration.',
          locations: [{ filePath: state.manifestPath, jsonPath: `$.slides[${slideIndex}].source` }],
        }));
        return;
      }

      if (typeof slideValue.source.type !== "string" || slideValue.source.type.length === 0) {
        diagnostics.push(createRuleDiagnostic(this, {
          message: `Slide "${slideValue.id ?? `index-${slideIndex}`}" is missing required field "source.type"`,
          suggestion: 'Set "source.type" to either "builtin" or "local".',
          locations: [{ filePath: state.manifestPath, jsonPath: `$.slides[${slideIndex}].source.type` }],
        }));
      }

      if (
        slideValue.data !== undefined &&
        slideValue.data !== null &&
        !isManifestDataObject(slideValue.data)
      ) {
        diagnostics.push(createRuleDiagnostic(this, {
          message: `Slide "${slideValue.id ?? `index-${slideIndex}`}" field "data" must be an object when provided`,
          suggestion: 'Change "data" to a JSON object, or remove it when no slide data is needed.',
          locations: [{ filePath: state.manifestPath, jsonPath: `$.slides[${slideIndex}].data` }],
        }));
      }
    });

    return diagnostics;
  },
};

export const LOCAL_SOURCE_PATH_RULE: StabilityRule = {
  id: "STATIC-003",
  title: "Local source paths must be valid slide entry files",
  phase: "static",
  severity: "error",
  docs: [
    ".docs/manifest-tsx-guide/manifest-spec.md",
    ".docs/manifest-tsx-guide/tsx-authoring.md",
  ],
  appliesTo: ["manifest", "tsx"],
  async run(context) {
    const state = await loadManifestState(context);
    if (!state.manifest) {
      return [];
    }

    const diagnostics: StabilityDiagnostic[] = [];
    const localSlides = collectLocalManifestSlides(state.manifest);
    for (const slideRef of localSlides) {
      const resolution = await validateLocalSourcePath(slideRef, state.manifestDir);
      if ("error" in resolution) {
        diagnostics.push(createRuleDiagnostic(this, {
          message: resolution.error,
          suggestion: "Point source.path to a readable local slide entry file within the manifest working directory.",
          locations: [{
            filePath: state.manifestPath,
            jsonPath: slideRef.jsonPath,
            slideId: slideRef.slideId,
          }],
          evidence: {
            sourcePath: slideRef.sourcePath,
          },
        }));
      }
    }

    return diagnostics;
  },
};

export const LOCAL_MODULE_EXPORT_RULE: StabilityRule = {
  id: "STATIC-004",
  title: "Local slide modules must export required template fields",
  phase: "static",
  severity: "error",
  docs: [
    ".docs/manifest-tsx-guide/tsx-authoring.md",
  ],
  appliesTo: ["tsx"],
  async run(context) {
    const state = await loadManifestState(context);
    if (!state.manifest) {
      return [];
    }

    const diagnostics: StabilityDiagnostic[] = [];
    const localSlides = collectLocalManifestSlides(state.manifest);
    for (const slideRef of localSlides) {
      const resolution = await validateLocalSourcePath(slideRef, state.manifestDir);
      if ("error" in resolution) {
        continue;
      }

      const moduleValidation = await validateLocalModuleExports(
        resolution.absolutePath,
        state.manifestDir,
      );
      if ("error" in moduleValidation) {
        diagnostics.push(createRuleDiagnostic(this, {
          message: moduleValidation.error,
          suggestion: 'Ensure the local slide exports default, Schema, layoutId, layoutName, and layoutDescription.',
          locations: [{
            filePath: resolution.absolutePath,
            jsonPath: slideRef.jsonPath,
            slideId: slideRef.slideId,
          }],
          evidence: {
            sourcePath: slideRef.sourcePath,
          },
        }));
      }
    }

    return diagnostics;
  },
};

export const SHARED_MODULE_ENTRY_RULE: StabilityRule = {
  id: "STATIC-010",
  title: "Manifest local sources must not point at shared modules",
  phase: "static",
  severity: "error",
  docs: [
    ".docs/manifest-tsx-guide/build-deck-html-from-manifest.md",
    ".docs/manifest-tsx-guide/manifest-spec.md",
  ],
  appliesTo: ["manifest", "tsx"],
  async run(context) {
    const state = await loadManifestState(context);
    if (!state.manifest) {
      return [];
    }

    const diagnostics: StabilityDiagnostic[] = [];
    const localSlides = collectLocalManifestSlides(state.manifest);
    for (const slideRef of localSlides) {
      if (!isSharedModulePath(slideRef.sourcePath)) {
        continue;
      }

      diagnostics.push(createRuleDiagnostic(this, {
        message: `Slide "${slideRef.slideId}" points to a shared module instead of a slide entry: ${slideRef.sourcePath}`,
        suggestion: "Reference a slides/*.tsx entry file in manifest.json and keep shared/* imports inside the slide module itself.",
        locations: [{
          filePath: state.manifestPath,
          jsonPath: slideRef.jsonPath,
          slideId: slideRef.slideId,
        }],
        evidence: {
          sourcePath: slideRef.sourcePath,
        },
      }));
    }

    return diagnostics;
  },
};
