import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { createWriteStream } from "node:fs";
import { copyFile, mkdir, readFile, rename, stat, unlink } from "node:fs/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import sharp from "sharp";

export const RESEARCH_IMAGE_DOWNLOAD_LIMITS = {
  connectTimeoutMs: 8_000,
  totalTimeoutMs: 30_000,
  maxRedirects: 3,
  maxBytes: 20 * 1024 * 1024,
  minWidth: 800,
  minHeight: 600,
  maxDimension: 12_000,
  maxPixels: 60_000_000,
} as const;

export interface ResearchImageDownloadEvent {
  phase: "redirect" | "download" | "validate";
  status: "succeeded";
  details: Record<string, unknown>;
}

export interface ResearchImageDownloadResult {
  file_path: string;
  final_url: string;
  mime_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  bytes_size: number;
  sha256: string;
  width: number;
  height: number;
  redirects: number;
}

interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export function isDisallowedResearchImageAddress(address: string): boolean {
  const normalizedAddress = address.startsWith("[") && address.endsWith("]") ? address.slice(1, -1) : address;
  const family = isIP(normalizedAddress);
  if (family === 4) {
    const octets = normalizedAddress.split(".").map(Number);
    if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return true;
    const [a, b, c] = octets;
    return a === 0
      || a === 10
      || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0 && (c === 0 || c === 2))
      || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
      || (a === 203 && b === 0 && c === 113)
      || (a === 100 && b >= 64 && b <= 127)
      || a >= 224;
  }
  if (family === 6) {
    const normalized = normalizedAddress.toLowerCase().split("%")[0] ?? "";
    return normalized === "::"
      || normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || /^fe[89ab]/.test(normalized)
      || normalized.startsWith("ff")
      || normalized.startsWith("2001:db8:")
      || normalized.startsWith("64:ff9b:")
      || normalized.startsWith("100:")
      || normalized.startsWith("::ffff:");
  }
  return true;
}

export function assertSafeResearchImageUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Research image URL is invalid");
  }
  if (url.protocol !== "https:") throw new Error("Research image URL must use HTTPS");
  if (url.username || url.password) throw new Error("Research image URL must not contain credentials");
  if (url.port && url.port !== "443") throw new Error("Research image URL must use port 443");
  return url;
}

async function resolvePublicAddress(hostname: string): Promise<ResolvedAddress> {
  const normalizedHostname = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  const literalFamily = isIP(normalizedHostname);
  let lookupTimer: ReturnType<typeof setTimeout> | undefined;
  const addresses = literalFamily
    ? [{ address: normalizedHostname, family: literalFamily as 4 | 6 }]
    : await Promise.race([
        lookup(normalizedHostname, { all: true, verbatim: true }),
        new Promise<never>((_resolve, reject) => {
          lookupTimer = setTimeout(() => reject(new Error("Research image DNS lookup timed out")), RESEARCH_IMAGE_DOWNLOAD_LIMITS.connectTimeoutMs);
        }),
      ]).finally(() => {
        if (lookupTimer) clearTimeout(lookupTimer);
      });
  if (addresses.length === 0) throw new Error("Research image hostname did not resolve");
  if (addresses.some((entry) => isDisallowedResearchImageAddress(entry.address))) {
    throw new Error("Research image hostname resolves to a disallowed address");
  }
  const selected = addresses[0];
  if (!selected || (selected.family !== 4 && selected.family !== 6)) throw new Error("Research image hostname resolved to an unsupported address");
  return { address: selected.address, family: selected.family };
}

function detectImageMime(bytes: Buffer): ResearchImageDownloadResult["mime_type"] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 6 && (bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a")) return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

async function inspectResearchImage(bytes: Buffer): Promise<{
  mimeType: ResearchImageDownloadResult["mime_type"];
  width: number;
  height: number;
}> {
  if (bytes.byteLength <= 0 || bytes.byteLength > RESEARCH_IMAGE_DOWNLOAD_LIMITS.maxBytes) {
    throw new Error(`Research image exceeds ${RESEARCH_IMAGE_DOWNLOAD_LIMITS.maxBytes} bytes`);
  }
  const mimeType = detectImageMime(bytes.subarray(0, 16));
  if (!mimeType) throw new Error("Research image has an unsupported file signature");
  const metadata = await sharp(bytes, { animated: false, limitInputPixels: RESEARCH_IMAGE_DOWNLOAD_LIMITS.maxPixels }).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < RESEARCH_IMAGE_DOWNLOAD_LIMITS.minWidth || height < RESEARCH_IMAGE_DOWNLOAD_LIMITS.minHeight) {
    throw new Error("Research image dimensions are below 800x600");
  }
  if (width > RESEARCH_IMAGE_DOWNLOAD_LIMITS.maxDimension || height > RESEARCH_IMAGE_DOWNLOAD_LIMITS.maxDimension || width * height > RESEARCH_IMAGE_DOWNLOAD_LIMITS.maxPixels) {
    throw new Error("Research image dimensions exceed the safety limit");
  }
  return { mimeType, width, height };
}

const EXTENSION_BY_MIME: Record<ResearchImageDownloadResult["mime_type"], string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

async function requestToFile(input: {
  url: URL;
  outputPath: string;
  signal: AbortSignal;
  maxBytes: number;
}): Promise<{ statusCode: number; headers: import("node:http").IncomingHttpHeaders; location?: string; bytes: number }> {
  const resolved = await resolvePublicAddress(input.url.hostname);
  const tlsHostname = input.url.hostname.startsWith("[") && input.url.hostname.endsWith("]")
    ? input.url.hostname.slice(1, -1)
    : input.url.hostname;
  return new Promise((resolve, reject) => {
    const req = request(input.url, {
      method: "GET",
      headers: { Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8", "User-Agent": "Anna-PPT-Research/1.0" },
      signal: input.signal,
      ...(isIP(tlsHostname) ? {} : { servername: tlsHostname }),
      lookup: (_hostname, _options, callback) => callback(null, resolved.address, resolved.family),
    }, async (response) => {
      const statusCode = response.statusCode ?? 0;
      const location = typeof response.headers.location === "string" ? response.headers.location : undefined;
      if (statusCode >= 300 && statusCode < 400 && location) {
        response.resume();
        resolve({ statusCode, headers: response.headers, location, bytes: 0 });
        return;
      }
      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`Research image download failed with HTTP ${statusCode}`));
        return;
      }
      const declared = Number(response.headers["content-length"]);
      if (Number.isFinite(declared) && declared > input.maxBytes) {
        response.destroy();
        reject(new Error(`Research image exceeds ${input.maxBytes} bytes`));
        return;
      }
      let bytes = 0;
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.byteLength;
        if (bytes > input.maxBytes) response.destroy(new Error(`Research image exceeds ${input.maxBytes} bytes`));
      });
      try {
        await pipeline(response, createWriteStream(input.outputPath, { flags: "wx" }));
        resolve({ statusCode, headers: response.headers, bytes });
      } catch (error) {
        reject(error);
      }
    });
    const connectTimer = setTimeout(() => req.destroy(new Error("Research image connection timed out")), RESEARCH_IMAGE_DOWNLOAD_LIMITS.connectTimeoutMs);
    req.on("socket", (socket) => {
      socket.once("secureConnect", () => clearTimeout(connectTimer));
    });
    req.once("close", () => clearTimeout(connectTimer));
    req.once("error", reject);
    req.end();
  });
}

export async function downloadResearchImage(input: {
  url: string;
  staging_dir: string;
  candidate_id: string;
  existing_file_path?: string;
  expected_sha256?: string;
  onEvent?: (event: ResearchImageDownloadEvent) => void | Promise<void>;
}): Promise<ResearchImageDownloadResult> {
  await mkdir(input.staging_dir, { recursive: true });
  if (input.existing_file_path && input.expected_sha256) {
    const existing = await readFile(input.existing_file_path).catch(() => null);
    if (existing && createHash("sha256").update(existing).digest("hex") === input.expected_sha256) {
      const inspected = await inspectResearchImage(existing).catch(() => null);
      if (inspected) {
        const reusedPath = path.join(input.staging_dir, `${input.candidate_id}${EXTENSION_BY_MIME[inspected.mimeType]}`);
        if (path.resolve(reusedPath) !== path.resolve(input.existing_file_path)) {
          await unlink(reusedPath).catch(() => undefined);
          await copyFile(input.existing_file_path, reusedPath);
          await unlink(input.existing_file_path).catch(() => undefined);
        }
        await input.onEvent?.({
          phase: "validate",
          status: "succeeded",
          details: { reused: true, mime_type: inspected.mimeType, size_bytes: existing.byteLength, width: inspected.width, height: inspected.height, sha256: input.expected_sha256 },
        });
        return {
          file_path: reusedPath,
          final_url: input.url,
          mime_type: inspected.mimeType,
          bytes_size: existing.byteLength,
          sha256: input.expected_sha256,
          width: inspected.width,
          height: inspected.height,
          redirects: 0,
        };
      }
    }
  }

  const controller = new AbortController();
  const totalTimer = setTimeout(() => controller.abort(new Error("Research image download timed out")), RESEARCH_IMAGE_DOWNLOAD_LIMITS.totalTimeoutMs);
  const temporaryPath = path.join(input.staging_dir, `.${input.candidate_id}.${Date.now()}.part`);
  let currentUrl = assertSafeResearchImageUrl(input.url);
  let redirects = 0;
  try {
    for (;;) {
      await unlink(temporaryPath).catch(() => undefined);
      const response = await requestToFile({ url: currentUrl, outputPath: temporaryPath, signal: controller.signal, maxBytes: RESEARCH_IMAGE_DOWNLOAD_LIMITS.maxBytes });
      if (response.location) {
        if (redirects >= RESEARCH_IMAGE_DOWNLOAD_LIMITS.maxRedirects) throw new Error("Research image exceeded the redirect limit");
        const nextUrl = assertSafeResearchImageUrl(new URL(response.location, currentUrl).toString());
        redirects += 1;
        await input.onEvent?.({ phase: "redirect", status: "succeeded", details: { redirect_index: redirects, target_origin: nextUrl.origin } });
        currentUrl = nextUrl;
        continue;
      }
      await input.onEvent?.({ phase: "download", status: "succeeded", details: { http_status: response.statusCode, size_bytes: response.bytes, redirects } });
      break;
    }
    const bytes = await readFile(temporaryPath);
    const { mimeType, width, height } = await inspectResearchImage(bytes);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const finalPath = path.join(input.staging_dir, `${input.candidate_id}${EXTENSION_BY_MIME[mimeType]}`);
    await unlink(finalPath).catch(() => undefined);
    await rename(temporaryPath, finalPath);
    await input.onEvent?.({ phase: "validate", status: "succeeded", details: { mime_type: mimeType, size_bytes: bytes.length, width, height, sha256 } });
    return { file_path: finalPath, final_url: currentUrl.toString(), mime_type: mimeType, bytes_size: bytes.length, sha256, width, height, redirects };
  } finally {
    clearTimeout(totalTimer);
    await unlink(temporaryPath).catch(() => undefined);
  }
}

export async function validateExistingResearchImage(input: { file_path: string; sha256: string }): Promise<boolean> {
  const fileStat = await stat(input.file_path).catch(() => null);
  if (!fileStat?.isFile()) return false;
  const bytes = await readFile(input.file_path);
  return createHash("sha256").update(bytes).digest("hex") === input.sha256;
}
