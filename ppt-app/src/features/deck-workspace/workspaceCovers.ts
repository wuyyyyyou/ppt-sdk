import type { WorkspaceSummary } from "../../api/types";

/**
 * Per-workspace cover state. My Works renders the list as soon as
 * `listWorkspaces()` resolves, then fills covers in independently, so a slow or
 * broken cover can only ever degrade its own card.
 */
export type WorkspaceCoverState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error" };

export type WorkspaceCovers = Record<string, WorkspaceCoverState | undefined>;

export const WORKSPACE_COVER_CONCURRENCY = 4;

export function workspaceDirOf(workspace: WorkspaceSummary): string {
  return workspace.task_dir ?? workspace.workspace_dir;
}

export function completedWorkspaces(workspaces: readonly WorkspaceSummary[]): WorkspaceSummary[] {
  return workspaces.filter((workspace) => workspace.has_deck_html);
}

/**
 * Keeps covers already resolved in this session and drops entries for
 * workspaces that no longer exist, so a refresh only requests what is new,
 * changed or still missing.
 */
export function reconcileWorkspaceCovers(
  previous: WorkspaceCovers,
  workspaces: readonly WorkspaceSummary[],
): { covers: WorkspaceCovers; pending: WorkspaceSummary[] } {
  const covers: WorkspaceCovers = {};
  const pending: WorkspaceSummary[] = [];

  completedWorkspaces(workspaces).forEach((workspace) => {
    const existing = previous[workspace.workspace_id];
    if (existing?.status === "ready") {
      covers[workspace.workspace_id] = existing;
      return;
    }
    covers[workspace.workspace_id] = { status: "loading" };
    pending.push(workspace);
  });

  return { covers, pending };
}

/** Runs `worker` over `items` with a bounded number of in-flight requests. */
export async function mapWithConcurrencyLimit<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const size = Math.max(1, Math.floor(limit));
  let cursor = 0;

  async function runNext(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, runNext));
}
