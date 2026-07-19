import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
const {
  buildBuiltinTemplatePreviewScreenshots,
  getAllGroupsWithTemplates,
} = await import(pathToFileURL(path.join(projectDir, "dist", "index.js")).href);

const outputRoot = path.join(projectDir, "dist", "template-previews");
const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 720;
const DEFAULT_MAX_PREVIEW_SLIDES_PER_GROUP = 6;

function parseMaxPreviewSlidesPerGroup(argv) {
  if (argv.includes("--all")) return null;
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  if (!limitArg) return DEFAULT_MAX_PREVIEW_SLIDES_PER_GROUP;
  const rawValue = limitArg.slice("--limit=".length);
  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    throw new Error(`Invalid template preview limit: ${rawValue}`);
  }
  return parsedValue;
}

const maxPreviewSlidesPerGroup = parseMaxPreviewSlidesPerGroup(process.argv.slice(2));

function sanitizeFileNamePart(value) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "preview";
}

function getPreviewLayouts(group) {
  return maxPreviewSlidesPerGroup === null
    ? group.layouts
    : group.layouts.slice(0, maxPreviewSlidesPerGroup);
}

function selectPrimaryLayoutId(group, layouts = group.layouts) {
  return (
    (group.cover_layout_id
      && layouts.some((layout) => layout.layout_id === group.cover_layout_id)
      ? group.cover_layout_id
      : null)
    || layouts.find((layout) => layout.layout_role === "cover")?.layout_id
    || layouts[0]?.layout_id
    || null
  );
}

async function buildGroupPreviews(group) {
  const layouts = getPreviewLayouts(group);
  const groupDir = path.join(outputRoot, "groups", group.group_id);
  await mkdir(groupDir, { recursive: true });

  const images = layouts.map((layout, index) => {
    const fileName = `${String(index + 1).padStart(2, "0")}-${sanitizeFileNamePart(
      layout.layout_id,
    )}.png`;
    return {
      group_id: group.group_id,
      layout_id: layout.layout_id,
      layout_name: layout.layout_name,
      file_name: fileName,
      relative_path: path.posix.join("groups", group.group_id, fileName),
      mime_type: "image/png",
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
      primary: layout.layout_id === selectPrimaryLayoutId(group, layouts),
    };
  });

  await buildBuiltinTemplatePreviewScreenshots(layouts.map((layout, index) => ({
    templateGroup: group.group_id,
    layoutId: layout.layout_id,
    slideData: layout.sample_data ?? {},
    title: layout.layout_name,
    outputPath: path.join(groupDir, images[index].file_name),
  })));
  return images;
}

async function main() {
  const groups = getAllGroupsWithTemplates();
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  const index = {
    version: 1,
    generated_at: new Date().toISOString(),
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    groups: {},
  };

  for (const group of groups) {
    const layouts = getPreviewLayouts(group);
    index.groups[group.group_id] = {
      group_id: group.group_id,
      primary_layout_id: selectPrimaryLayoutId(group, layouts),
      images: await buildGroupPreviews(group),
    };
  }

  await writeFile(
    path.join(outputRoot, "index.json"),
    `${JSON.stringify(index, null, 2)}\n`,
    "utf8",
  );
  const totalImages = Object.values(index.groups).reduce(
    (count, group) => count + group.images.length,
    0,
  );
  process.stdout.write(
    `Generated ${totalImages} template preview images for ${groups.length} groups in ${outputRoot}${maxPreviewSlidesPerGroup === null ? "" : ` (limit ${maxPreviewSlidesPerGroup} per group)`}\n`,
  );
  await readFile(path.join(outputRoot, "index.json"), "utf8");
}

await main();
