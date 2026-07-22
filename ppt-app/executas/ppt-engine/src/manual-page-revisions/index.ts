import path from "node:path";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

export const MANUAL_HTML_MAX_BYTES = 64 * 1024 * 1024;
export const AGENT_HTML_MAX_BYTES = 2 * 1024 * 1024;
const revisionPublishQueues = new Map<string, Promise<unknown>>();
const deckPublishQueues = new Map<string, Promise<unknown>>();

export interface ManualPageRevisionManifest {
  version: 1;
  page_id: string;
  revision: number;
  manually_edited: true;
  base_source_sha256: string;
  base_html_sha256: string;
  current_html_sha256: string;
  base_html_path: string;
  current_html_path: string;
  agent_html_path: string;
  screenshot_path: string;
  updated_at: string;
}

export interface ManualPageRevisionPaths {
  directory: string;
  manifest: string;
  baseHtml: string;
  currentHtml: string;
  agentHtml: string;
  screenshot: string;
  assetsDirectory: string;
}

function hash(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertPageId(pageId: string): string {
  const normalized = pageId.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(normalized)) {
    throw new Error(`Invalid page_id "${pageId}"`);
  }
  return normalized;
}

export function manualPageRevisionPaths(workspaceDir: string, pageId: string): ManualPageRevisionPaths {
  const safePageId = assertPageId(pageId);
  const directory = path.join(workspaceDir, "manual-edits", safePageId);
  return {
    directory,
    manifest: path.join(directory, "manifest.json"),
    baseHtml: path.join(directory, "base.html"),
    currentHtml: path.join(directory, "current.html"),
    agentHtml: path.join(directory, "current.agent.html"),
    screenshot: path.join(directory, "current.png"),
    assetsDirectory: path.join(workspaceDir, "page-assets", safePageId),
  };
}

export async function readManualPageRevision(
  workspaceDir: string,
  pageId: string,
): Promise<ManualPageRevisionManifest | null> {
  const paths = manualPageRevisionPaths(workspaceDir, pageId);
  try {
    const value = JSON.parse(await readFile(paths.manifest, "utf8")) as Partial<ManualPageRevisionManifest>;
    if (
      value.version !== 1 || value.page_id !== pageId || value.manually_edited !== true ||
      !Number.isInteger(value.revision) || Number(value.revision) < 1
    ) {
      throw new Error(`Invalid Manual Page Revision manifest for ${pageId}`);
    }
    return value as ManualPageRevisionManifest;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

export async function removeManualPageRevision(workspaceDir: string, pageId: string): Promise<void> {
  await rm(manualPageRevisionPaths(workspaceDir, pageId).directory, { recursive: true, force: true });
}

export async function removePageOwnedManualArtifacts(workspaceDir: string, pageId: string): Promise<void> {
  const paths = manualPageRevisionPaths(workspaceDir, pageId);
  await rm(paths.directory, { recursive: true, force: true });
  await rm(paths.assetsDirectory, { recursive: true, force: true });
}

export async function removeAllManualPageRevisions(workspaceDir: string): Promise<void> {
  await rm(path.join(workspaceDir, "manual-edits"), { recursive: true, force: true });
  await rm(path.join(workspaceDir, "page-assets"), { recursive: true, force: true });
}

function removeActiveContent(html: string): string {
  let next = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<(?:iframe|frame|frameset|object|embed|applet|form)\b[^>]*>[\s\S]*?<\/(?:iframe|frame|frameset|object|embed|applet|form)\s*>/gi, "")
    .replace(/<(?:iframe|frame|object|embed|applet|form)\b[^>]*\/?>/gi, "")
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, "");
  next = next.replace(/\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  next = next.replace(/\s+(href|src|action|formaction)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, "");
  next = next.replace(/@import\s+[^;]+;?/gi, "");
  next = next.replace(/(?:expression|-moz-binding)\s*:[^;"']+/gi, "");
  next = next.replace(/url\(\s*["']?\s*javascript:[^)]+\)/gi, "none");
  return next;
}

function ensureEditorCsp(html: string): string {
  const withoutOld = html.replace(/<meta\b[^>]*data-ppt-editor-csp=["']true["'][^>]*>/gi, "");
  const csp = '<meta data-ppt-editor-csp="true" http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: file: http: https:; style-src \'unsafe-inline\'; font-src data: file: http: https:; media-src data: file: http: https:; connect-src \'none\'; frame-src \'none\'; object-src \'none\'; form-action \'none\'; base-uri \'none\'">';
  return /<head\b[^>]*>/i.test(withoutOld)
    ? withoutOld.replace(/<head\b[^>]*>/i, (match) => `${match}\n${csp}`)
    : withoutOld.replace(/<html\b[^>]*>/i, (match) => `${match}\n<head>${csp}</head>`);
}

function findMatchingDivEnd(html: string, startIndex: number): number {
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = startIndex;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html))) {
    const closing = /^<\/div/i.test(match[0]);
    if (closing) depth -= 1;
    else depth += 1;
    if (depth === 0) return tagPattern.lastIndex;
  }
  throw new Error("Slide shell has no matching closing div");
}

export function extractSlideShell(html: string): { shell: string; start: number; end: number } {
  const matches = Array.from(html.matchAll(/<div\b[^>]*data-presenton-slide-shell\s*=\s*["']true["'][^>]*>/gi));
  if (matches.length !== 1 || matches[0].index === undefined) {
    throw new Error(`Manual page HTML must contain exactly one slide shell; found ${matches.length}`);
  }
  const start = matches[0].index;
  const end = findMatchingDivEnd(html, start);
  return { shell: html.slice(start, end), start, end };
}

export function ensureSinglePageSlideShell(html: string): string {
  if (/data-presenton-slide-shell\s*=\s*["']true["']/i.test(html)) {
    extractSlideShell(html);
    return html;
  }
  const wrapperOpen = /<div\b[^>]*id\s*=\s*["']presentation-slides-wrapper["'][^>]*>/i.exec(html);
  if (!wrapperOpen || wrapperOpen.index === undefined) {
    throw new Error('Manual page HTML must contain "#presentation-slides-wrapper"');
  }
  const contentStart = wrapperOpen.index + wrapperOpen[0].length;
  const wrapperEnd = findMatchingDivEnd(html, wrapperOpen.index);
  const contentEnd = html.lastIndexOf("</div", wrapperEnd);
  if (contentEnd < contentStart) throw new Error("Unable to locate page wrapper contents");
  const content = html.slice(contentStart, contentEnd);
  return `${html.slice(0, contentStart)}<div data-presenton-slide-shell="true" style="position:relative;display:block;width:1280px;height:720px;overflow:hidden;">${content}</div>${html.slice(contentEnd)}`;
}

function ensureShellDimensions(html: string): string {
  const extracted = extractSlideShell(html);
  const openingEnd = extracted.shell.indexOf(">");
  const opening = extracted.shell.slice(0, openingEnd + 1);
  const rest = extracted.shell.slice(openingEnd + 1);
  const styleMatch = /\sstyle\s*=\s*(["'])([\s\S]*?)\1/i.exec(opening);
  const required = "position:relative;display:block;width:1280px;height:720px;overflow:hidden;";
  const nextOpening = styleMatch
    ? opening.replace(styleMatch[0], ` style=${styleMatch[1]}${styleMatch[2]};${required}${styleMatch[1]}`)
    : opening.replace(/>$/, ` style="${required}">`);
  return `${html.slice(0, extracted.start)}${nextOpening}${rest}${html.slice(extracted.end)}`;
}

const LOCAL_IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export async function embedWorkspaceLocalImageResources(
  workspaceDir: string,
  html: string,
): Promise<string> {
  const workspaceRealPath = await realpath(workspaceDir);
  const fileUrls = new Set(html.match(/file:\/\/[^\s"'<>),]+/gi) ?? []);
  let embedded = html;
  for (const fileUrl of fileUrls) {
    let filePath: string;
    try {
      filePath = fileURLToPath(fileUrl);
    } catch {
      continue;
    }
    const extension = path.extname(filePath).toLowerCase();
    const mimeType = LOCAL_IMAGE_MIME_BY_EXTENSION[extension];
    if (!mimeType) continue;
    const fileRealPath = await realpath(filePath);
    const relative = path.relative(workspaceRealPath, fileRealPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Manual page local image must be inside the Workspace: ${filePath}`);
    }
    const bytes = await readFile(fileRealPath);
    if (bytes.length > 20 * 1024 * 1024) {
      throw new Error(`Manual page local image exceeds 20 MiB: ${filePath}`);
    }
    embedded = embedded.replaceAll(fileUrl, `data:${mimeType};base64,${bytes.toString("base64")}`);
  }
  if (Buffer.byteLength(embedded, "utf8") > MANUAL_HTML_MAX_BYTES) {
    throw new Error(`Manual page HTML exceeds ${MANUAL_HTML_MAX_BYTES} bytes after embedding local images`);
  }
  return embedded;
}

async function extractDataUrlAssets(
  html: string,
  paths: ManualPageRevisionPaths,
): Promise<{ currentHtml: string; agentHtml: string }> {
  await mkdir(paths.assetsDirectory, { recursive: true });
  let agentHtml = html;
  const pattern = /data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)/g;
  const replacements = new Map<string, string>();
  for (const match of html.matchAll(pattern)) {
    const full = match[0];
    if (replacements.has(full)) continue;
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > 20 * 1024 * 1024) throw new Error("Manual page image exceeds 20 MiB");
    const metadata = await sharp(bytes, { animated: false }).metadata();
    if (!metadata.width || !metadata.height || metadata.width > 8192 || metadata.height > 8192) {
      throw new Error("Manual page image dimensions must be between 1x1 and 8192x8192");
    }
    const expectedFormat = match[1] === "image/jpeg" ? "jpeg" : match[1].slice("image/".length);
    if (metadata.format !== expectedFormat) throw new Error(`Manual page image content does not match ${match[1]}`);
    const extension = match[1] === "image/jpeg" ? "jpg" : match[1].slice("image/".length);
    const filePath = path.join(paths.assetsDirectory, `${hash(bytes)}.${extension}`);
    await writeFile(filePath, bytes, { flag: "wx" }).catch((error) => {
      if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) throw error;
    });
    replacements.set(full, pathToFileURL(filePath).href);
  }
  for (const [dataUrl, fileUrl] of replacements) agentHtml = agentHtml.replaceAll(dataUrl, fileUrl);
  if (Buffer.byteLength(agentHtml, "utf8") > AGENT_HTML_MAX_BYTES) {
    throw new Error(`Agent-readable manual HTML exceeds ${AGENT_HTML_MAX_BYTES} bytes`);
  }
  return { currentHtml: html, agentHtml };
}

export async function sanitizeManualPageHtml(
  workspaceDir: string,
  pageId: string,
  inputHtml: string,
): Promise<{ currentHtml: string; agentHtml: string }> {
  if (Buffer.byteLength(inputHtml, "utf8") > MANUAL_HTML_MAX_BYTES) {
    throw new Error(`Manual page HTML exceeds ${MANUAL_HTML_MAX_BYTES} bytes`);
  }
  let html = ensureSinglePageSlideShell(removeActiveContent(inputHtml));
  html = ensureShellDimensions(ensureEditorCsp(html));
  extractSlideShell(html);
  return extractDataUrlAssets(html, manualPageRevisionPaths(workspaceDir, pageId));
}

async function writeAtomic(filePath: string, value: string | Buffer): Promise<void> {
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporaryPath, value);
  await rename(temporaryPath, filePath);
}

export async function publishManualPageIntoDeck(input: {
  deckHtmlPath: string;
  pageHtmlPath: string;
  pageIndex: number;
}): Promise<void> {
  const deckHtmlPath = path.resolve(input.deckHtmlPath);
  const previous = deckPublishQueues.get(deckHtmlPath) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(async () => {
    const [deckHtml, pageHtml] = await Promise.all([
      readFile(deckHtmlPath, "utf8"),
      readFile(path.resolve(input.pageHtmlPath), "utf8"),
    ]);
    const replacementShell = extractSlideShell(pageHtml).shell;
    await writeAtomic(
      deckHtmlPath,
      replaceSlideShellAtIndex(deckHtml, input.pageIndex, replacementShell),
    );
  });
  const tail = run.catch(() => undefined);
  deckPublishQueues.set(deckHtmlPath, tail);
  try {
    await run;
  } finally {
    if (deckPublishQueues.get(deckHtmlPath) === tail) deckPublishQueues.delete(deckHtmlPath);
  }
}

export async function publishManualPageRevision(input: {
  workspaceDir: string;
  pageId: string;
  baseRevision: number;
  baseHtml: string;
  currentHtml: string;
  agentHtml: string;
  screenshotPath: string;
  sourceBytes: Buffer;
}): Promise<ManualPageRevisionManifest> {
  const queueKey = `${path.normalize(input.workspaceDir)}\0${assertPageId(input.pageId)}`;
  const previous = revisionPublishQueues.get(queueKey) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(async () => {
    const paths = manualPageRevisionPaths(input.workspaceDir, input.pageId);
    const existing = await readManualPageRevision(input.workspaceDir, input.pageId);
    const currentRevision = existing?.revision ?? 0;
    if (input.baseRevision !== currentRevision) {
      throw new Error(`Manual Page Revision conflict: expected ${currentRevision}, received ${input.baseRevision}`);
    }
    await mkdir(paths.directory, { recursive: true });
    if (!existing) await writeAtomic(paths.baseHtml, input.baseHtml);
    await writeAtomic(paths.currentHtml, input.currentHtml);
    await writeAtomic(paths.agentHtml, input.agentHtml);
    await access(input.screenshotPath);
    await rm(paths.screenshot, { force: true });
    await rename(input.screenshotPath, paths.screenshot);
    const updatedAt = new Date().toISOString();
    const manifest: ManualPageRevisionManifest = {
      version: 1,
      page_id: input.pageId,
      revision: currentRevision + 1,
      manually_edited: true,
      base_source_sha256: hash(input.sourceBytes),
      base_html_sha256: hash(existing ? await readFile(paths.baseHtml) : input.baseHtml),
      current_html_sha256: hash(input.currentHtml),
      base_html_path: paths.baseHtml,
      current_html_path: paths.currentHtml,
      agent_html_path: paths.agentHtml,
      screenshot_path: paths.screenshot,
      updated_at: updatedAt,
    };
    await writeAtomic(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
  });
  const tail = run.catch(() => undefined);
  revisionPublishQueues.set(queueKey, tail);
  try {
    return await run;
  } finally {
    if (revisionPublishQueues.get(queueKey) === tail) revisionPublishQueues.delete(queueKey);
  }
}

export function replaceSlideShellAtIndex(deckHtml: string, index: number, replacementShell: string): string {
  const matches = Array.from(deckHtml.matchAll(/<div\b[^>]*data-presenton-slide-shell\s*=\s*["']true["'][^>]*>/gi));
  const target = matches[index];
  if (!target || target.index === undefined) throw new Error(`Deck HTML is missing slide shell ${index + 1}`);
  const end = findMatchingDivEnd(deckHtml, target.index);
  const originalShell = deckHtml.slice(target.index, end);
  const notes = originalShell.match(/<template\b[^>]*\bdata-pptx-notes(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?[^>]*>[\s\S]*?<\/template\s*>/i)?.[0];
  const replacementHasNotes = /<template\b[^>]*\bdata-pptx-notes(?:\s*=|\s|>)/i.test(replacementShell);
  let nextShell = replacementShell;
  if (notes && !replacementHasNotes) {
    const closingIndex = nextShell.toLowerCase().lastIndexOf("</div");
    if (closingIndex < 0) throw new Error("Replacement slide shell has no matching closing div");
    nextShell = `${nextShell.slice(0, closingIndex)}${notes}${nextShell.slice(closingIndex)}`;
  }
  return `${deckHtml.slice(0, target.index)}${nextShell}${deckHtml.slice(end)}`;
}

export function replaceSinglePageSlideShell(documentHtml: string, replacementShell: string): string {
  const normalized = ensureSinglePageSlideShell(documentHtml);
  const base = extractSlideShell(normalized);
  extractSlideShell(`<!doctype html><html><body>${replacementShell}</body></html>`);
  return `${normalized.slice(0, base.start)}${replacementShell}${normalized.slice(base.end)}`;
}

export async function assertFile(pathname: string): Promise<void> {
  const value = await stat(pathname);
  if (!value.isFile()) throw new Error(`Expected a file: ${pathname}`);
}
