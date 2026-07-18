import assert from "node:assert/strict";
import test from "node:test";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  fingerprintWorkspacePageSource,
  installWorkspaceAuthoringKit,
  prepareWorkspacePageSources,
  reconcileWorkspacePageSources,
} from "../../src/authoring-kit-workspace/index.ts";

async function withWorkspace(fn: (workspaceDir: string) => Promise<void>) {
  const tempRoot = path.join(process.cwd(), "test", ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const workspaceDir = await mkdtemp(path.join(tempRoot, "authoring-workspace-"));
  try {
    await fn(workspaceDir);
  } finally {
    await rm(workspaceDir, { recursive: true, force: true });
  }
}

async function writeConfirmedOutline(
  workspaceDir: string,
  items: Array<Record<string, unknown>>,
) {
  await writeFile(
    path.join(workspaceDir, "outline.json"),
    `${JSON.stringify({
      version: 2,
      title: "Authoring Workspace",
      status: "confirmed",
      items,
      source: {},
      updated_at: null,
    }, null, 2)}\n`,
    "utf8",
  );
}

test("installs the Authoring Kit once and leaves an existing copy unchanged", async () => {
  await withWorkspace(async (workspaceDir) => {
    const first = await installWorkspaceAuthoringKit({ workspace_dir: workspaceDir });
    const readmePath = path.join(workspaceDir, "authoring-kit", "README.md");
    await writeFile(readmePath, "locally changed\n", "utf8");
    const second = await installWorkspaceAuthoringKit({ workspace_dir: workspaceDir });

    assert.equal(first.installed, true);
    assert.equal(second.installed, false);
    assert.equal(await readFile(readmePath, "utf8"), "locally changed\n");
    await assert.rejects(
      () => readFile(path.join(workspaceDir, "authoring-kit.lock.json"), "utf8"),
      /ENOENT/,
    );
    await assert.rejects(
      () => readFile(path.join(workspaceDir, "authoring-kit", "page-source-starters"), "utf8"),
      /ENOENT|EISDIR/,
    );
    await assert.rejects(
      () => access(path.join(
        workspaceDir,
        "authoring-kit",
        "foundations",
        "SlideCanvas.preview.tsx",
      )),
      /ENOENT/,
    );
    for (const foundationName of ["SlideCanvas.tsx", "StableInlineRow.tsx", "IconText.tsx", "MeasuredChartArea.tsx"]) {
      await access(path.join(workspaceDir, "authoring-kit", "foundations", foundationName));
    }
    for (const referencePath of [
      ["charts", "BarChart.tsx"],
      ["charts", "LineChart.tsx"],
      ["charts", "RadarChart.tsx"],
      ["charts", "DonutChart.tsx"],
      ["cards", "NumberedAgendaCard.tsx"],
      ["cards", "NarrativeListItem.tsx"],
      ["cards", "DualValueMetricCard.tsx"],
      ["cards", "ProgressStatusCard.tsx"],
      ["comparison", "ComparisonPanel.tsx"],
      ["comparison", "ComparisonMatrix.tsx"],
      ["timelines", "HorizontalRoadmap.tsx"],
      ["timelines", "VerticalMilestones.tsx"],
      ["media", "ImageShowcase.tsx"],
      ["pages", "ChartWithNarrative.tsx"],
      ["pages", "ImageNarrative.tsx"],
      ["pages", "KpiSummary.tsx"],
    ]) {
      await access(path.join(workspaceDir, "authoring-kit", "references", ...referencePath));
    }
    await assert.rejects(
      () => access(path.join(
        workspaceDir,
        "authoring-kit",
        "references",
        "charts",
        "BarChart.preview.tsx",
      )),
      /ENOENT/,
    );
    await assert.rejects(
      () => access(path.join(workspaceDir, "authoring-kit", "DEVELOPMENT.md")),
      /ENOENT/,
    );
  });
});

test("prepares stable Page Sources and a minimal rebuildable manifest", async () => {
  await withWorkspace(async (workspaceDir) => {
    await writeConfirmedOutline(workspaceDir, [
      { title: "First", outline: "First page" },
      { title: "Second", outline: "Second page" },
    ]);
    const first = await prepareWorkspacePageSources({ workspace_dir: workspaceDir });

    assert.equal(first.created_page_ids.length, 2);
    assert.equal(first.manifest.slides.length, 2);
    assert.match(first.outline.items[0]!.page_id, /^page-/);
    assert.deepEqual(first.manifest.slides[0], {
      id: first.outline.items[0]!.page_id,
      source: `./slides/${first.outline.items[0]!.page_id}.tsx`,
    });
    assert.match(
      await readFile(path.join(workspaceDir, first.manifest.slides[0]!.source), "utf8"),
      /<SlideCanvas \/>/,
    );
    assert.match(
      await readFile(path.join(workspaceDir, first.manifest.slides[0]!.source), "utf8"),
      /authoring-kit\/foundations\/SlideCanvas\.tsx/,
    );

    const retainedId = first.outline.items[1]!.page_id;
    await writeConfirmedOutline(workspaceDir, [
      first.outline.items[0]!,
      { title: "Inserted", outline: "Inserted page" },
      first.outline.items[1]!,
    ]);
    const second = await prepareWorkspacePageSources({ workspace_dir: workspaceDir });
    assert.equal(second.created_page_ids.length, 1);
    assert.equal(second.outline.items[2]!.page_id, retainedId);
    assert.equal(second.manifest.slides[2]!.source, `./slides/${retainedId}.tsx`);

    const removedId = second.outline.items[1]!.page_id;
    await writeConfirmedOutline(workspaceDir, [
      second.outline.items[0]!,
      second.outline.items[2]!,
    ]);
    const third = await prepareWorkspacePageSources({ workspace_dir: workspaceDir });
    assert.equal(third.manifest.slides.some((slide) => slide.id === removedId), false);
    assert.match(
      await readFile(path.join(workspaceDir, "slides", `${removedId}.tsx`), "utf8"),
      /<SlideCanvas \/>/,
    );
  });
});

test("fingerprints only the requested Page Source", async () => {
  await withWorkspace(async (workspaceDir) => {
    await writeConfirmedOutline(workspaceDir, [{ title: "Only", outline: "Only page" }]);
    const prepared = await prepareWorkspacePageSources({ workspace_dir: workspaceDir });
    const pageId = prepared.outline.items[0]!.page_id;
    const fingerprint = await fingerprintWorkspacePageSource({
      workspace_dir: workspaceDir,
      page_id: pageId,
    });
    assert.equal(fingerprint.path, path.join(workspaceDir, "slides", `${pageId}.tsx`));
    assert.ok(fingerprint.size_bytes > 0);

  });
});

test("reconciles only missing pending Page Sources", async () => {
  await withWorkspace(async (workspaceDir) => {
    await writeConfirmedOutline(workspaceDir, [{ title: "Pending", outline: "Pending page" }]);
    const prepared = await prepareWorkspacePageSources({ workspace_dir: workspaceDir });
    const pageId = prepared.outline.items[0]!.page_id;
    const sourcePath = path.join(workspaceDir, "slides", `${pageId}.tsx`);
    await writeFile(path.join(workspaceDir, "page-progress.json"), `${JSON.stringify({
      version: 1,
      status: "running",
      pages: [{ page_id: pageId, status: "pending" }],
      updated_at: null,
    }, null, 2)}\n`, "utf8");
    await rm(sourcePath, { force: true });
    const repaired = await reconcileWorkspacePageSources({ workspace_dir: workspaceDir });
    assert.deepEqual(repaired.repaired_page_ids, [pageId]);
    await rm(sourcePath, { force: true });
    await writeFile(path.join(workspaceDir, "page-progress.json"), `${JSON.stringify({
      version: 1,
      status: "running",
      pages: [{ page_id: pageId, status: "rendering" }],
      updated_at: null,
    }, null, 2)}\n`, "utf8");
    await assert.rejects(
      reconcileWorkspacePageSources({ workspace_dir: workspaceDir }),
      /cannot be resumed/,
    );
  });
});
