import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  PresentationDocument,
  PresentationRevision,
  PresentationSnapshot,
} from "./types.js";
import { validatePresentationDocument } from "./validation.js";

const revisionQueues = new Map<string, Promise<unknown>>();

export class PresentationRevisionConflictError extends Error {
  readonly latestRevision: number;

  constructor(expectedRevision: number, latestRevision: number) {
    super(`Presentation revision conflict: expected ${expectedRevision}, latest is ${latestRevision}.`);
    this.name = "PresentationRevisionConflictError";
    this.latestRevision = latestRevision;
  }
}

export function buildPresentationStorePaths(workspaceDir: string) {
  const directory = path.join(workspaceDir, "presentation");
  return {
    directory,
    originalModel: path.join(directory, "model0.json"),
    originalDocument: path.join(directory, "original-document.json"),
    currentDocument: path.join(directory, "document.json"),
    sourceMap: path.join(directory, "source-map.json"),
    revisions: path.join(directory, "revisions"),
  };
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function withRevisionQueue<T>(workspaceDir: string, operation: () => Promise<T>): Promise<T> {
  const key = path.normalize(workspaceDir);
  const previous = revisionQueues.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(operation);
  const tail = run.catch(() => undefined);
  revisionQueues.set(key, tail);
  try {
    return await run;
  } finally {
    if (revisionQueues.get(key) === tail) revisionQueues.delete(key);
  }
}

function revisionPath(workspaceDir: string, revision: number): string {
  const paths = buildPresentationStorePaths(workspaceDir);
  return path.join(paths.revisions, `revision-${String(revision).padStart(6, "0")}.json`);
}

export async function initializePresentationStore(
  workspaceDir: string,
  snapshot: PresentationSnapshot,
): Promise<PresentationRevision> {
  return withRevisionQueue(workspaceDir, async () => {
    const paths = buildPresentationStorePaths(workspaceDir);
    try {
      return await readJson<PresentationRevision>(paths.currentDocument);
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
    }

    const validation = validatePresentationDocument(snapshot.document);
    if (!validation.valid) {
      throw new Error(`Cannot initialize invalid Presentation Document: ${validation.errors.map((item) => item.message).join("; ")}`);
    }
    const now = new Date().toISOString();
    const document = structuredClone(snapshot.document);
    document.revision = 0;
    document.metadata.updatedAt = now;
    const revision: PresentationRevision = {
      presentationId: document.id,
      revision: 0,
      baseRevision: 0,
      document,
      updatedAt: now,
    };
    await atomicWriteJson(paths.originalModel, snapshot.originalModel);
    await atomicWriteJson(paths.sourceMap, snapshot.sourceMap);
    await atomicWriteJson(paths.originalDocument, document);
    await atomicWriteJson(revisionPath(workspaceDir, 0), revision);
    await atomicWriteJson(paths.currentDocument, revision);
    return revision;
  });
}

export async function readPresentationRevision(workspaceDir: string): Promise<PresentationRevision | null> {
  try {
    return await readJson<PresentationRevision>(buildPresentationStorePaths(workspaceDir).currentDocument);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

export async function savePresentationRevision(input: {
  workspaceDir: string;
  baseRevision: number;
  document: PresentationDocument;
}): Promise<PresentationRevision> {
  return withRevisionQueue(input.workspaceDir, async () => {
    const current = await readPresentationRevision(input.workspaceDir);
    if (!current) throw new Error("Presentation Document has not been initialized.");
    if (current.revision !== input.baseRevision) {
      throw new PresentationRevisionConflictError(input.baseRevision, current.revision);
    }
    if (input.document.id !== current.presentationId) {
      throw new Error("Presentation ID cannot be changed.");
    }
    const validation = validatePresentationDocument(input.document);
    if (!validation.valid) {
      throw new Error(`Cannot save invalid Presentation Document: ${validation.errors.map((item) => item.message).join("; ")}`);
    }

    const now = new Date().toISOString();
    const revisionNumber = current.revision + 1;
    const document = structuredClone(input.document);
    document.revision = revisionNumber;
    document.metadata.updatedAt = now;
    const revision: PresentationRevision = {
      presentationId: document.id,
      revision: revisionNumber,
      baseRevision: current.revision,
      document,
      updatedAt: now,
    };
    await atomicWriteJson(revisionPath(input.workspaceDir, revisionNumber), revision);
    await atomicWriteJson(buildPresentationStorePaths(input.workspaceDir).currentDocument, revision);
    return revision;
  });
}

export async function restoreOriginalPresentation(workspaceDir: string): Promise<PresentationRevision> {
  const paths = buildPresentationStorePaths(workspaceDir);
  const original = await readJson<PresentationDocument>(paths.originalDocument);
  const current = await readPresentationRevision(workspaceDir);
  if (!current) throw new Error("Presentation Document has not been initialized.");
  return savePresentationRevision({
    workspaceDir,
    baseRevision: current.revision,
    document: original,
  });
}

export async function readPresentationSnapshot(workspaceDir: string): Promise<PresentationSnapshot | null> {
  const revision = await readPresentationRevision(workspaceDir);
  if (!revision) return null;
  const paths = buildPresentationStorePaths(workspaceDir);
  return {
    document: revision.document,
    originalModel: await readJson(paths.originalModel),
    sourceMap: await readJson(paths.sourceMap),
  };
}
