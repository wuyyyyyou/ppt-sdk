import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomInt } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const previousHome = process.env.HOME;
const homeDir = await mkdtemp(path.join(os.tmpdir(), "presenton-page-fingerprint-home-"));
process.env.HOME = homeDir;

const { getAppWorkspacePageFileFingerprints } = await import("../../src/app-workspace/index.ts");

test.after(async () => {
  if (previousHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = previousHome;
  }
  await rm(homeDir, { recursive: true, force: true });
});

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function createWorkspaceDir(homeDir: string) {
  const suffix = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return path.join(homeDir, "anna-workspace", "ppt", `ppt-20260624-${suffix}`);
}

async function createFingerprintWorkspace(homeDir: string) {
  const workspaceDir = createWorkspaceDir(homeDir);
  const templateDir = path.join(workspaceDir, "template");
  const slidePath = path.join(templateDir, "slides", "page-01.tsx");
  const dataPath = path.join(templateDir, "data", "page-01.json");
  const slideContent = "export default function Slide() { return <div>Hash me</div>; }\n";
  const dataContent = JSON.stringify({ title: "Hash me" }, null, 2) + "\n";

  await mkdir(path.dirname(slidePath), { recursive: true });
  await mkdir(path.dirname(dataPath), { recursive: true });
  await writeFile(slidePath, slideContent, "utf8");
  await writeFile(dataPath, dataContent, "utf8");
  await writeJson(path.join(templateDir, "manifest.json"), {
    title: "Fingerprint fixture",
    slides: [],
  });
  await writeJson(path.join(workspaceDir, "task.json"), {
    title: "Legacy fingerprint fixture",
    updated_at: "2026-06-24T00:00:00.000Z",
  });
  await writeJson(path.join(workspaceDir, "template.json"), {
    version: 1,
    selected_template_group: "fixture",
    selected_template_group_name: "Fixture",
    template_dir: templateDir,
    manifest_path: path.join(templateDir, "manifest.json"),
    catalog_json_path: path.join(templateDir, "catalog.json"),
    data_dir_path: path.join(templateDir, "data"),
    selected_at: "2026-06-24T00:00:00.000Z",
  });

  return {
    workspaceDir,
    slidePath,
    dataPath,
    slideContent,
    dataContent,
  };
}

test("getAppWorkspacePageFileFingerprints returns hashes for current page files", async () => {
  const fixture = await createFingerprintWorkspace(homeDir);

  const result = await getAppWorkspacePageFileFingerprints({
    workspace_dir: fixture.workspaceDir,
    slide_path: "./slides/page-01.tsx",
    data_path: "./data/page-01.json",
  });

  assert.equal(result.workspace_dir, fixture.workspaceDir);
  assert.equal(result.slide.path, fixture.slidePath);
  assert.equal(result.slide.sha256, sha256Hex(fixture.slideContent));
  assert.equal(result.slide.size_bytes, Buffer.byteLength(fixture.slideContent));
  assert.equal(result.data.path, fixture.dataPath);
  assert.equal(result.data.sha256, sha256Hex(fixture.dataContent));
  assert.equal(result.data.size_bytes, Buffer.byteLength(fixture.dataContent));
});

test("getAppWorkspacePageFileFingerprints rejects paths outside the template directory", async () => {
  const fixture = await createFingerprintWorkspace(homeDir);

  await assert.rejects(
    getAppWorkspacePageFileFingerprints({
      workspace_dir: fixture.workspaceDir,
      slide_path: "../outside.tsx",
      data_path: "./data/page-01.json",
    }),
    /escapes template directory/,
  );
});
