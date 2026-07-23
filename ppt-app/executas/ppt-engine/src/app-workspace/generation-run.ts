import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { copyFile, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type AppGenerationRunKind = "deck-generation" | "page-refinement" | "deck-refinement";
export type AppGenerationRunState = "preparing" | "active" | "committing" | "committed" | "abandoned";

export interface AppGenerationRunTransaction {
  schema_version: 1;
  run_id: string;
  workspace_id: string;
  run_kind: AppGenerationRunKind;
  state: AppGenerationRunState;
  official_workspace_dir: string;
  shadow_workspace_dir: string;
  previous_workspace_dir: string;
  origin_page_id: string | null;
  created_at: string;
  updated_at: string;
}

const queues = new Map<string, Promise<unknown>>();
const workspaceQueues = new Map<string, Promise<unknown>>();

export async function withGenerationWorkspaceLock<T>(workspaceDir: string, operation: () => Promise<T>): Promise<T> {
  const previous = workspaceQueues.get(workspaceDir) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  workspaceQueues.set(workspaceDir, current);
  try { return await current; } finally {
    if (workspaceQueues.get(workspaceDir) === current) workspaceQueues.delete(workspaceDir);
  }
}

function runRoot(workspaceRoot: string, runId: string) {
  return path.join(workspaceRoot, ".generation-runs", runId);
}

function transactionPath(workspaceRoot: string, runId: string) {
  return path.join(runRoot(workspaceRoot, runId), "transaction.json");
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT",
  );
}

async function cleanupOrphanGenerationRun(workspaceRoot: string, runId: string): Promise<void> {
  await rm(runRoot(workspaceRoot, runId), { recursive: true, force: true }).catch(() => undefined);
}

async function atomicWriteJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

async function withRunLock<T>(runId: string, operation: () => Promise<T>): Promise<T> {
  const previous = queues.get(runId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  queues.set(runId, current);
  try {
    return await current;
  } finally {
    if (queues.get(runId) === current) queues.delete(runId);
  }
}

export async function readGenerationRun(workspaceRoot: string, runId: string): Promise<AppGenerationRunTransaction> {
  const value = JSON.parse(await readFile(transactionPath(workspaceRoot, runId), "utf8")) as AppGenerationRunTransaction;
  if (value.schema_version !== 1 || value.run_id !== runId) throw new Error("Invalid generation transaction record");
  return value;
}

async function updateState(workspaceRoot: string, transaction: AppGenerationRunTransaction, state: AppGenerationRunState) {
  const next = { ...transaction, state, updated_at: new Date().toISOString() };
  await atomicWriteJson(transactionPath(workspaceRoot, transaction.run_id), next);
  return next;
}

export async function beginGenerationRun(input: {
  workspace_root: string;
  official_workspace_dir: string;
  workspace_id: string;
  run_kind: AppGenerationRunKind;
  origin_page_id?: string | null;
}): Promise<AppGenerationRunTransaction> {
  const runId = randomUUID();
  const root = runRoot(input.workspace_root, runId);
  const basename = path.basename(input.official_workspace_dir);
  const now = new Date().toISOString();
  const transaction: AppGenerationRunTransaction = {
    schema_version: 1,
    run_id: runId,
    workspace_id: input.workspace_id,
    run_kind: input.run_kind,
    state: "preparing",
    official_workspace_dir: input.official_workspace_dir,
    shadow_workspace_dir: path.join(root, "shadow", basename),
    previous_workspace_dir: path.join(root, "previous", basename),
    origin_page_id: input.origin_page_id?.trim() || null,
    created_at: now,
    updated_at: now,
  };
  await atomicWriteJson(transactionPath(input.workspace_root, runId), transaction);
  return transaction;
}

async function copyTree(source: string, destination: string): Promise<void> {
  const info = await lstat(source);
  if (info.isDirectory()) {
    await mkdir(destination, { recursive: true });
    for (const entry of await readdir(source)) await copyTree(path.join(source, entry), path.join(destination, entry));
    return;
  }
  if (info.isSymbolicLink()) throw new Error(`Shadow Workspace cannot copy symbolic link: ${source}`);
  if (!info.isFile()) throw new Error(`Shadow Workspace cannot copy special file: ${source}`);
  await mkdir(path.dirname(destination), { recursive: true });
  try {
    await copyFile(source, destination, fsConstants.COPYFILE_FICLONE);
  } catch {
    await copyFile(source, destination);
  }
}

async function rebaseTextTree(root: string, from: string, to: string): Promise<void> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await rebaseTextTree(entryPath, from, to);
      continue;
    }
    if (!entry.isFile()) continue;
    const bytes = await readFile(entryPath);
    if (bytes.includes(0)) continue;
    const content = bytes.toString("utf8");
    if (!content.includes(from)) continue;
    await writeFile(entryPath, content.split(from).join(to), "utf8");
  }
}

export async function prepareGenerationRun(workspaceRoot: string, runId: string): Promise<AppGenerationRunTransaction> {
  let transaction = await readGenerationRun(workspaceRoot, runId);
  if (transaction.state === "abandoned") return transaction;
  if (transaction.state !== "preparing") throw new Error(`Generation run cannot be prepared from ${transaction.state}`);
  await rm(transaction.shadow_workspace_dir, { recursive: true, force: true });
  await copyTree(transaction.official_workspace_dir, transaction.shadow_workspace_dir);
  await rebaseTextTree(transaction.shadow_workspace_dir, transaction.official_workspace_dir, transaction.shadow_workspace_dir);
  return withRunLock(runId, async () => {
    transaction = await readGenerationRun(workspaceRoot, runId);
    if (transaction.state === "abandoned") return transaction;
    return updateState(workspaceRoot, transaction, "active");
  });
}

export async function abandonGenerationRun(workspaceRoot: string, runId: string): Promise<AppGenerationRunTransaction> {
  return withRunLock(runId, async () => {
    const transaction = await readGenerationRun(workspaceRoot, runId);
    if (transaction.state === "abandoned") return transaction;
    if (transaction.state === "committing" || transaction.state === "committed") {
      throw new Error("生成结果已进入提交阶段，无法停止。");
    }
    return updateState(workspaceRoot, transaction, "abandoned");
  });
}

export async function commitGenerationRun(workspaceRoot: string, runId: string): Promise<AppGenerationRunTransaction> {
  return withRunLock(runId, async () => {
    let transaction = await readGenerationRun(workspaceRoot, runId);
    if (transaction.state !== "active") throw new Error(`Generation run cannot commit from ${transaction.state}`);
    transaction = await updateState(workspaceRoot, transaction, "committing");
    try {
      await rebaseTextTree(transaction.shadow_workspace_dir, transaction.shadow_workspace_dir, transaction.official_workspace_dir);
      const officialLog = path.join(transaction.official_workspace_dir, ".log");
      const shadowLog = path.join(transaction.shadow_workspace_dir, ".log");
      await rm(shadowLog, { recursive: true, force: true });
      try { await copyTree(officialLog, shadowLog); } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
      }
      await mkdir(path.dirname(transaction.previous_workspace_dir), { recursive: true });
      await rename(transaction.official_workspace_dir, transaction.previous_workspace_dir);
      await rename(transaction.shadow_workspace_dir, transaction.official_workspace_dir);
      return updateState(workspaceRoot, transaction, "committed");
    } catch (error) {
      let restored = false;
      try {
        await lstat(transaction.previous_workspace_dir);
        await rm(transaction.official_workspace_dir, { recursive: true, force: true });
        await rename(transaction.previous_workspace_dir, transaction.official_workspace_dir);
        restored = true;
      } catch { /* recovery is retried on startup */ }
      if (restored) await updateState(workspaceRoot, transaction, "abandoned");
      throw error;
    }
  });
}

export async function cleanupGenerationRun(workspaceRoot: string, runId: string): Promise<void> {
  await withRunLock(runId, async () => {
    const transaction = await readGenerationRun(workspaceRoot, runId);
    if (transaction.state === "active" || transaction.state === "preparing" || transaction.state === "committing") return;
    await rm(runRoot(workspaceRoot, runId), { recursive: true, force: true });
  });
}

export async function findGenerationRunForWorkspace(workspaceRoot: string, workspaceId: string): Promise<AppGenerationRunTransaction | null> {
  const runs = await listGenerationRunsForWorkspace(workspaceRoot, workspaceId);
  return runs.find((transaction) =>
    transaction.state === "preparing" ||
    transaction.state === "active" ||
    transaction.state === "committing" ||
    transaction.state === "abandoned"
  ) ?? null;
}

export async function listGenerationRunsForWorkspace(
  workspaceRoot: string,
  workspaceId: string,
): Promise<AppGenerationRunTransaction[]> {
  const root = path.join(workspaceRoot, ".generation-runs");
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); } catch { return []; }
  const runs: AppGenerationRunTransaction[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const transaction = await readGenerationRun(workspaceRoot, entry.name);
      if (transaction.workspace_id === workspaceId) runs.push(transaction);
    } catch (error) {
      if (isNotFoundError(error)) await cleanupOrphanGenerationRun(workspaceRoot, entry.name);
      // Invalid transaction records remain available for diagnostics.
    }
  }
  return runs.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function recoverGenerationRunForWorkspace(workspaceRoot: string, workspaceId: string): Promise<AppGenerationRunTransaction | null> {
  const root = path.join(workspaceRoot, ".generation-runs");
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); } catch { return null; }
  const active: AppGenerationRunTransaction[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    let transaction: AppGenerationRunTransaction;
    try {
      transaction = await readGenerationRun(workspaceRoot, entry.name);
    } catch (error) {
      if (isNotFoundError(error)) await cleanupOrphanGenerationRun(workspaceRoot, entry.name);
      continue;
    }
    if (transaction.workspace_id !== workspaceId) continue;
    if (transaction.state === "active") {
      active.push(transaction);
      continue;
    }
    if (transaction.state === "committing") {
      try {
        await lstat(transaction.previous_workspace_dir);
        await rm(transaction.official_workspace_dir, { recursive: true, force: true });
        await rename(transaction.previous_workspace_dir, transaction.official_workspace_dir);
      } catch { /* recovery remains best effort and cleanup will retry */ }
    }
    await rm(runRoot(workspaceRoot, transaction.run_id), { recursive: true, force: true }).catch(() => undefined);
  }
  return active.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null;
}
