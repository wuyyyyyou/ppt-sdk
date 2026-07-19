import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

type ZipEntry = {
  name: string;
  content: Buffer;
};

function readZipEntries(bytes: Buffer): ZipEntry[] {
  let eocdOffset = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65_557); index -= 1) {
    if (bytes.readUInt32LE(index) === 0x06054b50) {
      eocdOffset = index;
      break;
    }
  }
  assert.notEqual(eocdOffset, -1, "ZIP end-of-central-directory record is missing");

  const entryCount = bytes.readUInt16LE(eocdOffset + 10);
  let centralOffset = bytes.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    assert.equal(bytes.readUInt32LE(centralOffset), 0x02014b50);
    const compressionMethod = bytes.readUInt16LE(centralOffset + 10);
    const compressedSize = bytes.readUInt32LE(centralOffset + 20);
    const filenameLength = bytes.readUInt16LE(centralOffset + 28);
    const extraLength = bytes.readUInt16LE(centralOffset + 30);
    const commentLength = bytes.readUInt16LE(centralOffset + 32);
    const localOffset = bytes.readUInt32LE(centralOffset + 42);
    const name = bytes.subarray(
      centralOffset + 46,
      centralOffset + 46 + filenameLength,
    ).toString("utf8");

    assert.equal(bytes.readUInt32LE(localOffset), 0x04034b50);
    const localFilenameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const contentOffset = localOffset + 30 + localFilenameLength + localExtraLength;
    const compressed = bytes.subarray(contentOffset, contentOffset + compressedSize);
    const content = compressionMethod === 0
      ? Buffer.from(compressed)
      : compressionMethod === 8
        ? inflateRawSync(compressed)
        : assert.fail(`Unsupported ZIP compression method in test: ${compressionMethod}`);

    entries.push({ name, content });
    centralOffset += 46 + filenameLength + extraLength + commentLength;
  }

  return entries;
}

test("Workspace Diagnostic Bundle includes the complete Workspace tree without modifying it", async () => {
  const previousHome = process.env.HOME;
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "ppt-engine-diagnostic-bundle-home-"));
  process.env.HOME = homeDir;
  try {
    const api = await import("../../src/app-workspace/index.js");
    const created = await api.createAppWorkspace({ title: "Diagnostic bundle" });
    await mkdir(path.join(created.workspace_dir, ".log"), { recursive: true });
    await writeFile(path.join(created.workspace_dir, ".log", "agent.jsonl"), "diagnostic-log\n");
    await mkdir(path.join(created.workspace_dir, "empty-directory"), { recursive: true });
    await mkdir(path.join(created.workspace_dir, "nested", "assets"), { recursive: true });
    await writeFile(path.join(created.workspace_dir, "nested", "assets", "source.txt"), "source-material");
    const outsidePath = path.join(homeDir, "private.txt");
    if (process.platform !== "win32") {
      await writeFile(outsidePath, "must-not-be-archived");
      await symlink(outsidePath, path.join(created.workspace_dir, "external-data"));
    }
    const before = await readdir(created.workspace_dir);

    const bundle = await api.prepareAppWorkspaceDiagnosticBundle({
      workspace_dir: created.workspace_dir,
    });
    try {
      assert.equal(bundle.workspace_id, created.workspace_id);
      assert.equal(bundle.filename, `${created.workspace_id}-workspace-diagnostics.zip`);
      assert.equal(bundle.content_type, "application/zip");
      assert.equal(bundle.aps_path, `workspaces/${created.workspace_id}/diagnostics/current-workspace.zip`);
      assert.ok(bundle.size_bytes > 0);

      const entries = readZipEntries(await readFile(bundle.archive_path));
      const byName = new Map(entries.map((entry) => [entry.name, entry.content]));
      assert.ok(byName.has(`${created.workspace_id}/`));
      assert.ok(byName.has(`${created.workspace_id}/empty-directory/`));
      assert.equal(
        byName.get(`${created.workspace_id}/.log/agent.jsonl`)?.toString("utf8"),
        "diagnostic-log\n",
      );
      assert.equal(
        byName.get(`${created.workspace_id}/nested/assets/source.txt`)?.toString("utf8"),
        "source-material",
      );
      assert.ok(byName.has(`${created.workspace_id}/task.json`));
      if (process.platform !== "win32") {
        const link = entries.find((entry) => entry.name === `${created.workspace_id}/external-data`);
        assert.ok(link);
        assert.equal(link.content.toString("utf8"), outsidePath);
        assert.equal(entries.some((entry) => entry.content.includes("must-not-be-archived")), false);
      }
      assert.deepEqual(await readdir(created.workspace_dir), before);
    } finally {
      await unlink(bundle.archive_path).catch(() => undefined);
    }
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    await rm(homeDir, { recursive: true, force: true });
  }
});
