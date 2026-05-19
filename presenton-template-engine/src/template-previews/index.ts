import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface TemplatePreviewImage {
  group_id: string;
  layout_id: string;
  layout_name: string;
  file_name: string;
  relative_path: string;
  mime_type: "image/png";
  width: number;
  height: number;
  primary: boolean;
}

export interface TemplatePreviewGroup {
  group_id: string;
  primary_layout_id: string | null;
  images: TemplatePreviewImage[];
}

export interface TemplatePreviewIndex {
  version: number;
  generated_at: string;
  width: number;
  height: number;
  groups: Record<string, TemplatePreviewGroup>;
}

export interface TemplatePreviewDataUrlResult {
  group_id: string;
  layout_id: string;
  file_name: string;
  mime_type: "image/png";
  data_url: string;
}

const TEMPLATE_PREVIEW_DIR_CANDIDATES = [
  path.join(getCurrentModuleDir(), "template-previews"),
  path.join(getCurrentModuleDir(), "..", "..", "dist", "template-previews"),
  getCurrentModuleDir(),
];

let previewIndexPromise: Promise<{
  index: TemplatePreviewIndex;
  rootDir: string;
}> | null = null;

function getCurrentModuleDir(): string {
  if (typeof __dirname === "string") {
    return __dirname;
  }

  return path.dirname(fileURLToPath(import.meta.url));
}

async function readPreviewIndexFrom(rootDir: string): Promise<TemplatePreviewIndex | null> {
  try {
    return JSON.parse(await readFile(path.join(rootDir, "index.json"), "utf8")) as TemplatePreviewIndex;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function loadTemplatePreviewIndex() {
  if (!previewIndexPromise) {
    previewIndexPromise = (async () => {
      for (const rootDir of TEMPLATE_PREVIEW_DIR_CANDIDATES) {
        const index = await readPreviewIndexFrom(rootDir);
        if (index) {
          return { index, rootDir };
        }
      }

      throw new Error(
        `Template preview assets not found in any known location: ${TEMPLATE_PREVIEW_DIR_CANDIDATES.join(", ")}. Run npm run build:full or npm run build:template-previews in presenton-template-engine.`,
      );
    })();
  }

  return previewIndexPromise;
}

function getGroupImage(
  group: TemplatePreviewGroup,
  layoutId?: string | null,
): TemplatePreviewImage | null {
  if (layoutId) {
    return group.images.find((image) => image.layout_id === layoutId) ?? null;
  }

  return (
    group.images.find((image) => image.primary) ??
    group.images[0] ??
    null
  );
}

export async function getTemplatePreviewIndex(): Promise<TemplatePreviewIndex> {
  return (await loadTemplatePreviewIndex()).index;
}

export async function getTemplatePreviewGroup(
  groupId: string,
): Promise<TemplatePreviewGroup | null> {
  const { index } = await loadTemplatePreviewIndex();
  return index.groups[groupId] ?? null;
}

export async function getTemplatePreviewImage(
  groupId: string,
  layoutId?: string | null,
): Promise<TemplatePreviewImage | null> {
  const group = await getTemplatePreviewGroup(groupId);
  return group ? getGroupImage(group, layoutId) : null;
}

export async function readTemplatePreviewDataUrl(
  groupId: string,
  layoutId?: string | null,
): Promise<TemplatePreviewDataUrlResult> {
  const { rootDir } = await loadTemplatePreviewIndex();
  const image = await getTemplatePreviewImage(groupId, layoutId);
  if (!image) {
    throw new Error(
      layoutId
        ? `Template preview not found: ${groupId} / ${layoutId}`
        : `Template preview not found: ${groupId}`,
    );
  }

  const absolutePath = path.join(rootDir, image.relative_path);
  const payload = await readFile(absolutePath);
  return {
    group_id: image.group_id,
    layout_id: image.layout_id,
    file_name: image.file_name,
    mime_type: image.mime_type,
    data_url: `data:${image.mime_type};base64,${payload.toString("base64")}`,
  };
}
