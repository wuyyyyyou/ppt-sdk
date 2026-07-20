import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  invokeTaskStateMachine,
  type JsonRpcSuccessResponse,
} from "../../src/task-state-machine/rpc/index.ts";

async function invokeTool<T>(tool: string, args: Record<string, unknown>): Promise<T> {
  const response = await invokeTaskStateMachine({
    jsonrpc: "2.0",
    id: `${tool}-test`,
    method: "invoke",
    params: {
      tool,
      arguments: args,
    },
  });

  assert.ok("result" in response, JSON.stringify(response));
  return (response as JsonRpcSuccessResponse<T>).result.data;
}

test("task workflow uses one semantics path through query, page progress, and promote", async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), "ppt-task-semantics-"));

  try {
    await invokeTool("create_task_project", {
      project_dir: projectDir,
      title: "语义层回归",
    });
    await invokeTool("record_requirements", {
      project_dir: projectDir,
      requirements: {
        topic: "状态语义",
        audience: "维护者",
        scenario: "架构重构",
        pageCount: 2,
      },
    });
    await invokeTool("record_outline", {
      project_dir: projectDir,
      outline: {
        narrative: "先说明问题，再说明方案。",
        sections: ["问题", "方案"],
        pages: [
          {
            pageId: "page-1",
            pageNumber: 1,
            title: "问题",
            goal: "说明状态漂移",
            coreMessage: "状态语义需要集中",
          },
          {
            pageId: "page-2",
            pageNumber: 2,
            title: "方案",
            goal: "说明统一语义层",
            coreMessage: "查询和写入共享语义",
          },
        ],
      },
    });

    const initialQuery = await invokeTool<{
      snapshot: { deckState: string; allPagesLocked: boolean };
      recommendation: { stage: string; promotePath: string };
    }>("query_task_state", {
      project_dir: projectDir,
      response_mode: "compact",
    });
    assert.equal(initialQuery.snapshot.deckState, "outline_ready");
    assert.equal(initialQuery.recommendation.stage, "outline_ready");
    await assertPromoteExists(initialQuery.recommendation.promotePath);

    await completePage(projectDir, "page-1", 1);

    const afterFirstPage = await invokeTool<{
      snapshot: { deckState: string; pageState: string; allPagesLocked: boolean };
      recommendation: { stage: string };
    }>("query_task_state", {
      project_dir: projectDir,
      response_mode: "compact",
    });
    assert.equal(afterFirstPage.snapshot.deckState, "page_iteration_active");
    assert.equal(afterFirstPage.snapshot.pageState, "page_locked");
    assert.equal(afterFirstPage.snapshot.allPagesLocked, false);
    assert.equal(afterFirstPage.recommendation.stage, "page_iteration_active:page_locked");

    await completePage(projectDir, "page-2", 2);

    const finalCompact = await invokeTool<{
      snapshot: { deckState: string; allPagesLocked: boolean; pageState: string };
      recommendation: { stage: string; promotePath: string };
    }>("query_task_state", {
      project_dir: projectDir,
      response_mode: "compact",
    });
    assert.equal(finalCompact.snapshot.deckState, "deck_html_ready");
    assert.equal(finalCompact.snapshot.allPagesLocked, true);
    assert.equal(finalCompact.recommendation.stage, "deck_html_ready");
    await assertPromoteExists(finalCompact.recommendation.promotePath);

    const finalFull = await invokeTool<{
      snapshot: { state: { deckState: string; allPagesLocked: boolean; pageState: string } };
      recommendation: { deckState: string; pageState: string };
    }>("query_task_state", {
      project_dir: projectDir,
      response_mode: "full",
    });
    assert.equal(finalFull.snapshot.state.deckState, finalCompact.snapshot.deckState);
    assert.equal(finalFull.snapshot.state.allPagesLocked, finalCompact.snapshot.allPagesLocked);
    assert.equal(finalFull.recommendation.deckState, finalCompact.snapshot.deckState);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("recovery rebuilds progress and returns a queryable safe state", async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), "ppt-task-recovery-"));

  try {
    await invokeTool("create_task_project", {
      project_dir: projectDir,
      title: "恢复语义回归",
    });
    await invokeTool("record_outline", {
      project_dir: projectDir,
      outline: {
        narrative: "恢复测试。",
        sections: ["恢复"],
        pages: [
          {
            pageId: "page-1",
            pageNumber: 1,
            title: "恢复",
            goal: "验证恢复",
            coreMessage: "恢复后状态可查询",
          },
        ],
      },
    });

    await rm(path.join(projectDir, "task-state", "page-progress.json"), { force: true });
    const recoveredProgress = await invokeTool<{
      recovered: boolean;
      repairedFiles: string[];
      state: { deckState: string };
    }>("recover_task_project", {
      project_dir: projectDir,
    });
    assert.equal(recoveredProgress.recovered, true);
    assert.ok(recoveredProgress.repairedFiles.includes("page-progress.json"));

    await invokeTool("start_page_iteration", {
      project_dir: projectDir,
      page_id: "page-1",
      page_number: 1,
    });
    await rm(path.join(projectDir, "task-state", "current-page.json"), { force: true });
    const recoveredCurrentPage = await invokeTool<{
      state: { deckState: string; blockedBy: string[]; allowedTransitions: string[] };
    }>("recover_task_project", {
      project_dir: projectDir,
    });

    assert.equal(recoveredCurrentPage.state.deckState, "outline_ready");
    assert.deepEqual(recoveredCurrentPage.state.blockedBy, ["current_page_missing"]);
    assert.deepEqual(recoveredCurrentPage.state.allowedTransitions, ["page_iteration_active"]);

    const queryAfterRecovery = await invokeTool<{
      snapshot: { deckState: string; blockedBy: string[]; allowedTransitions: string[] };
      recommendation: { deckState: string };
    }>("query_task_state", {
      project_dir: projectDir,
      response_mode: "compact",
    });
    assert.equal(queryAfterRecovery.snapshot.deckState, "outline_ready");
    assert.deepEqual(queryAfterRecovery.snapshot.blockedBy, ["current_page_missing"]);
    assert.deepEqual(queryAfterRecovery.snapshot.allowedTransitions, ["page_iteration_active"]);

    await invokeTool("advance_task_state", {
      project_dir: projectDir,
      target_deck_state: "pptx_ready",
      reason: "测试 escape hatch 可用，但不是推荐动作主线。",
    });
    const escapeHatchQuery = await invokeTool<{
      recommendation: { deckState: string; stage: string };
    }>("query_task_state", {
      project_dir: projectDir,
      response_mode: "compact",
    });
    assert.equal(escapeHatchQuery.recommendation.deckState, "pptx_ready");
    assert.equal(escapeHatchQuery.recommendation.stage, "pptx_ready");
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

async function completePage(projectDir: string, pageId: string, pageNumber: number): Promise<void> {
  await invokeTool("start_page_iteration", {
    project_dir: projectDir,
    page_id: pageId,
    page_number: pageNumber,
  });
  await invokeTool("record_page_progress", {
    project_dir: projectDir,
    page_id: pageId,
    page_state: "page_authoring",
    summary: "页面实现完成",
  });
  await invokeTool("record_page_progress", {
    project_dir: projectDir,
    page_id: pageId,
    page_state: "page_rendered",
    summary: "页面已渲染",
    rendered_png_path: path.join(projectDir, "output", "screenshots", `${pageId}.png`),
  });
  const reviewQuery = await invokeTool<{
    snapshot: { pageState: string };
    recommendation: { stage: string };
  }>("query_task_state", {
    project_dir: projectDir,
    response_mode: "compact",
  });
  assert.equal(reviewQuery.snapshot.pageState, "page_review");
  assert.equal(reviewQuery.recommendation.stage, "page_iteration_active:page_review");

  await invokeTool("record_page_progress", {
    project_dir: projectDir,
    page_id: pageId,
    page_state: "page_accepted",
    summary: "页面通过审查",
    review_notes: "截图无明显问题",
  });
  await invokeTool("record_page_progress", {
    project_dir: projectDir,
    page_id: pageId,
    page_state: "page_locked",
    summary: "页面已锁定",
  });
}

async function assertPromoteExists(filePath: string): Promise<void> {
  const content = await readFile(filePath, "utf8");
  assert.match(content, /promote|阶段|行动|Task/i);
}
