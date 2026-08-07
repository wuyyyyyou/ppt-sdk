import path from "node:path";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { brotliDecompressSync, inflateSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import { getPptWorkspaceRoot } from "../workspace-root.js";

export const MANAGED_FONT_MAX_BYTES = 20 * 1024 * 1024;
export const MANAGED_FONT_STYLE_ATTRIBUTE = "data-ppt-editor-fonts";
export const MANAGED_FONT_FAMILY_ATTRIBUTE = "data-ppt-editor-font-family";

export type ManagedFontFormat = "ttf" | "otf" | "woff" | "woff2";
export type ManagedFontVariant = "regular" | "bold" | "italic" | "boldItalic";

export interface ManagedFontVariantFile {
  variant: ManagedFontVariant;
  format: ManagedFontFormat;
  mime_type: string;
  size_bytes: number;
  file_path: string;
  relative_path: string;
}

export interface ManagedFontFamily {
  family: string;
  variants: Partial<Record<ManagedFontVariant, ManagedFontVariantFile>>;
}

export interface ManagedFontFamilySummary {
  family: string;
  variants: ManagedFontVariant[];
}

export interface ManagedFontLibraryResult {
  families: ManagedFontFamilySummary[];
}

export interface CommitManagedFontUploadInput {
  workspace_dir: string;
  staging_file_path: string;
  filename: string;
  expected_size_bytes: number;
}

export interface CommitManagedFontUploadResult {
  library: ManagedFontLibraryResult;
  font: ManagedFontFamily;
}

interface StoredFontVariant {
  format: ManagedFontFormat;
  mime_type: string;
  size_bytes: number;
  relative_path: string;
}

interface StoredFontFamily {
  family: string;
  variants: Partial<Record<ManagedFontVariant, StoredFontVariant>>;
}

interface StoredFontIndex {
  version: 1;
  families: StoredFontFamily[];
}

export interface ParsedFontMetadata {
  family: string;
  variant: ManagedFontVariant;
  format: ManagedFontFormat;
}

const WORKSPACE_ROOT = getPptWorkspaceRoot();
const GLOBAL_FONT_DIR = path.join(WORKSPACE_ROOT, ".fonts");
const GLOBAL_FONT_INDEX_PATH = path.join(GLOBAL_FONT_DIR, "index.json");
const WORKSPACE_FONT_DIRNAME = "fonts";
const FONT_EXTENSIONS = new Set([".ttf", ".otf", ".woff", ".woff2"]);
const MIME_BY_FORMAT: Record<ManagedFontFormat, string> = {
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};
const WOFF2_KNOWN_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post",
  "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT",
  "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea",
  "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH",
  "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar",
  "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar",
  "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop",
  "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
] as const;

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function safeFamilyPart(value: string): string {
  const base = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48) || "font";
  const suffix = createHash("sha256").update(value).digest("hex").slice(0, 10);
  return `${base}-${suffix}`;
}

function assertWorkspaceDir(workspaceDir: string): string {
  if (!path.isAbsolute(workspaceDir)) throw new Error('"workspace_dir" must be an absolute path');
  const normalized = path.normalize(workspaceDir);
  const relative = path.relative(WORKSPACE_ROOT, normalized);
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !/^ppt-\d{8}-\d{6}$/.test(path.basename(normalized))
  ) {
    throw new Error('"workspace_dir" must point to a PPT workspace');
  }
  return normalized;
}

function emptyIndex(): StoredFontIndex {
  return { version: 1, families: [] };
}

async function readIndex(indexPath: string): Promise<StoredFontIndex> {
  try {
    const value = JSON.parse(await readFile(indexPath, "utf8")) as Partial<StoredFontIndex>;
    if (value.version !== 1 || !Array.isArray(value.families)) {
      throw new Error(`Invalid managed font index: ${indexPath}`);
    }
    return value as StoredFontIndex;
  } catch (error) {
    if (isMissingFileError(error)) return emptyIndex();
    throw error;
  }
}

async function writeAtomic(filePath: string, value: string | Buffer): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporaryPath, value);
  await rename(temporaryPath, filePath);
}

function indexDirectory(indexPath: string): string {
  return path.dirname(indexPath);
}

function materializeFamily(indexPath: string, family: StoredFontFamily): ManagedFontFamily {
  const variants: ManagedFontFamily["variants"] = {};
  for (const [variant, stored] of Object.entries(family.variants) as Array<[ManagedFontVariant, StoredFontVariant]>) {
    variants[variant] = {
      variant,
      ...stored,
      file_path: path.join(indexDirectory(indexPath), stored.relative_path),
    };
  }
  return { family: family.family, variants };
}

function summarize(index: StoredFontIndex): ManagedFontLibraryResult {
  return {
    families: [...index.families]
      .sort((left, right) => left.family.localeCompare(right.family))
      .map((family) => ({
        family: family.family,
        variants: (Object.keys(family.variants) as ManagedFontVariant[]).sort(),
      })),
  };
}

function readUInt16(buffer: Buffer, offset: number): number {
  if (offset < 0 || offset + 2 > buffer.length) throw new Error("Font table is truncated");
  return buffer.readUInt16BE(offset);
}

function readUInt32(buffer: Buffer, offset: number): number {
  if (offset < 0 || offset + 4 > buffer.length) throw new Error("Font table is truncated");
  return buffer.readUInt32BE(offset);
}

function decodeUtf16Be(buffer: Buffer): string {
  const evenLength = buffer.length - (buffer.length % 2);
  const swapped = Buffer.allocUnsafe(evenLength);
  for (let index = 0; index < evenLength; index += 2) {
    swapped[index] = buffer[index + 1]!;
    swapped[index + 1] = buffer[index]!;
  }
  return swapped.toString("utf16le").replace(/\0/g, "").trim();
}

function decodeNameValue(platformId: number, bytes: Buffer): string {
  if (platformId === 0 || platformId === 3) return decodeUtf16Be(bytes);
  return bytes.toString("latin1").replace(/\0/g, "").trim();
}

function parseNameTable(table: Buffer): { family: string; subfamily: string } {
  if (table.length < 6) throw new Error("Font name table is truncated");
  const count = readUInt16(table, 2);
  const stringOffset = readUInt16(table, 4);
  const records: Array<{
    nameId: number;
    platformId: number;
    languageId: number;
    value: string;
  }> = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 12;
    if (offset + 12 > table.length) break;
    const platformId = readUInt16(table, offset);
    const languageId = readUInt16(table, offset + 4);
    const nameId = readUInt16(table, offset + 6);
    const length = readUInt16(table, offset + 8);
    const valueOffset = stringOffset + readUInt16(table, offset + 10);
    if (valueOffset + length > table.length) continue;
    const value = decodeNameValue(platformId, table.subarray(valueOffset, valueOffset + length));
    if (value) records.push({ nameId, platformId, languageId, value });
  }
  const choose = (ids: number[]): string => {
    for (const nameId of ids) {
      const matches = records.filter((record) => record.nameId === nameId);
      const preferred = matches.find((record) => record.platformId === 3 && record.languageId === 0x0409)
        ?? matches.find((record) => record.platformId === 3)
        ?? matches.find((record) => record.platformId === 0)
        ?? matches[0];
      if (preferred) return preferred.value;
    }
    return "";
  };
  return { family: choose([16, 1]), subfamily: choose([17, 2]) };
}

function sfntTables(buffer: Buffer): Map<string, Buffer> {
  const tables = new Map<string, Buffer>();
  const count = readUInt16(buffer, 4);
  for (let index = 0; index < count; index += 1) {
    const offset = 12 + index * 16;
    if (offset + 16 > buffer.length) throw new Error("Font table directory is truncated");
    const tag = buffer.toString("latin1", offset, offset + 4);
    const tableOffset = readUInt32(buffer, offset + 8);
    const length = readUInt32(buffer, offset + 12);
    if (tableOffset + length > buffer.length) throw new Error(`Font table ${tag} is truncated`);
    tables.set(tag, buffer.subarray(tableOffset, tableOffset + length));
  }
  return tables;
}

function woffTables(buffer: Buffer): Map<string, Buffer> {
  const tables = new Map<string, Buffer>();
  const count = readUInt16(buffer, 12);
  for (let index = 0; index < count; index += 1) {
    const offset = 44 + index * 20;
    if (offset + 20 > buffer.length) throw new Error("WOFF table directory is truncated");
    const tag = buffer.toString("latin1", offset, offset + 4);
    const tableOffset = readUInt32(buffer, offset + 4);
    const compressedLength = readUInt32(buffer, offset + 8);
    const originalLength = readUInt32(buffer, offset + 12);
    if (tableOffset + compressedLength > buffer.length) throw new Error(`WOFF table ${tag} is truncated`);
    const bytes = buffer.subarray(tableOffset, tableOffset + compressedLength);
    const table = compressedLength < originalLength ? inflateSync(bytes) : bytes;
    if (table.length !== originalLength) throw new Error(`WOFF table ${tag} has an invalid length`);
    tables.set(tag, table);
  }
  return tables;
}

function readBase128(buffer: Buffer, cursor: { offset: number }): number {
  let result = 0;
  for (let index = 0; index < 5; index += 1) {
    if (cursor.offset >= buffer.length) throw new Error("WOFF2 table directory is truncated");
    const value = buffer[cursor.offset++]!;
    if (index === 0 && value === 0x80) throw new Error("Invalid WOFF2 UIntBase128 value");
    if ((result & 0xfe000000) !== 0) throw new Error("WOFF2 UIntBase128 overflow");
    result = result * 128 + (value & 0x7f);
    if ((value & 0x80) === 0) return result;
  }
  throw new Error("Invalid WOFF2 UIntBase128 value");
}

function woff2Tables(buffer: Buffer): Map<string, Buffer> {
  const count = readUInt16(buffer, 12);
  const totalCompressedSize = readUInt32(buffer, 20);
  const cursor = { offset: 48 };
  const entries: Array<{ tag: string; transformedLength: number }> = [];
  for (let index = 0; index < count; index += 1) {
    if (cursor.offset >= buffer.length) throw new Error("WOFF2 table directory is truncated");
    const flags = buffer[cursor.offset++]!;
    const tagIndex = flags & 0x3f;
    const transformVersion = flags >>> 6;
    let tag: string;
    if (tagIndex === 0x3f) {
      if (cursor.offset + 4 > buffer.length) throw new Error("WOFF2 custom table tag is truncated");
      tag = buffer.toString("latin1", cursor.offset, cursor.offset + 4);
      cursor.offset += 4;
    } else {
      tag = WOFF2_KNOWN_TAGS[tagIndex] ?? "";
      if (!tag) throw new Error("WOFF2 contains an unknown table tag");
    }
    const originalLength = readBase128(buffer, cursor);
    const transformed =
      ((tag === "glyf" || tag === "loca") && transformVersion === 0) ||
      (tag === "hmtx" && transformVersion === 1);
    const transformedLength = transformed ? readBase128(buffer, cursor) : originalLength;
    entries.push({ tag, transformedLength });
  }
  const compressedEnd = cursor.offset + totalCompressedSize;
  if (compressedEnd > buffer.length) throw new Error("WOFF2 compressed font data is truncated");
  const decompressed = brotliDecompressSync(buffer.subarray(cursor.offset, compressedEnd));
  const tables = new Map<string, Buffer>();
  let tableOffset = 0;
  for (const entry of entries) {
    const end = tableOffset + entry.transformedLength;
    if (end > decompressed.length) throw new Error(`WOFF2 table ${entry.tag} is truncated`);
    tables.set(entry.tag, decompressed.subarray(tableOffset, end));
    tableOffset = end;
  }
  return tables;
}

function detectFontFormat(buffer: Buffer): ManagedFontFormat {
  if (buffer.length < 12) throw new Error("Font file is too small");
  const signature = buffer.toString("latin1", 0, 4);
  if (signature === "OTTO") return "otf";
  if (signature === "wOFF") return "woff";
  if (signature === "wOF2") return "woff2";
  if (buffer.readUInt32BE(0) === 0x00010000 || signature === "true") return "ttf";
  throw new Error("Unsupported or invalid font file");
}

function parseFontMetadata(buffer: Buffer, filename: string): ParsedFontMetadata {
  const extension = path.extname(filename).toLowerCase();
  if (!FONT_EXTENSIONS.has(extension)) {
    throw new Error("Font filename must use .ttf, .otf, .woff, or .woff2");
  }
  const format = detectFontFormat(buffer);
  if (`.${format}` !== extension) {
    throw new Error(`Font content does not match the ${extension} filename extension`);
  }
  const tables = format === "woff"
    ? woffTables(buffer)
    : format === "woff2"
      ? woff2Tables(buffer)
      : sfntTables(buffer);
  for (const required of ["name", "head", "maxp", "cmap"]) {
    if (!tables.has(required)) throw new Error(`Font does not contain a required ${required} table`);
  }
  if (!tables.has("glyf") && !tables.has("CFF ") && !tables.has("CFF2")) {
    throw new Error("Font does not contain a supported outline table");
  }
  const nameTable = tables.get("name");
  if (!nameTable) throw new Error("Font does not contain a readable name table");
  const names = parseNameTable(nameTable);
  const family = names.family.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!family || family.length > 128) throw new Error("Font family name is missing or too long");
  const os2 = tables.get("OS/2");
  const weight = os2 && os2.length >= 6 ? readUInt16(os2, 4) : 400;
  const head = tables.get("head");
  const macStyle = head && head.length >= 46 ? readUInt16(head, 44) : 0;
  const subfamily = names.subfamily.toLowerCase();
  const italic = /italic|oblique/.test(subfamily) || Boolean(macStyle & 0x0002);
  const bold = weight >= 600 || /bold|semibold|demibold|black|heavy/.test(subfamily) || Boolean(macStyle & 0x0001);
  const variant: ManagedFontVariant = bold && italic
    ? "boldItalic"
    : bold
      ? "bold"
      : italic
        ? "italic"
        : "regular";
  return { family, variant, format };
}

export function inspectManagedFontFile(
  buffer: Buffer,
  filename: string,
): ParsedFontMetadata {
  return parseFontMetadata(buffer, filename);
}

function workspaceIndexPath(workspaceDir: string): string {
  return path.join(assertWorkspaceDir(workspaceDir), WORKSPACE_FONT_DIRNAME, "index.json");
}

async function copyVariantIntoWorkspace(
  workspaceDir: string,
  family: StoredFontFamily,
  variant: ManagedFontVariant,
  stored: StoredFontVariant,
): Promise<StoredFontVariant> {
  const workspaceIndex = workspaceIndexPath(workspaceDir);
  const relativePath = path.join(safeFamilyPart(family.family), `${variant}.${stored.format}`);
  const destination = path.join(indexDirectory(workspaceIndex), relativePath);
  const source = path.join(GLOBAL_FONT_DIR, stored.relative_path);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  return { ...stored, relative_path: relativePath };
}

export async function listManagedFontLibrary(): Promise<ManagedFontLibraryResult> {
  return summarize(await readIndex(GLOBAL_FONT_INDEX_PATH));
}

export async function listWorkspaceManagedFonts(workspaceDir: string): Promise<ManagedFontFamily[]> {
  const indexPath = workspaceIndexPath(workspaceDir);
  const index = await readIndex(indexPath);
  return index.families
    .sort((left, right) => left.family.localeCompare(right.family))
    .map((family) => materializeFamily(indexPath, family));
}

export async function pinManagedFontToWorkspace(
  workspaceDir: string,
  familyName: string,
  replaceVariant?: ManagedFontVariant,
): Promise<ManagedFontFamily> {
  const normalizedWorkspace = assertWorkspaceDir(workspaceDir);
  const globalIndex = await readIndex(GLOBAL_FONT_INDEX_PATH);
  const globalFamily = globalIndex.families.find((entry) => entry.family === familyName);
  if (!globalFamily) throw new Error(`Managed font family not found: ${familyName}`);
  const targetIndexPath = workspaceIndexPath(normalizedWorkspace);
  const targetIndex = await readIndex(targetIndexPath);
  let targetFamily = targetIndex.families.find((entry) => entry.family === familyName);
  if (!targetFamily) {
    targetFamily = { family: familyName, variants: {} };
    targetIndex.families.push(targetFamily);
  }
  for (const [variant, stored] of Object.entries(globalFamily.variants) as Array<[ManagedFontVariant, StoredFontVariant]>) {
    if (targetFamily.variants[variant] && replaceVariant !== variant) continue;
    targetFamily.variants[variant] = await copyVariantIntoWorkspace(
      normalizedWorkspace,
      globalFamily,
      variant,
      stored,
    );
  }
  targetIndex.families.sort((left, right) => left.family.localeCompare(right.family));
  await writeAtomic(targetIndexPath, `${JSON.stringify(targetIndex, null, 2)}\n`);
  return materializeFamily(targetIndexPath, targetFamily);
}

export async function commitManagedFontUpload(
  input: CommitManagedFontUploadInput,
): Promise<CommitManagedFontUploadResult> {
  const workspaceDir = assertWorkspaceDir(input.workspace_dir);
  if (!path.isAbsolute(input.staging_file_path)) {
    throw new Error('"staging_file_path" must be an absolute path');
  }
  const fileStat = await stat(input.staging_file_path);
  if (!fileStat.isFile() || fileStat.size !== Math.floor(input.expected_size_bytes)) {
    throw new Error("Managed font upload size does not match the staged file");
  }
  if (fileStat.size <= 0 || fileStat.size > MANAGED_FONT_MAX_BYTES) {
    throw new Error(`Managed font file must be between 1 and ${MANAGED_FONT_MAX_BYTES} bytes`);
  }
  const bytes = await readFile(input.staging_file_path);
  const metadata = parseFontMetadata(bytes, input.filename);
  const globalIndex = await readIndex(GLOBAL_FONT_INDEX_PATH);
  let family = globalIndex.families.find((entry) => entry.family === metadata.family);
  if (!family) {
    family = { family: metadata.family, variants: {} };
    globalIndex.families.push(family);
  }
  const relativePath = path.join(
    safeFamilyPart(metadata.family),
    `${metadata.variant}.${metadata.format}`,
  );
  const previous = family.variants[metadata.variant];
  const destination = path.join(GLOBAL_FONT_DIR, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeAtomic(destination, bytes);
  family.variants[metadata.variant] = {
    format: metadata.format,
    mime_type: MIME_BY_FORMAT[metadata.format],
    size_bytes: bytes.length,
    relative_path: relativePath,
  };
  globalIndex.families.sort((left, right) => left.family.localeCompare(right.family));
  await writeAtomic(GLOBAL_FONT_INDEX_PATH, `${JSON.stringify(globalIndex, null, 2)}\n`);
  if (previous && previous.relative_path !== relativePath) {
    await rm(path.join(GLOBAL_FONT_DIR, previous.relative_path), { force: true });
  }
  const font = await pinManagedFontToWorkspace(workspaceDir, metadata.family, metadata.variant);
  return { library: summarize(globalIndex), font };
}

function escapeCssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ");
}

function fontFaceRule(family: string, file: ManagedFontVariantFile): string {
  const bold = file.variant === "bold" || file.variant === "boldItalic";
  const italic = file.variant === "italic" || file.variant === "boldItalic";
  const format = file.format === "ttf"
    ? "truetype"
    : file.format === "otf"
      ? "opentype"
      : file.format;
  return [
    "@font-face {",
    `  font-family: "${escapeCssString(family)}";`,
    `  src: url("${pathToFileURL(file.file_path).href}") format("${format}");`,
    `  font-weight: ${bold ? 700 : 400};`,
    `  font-style: ${italic ? "italic" : "normal"};`,
    "  font-display: block;",
    "}",
  ].join("\n");
}

function usedManagedFamilies(html: string): Set<string> {
  const values = new Set<string>();
  const pattern = new RegExp(
    `${MANAGED_FONT_FAMILY_ATTRIBUTE}\\s*=\\s*(?:"([^"]+)"|'([^']+)')`,
    "gi",
  );
  for (const match of html.matchAll(pattern)) {
    const value = (match[1] ?? match[2] ?? "").trim();
    if (value) values.add(value);
  }
  return values;
}

export async function managedFontsUsedByHtml(
  workspaceDir: string,
  html: string,
): Promise<ManagedFontFamily[]> {
  const used = usedManagedFamilies(html);
  if (used.size === 0) return [];
  const workspaceFonts = await listWorkspaceManagedFonts(workspaceDir);
  return workspaceFonts.filter((font) => used.has(font.family));
}

export async function managedFontVariantWarningsForHtml(
  workspaceDir: string,
  html: string,
): Promise<string[]> {
  const usedFonts = await managedFontsUsedByHtml(workspaceDir, html);
  const variants: ManagedFontVariant[] = ["regular", "bold", "italic", "boldItalic"];
  return usedFonts.flatMap((font) => {
    const missing = variants.filter((variant) => !font.variants[variant]);
    return missing.length > 0 ? [`${font.family}: ${missing.join(", ")}`] : [];
  });
}

export async function injectWorkspaceManagedFontCss(
  workspaceDir: string,
  html: string,
): Promise<string> {
  const withoutOld = html.replace(
    new RegExp(`<style\\b[^>]*${MANAGED_FONT_STYLE_ATTRIBUTE}=["']true["'][^>]*>[\\s\\S]*?<\\/style\\s*>`, "gi"),
    "",
  );
  const used = usedManagedFamilies(withoutOld);
  if (used.size === 0) return withoutOld;
  const workspaceFonts = await listWorkspaceManagedFonts(workspaceDir);
  const rules: string[] = [];
  for (const familyName of used) {
    const family = workspaceFonts.find((entry) => entry.family === familyName);
    if (!family) throw new Error(`Managed font is missing from this workspace: ${familyName}`);
    for (const file of Object.values(family.variants)) {
      if (file) rules.push(fontFaceRule(family.family, file));
    }
  }
  const style = `<style ${MANAGED_FONT_STYLE_ATTRIBUTE}="true">\n${rules.join("\n")}\n</style>`;
  const shellPattern = /<div\b[^>]*data-presenton-slide-shell\s*=\s*["']true["'][^>]*>/i;
  if (!shellPattern.test(withoutOld)) throw new Error("Managed font CSS requires a slide shell");
  return withoutOld.replace(shellPattern, (opening) => `${opening}\n${style}`);
}
