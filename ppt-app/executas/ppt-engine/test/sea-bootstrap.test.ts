import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const {
  assertExternalAppLayout,
  importExternalApp,
  resolveDistributionRoot,
  resolveExternalAppLayout,
} = require("../scripts/sea-bootstrap.cjs") as {
  assertExternalAppLayout: (layout: ExternalAppLayout) => ExternalAppLayout;
  importExternalApp: (binaryPath: string) => Promise<void>;
  resolveDistributionRoot: (binaryPath: string) => string;
  resolveExternalAppLayout: (binaryPath: string) => ExternalAppLayout;
};

type ExternalAppLayout = {
  distributionRoot: string;
  appRoot: string;
  entryPath: string;
  packageManifestPath: string;
  toolManifestPath: string;
};

async function makeDistributionFixture() {
  const distributionRoot = await mkdtemp(path.join(os.tmpdir(), "ppt-engine-external-app-test-"));
  const binaryPath = path.join(distributionRoot, "bin", "ppt-engine");
  const appRoot = path.join(distributionRoot, "lib", "app");
  await mkdir(path.dirname(binaryPath), { recursive: true });
  await mkdir(appRoot, { recursive: true });
  await writeFile(binaryPath, "binary placeholder", "utf8");
  await writeFile(path.join(appRoot, "package.json"), '{"type":"module"}\n', "utf8");
  await writeFile(path.join(appRoot, "manifest.json"), '{"display_name":"ppt-engine"}\n', "utf8");
  await writeFile(
    path.join(appRoot, "example_plugin.js"),
    "globalThis.__PPT_ENGINE_EXTERNAL_APP_TEST__ = (globalThis.__PPT_ENGINE_EXTERNAL_APP_TEST__ ?? 0) + 1;\n",
    "utf8",
  );
  return { distributionRoot, binaryPath, appRoot };
}

test("SEA bootstrap resolves the external app beside the Binary distribution", async () => {
  const fixture = await makeDistributionFixture();
  const layout = resolveExternalAppLayout(fixture.binaryPath);
  const realDistributionRoot = await realpath(fixture.distributionRoot);
  const realAppRoot = path.join(realDistributionRoot, "lib", "app");

  assert.equal(resolveDistributionRoot(fixture.binaryPath), realDistributionRoot);
  assert.equal(layout.distributionRoot, realDistributionRoot);
  assert.equal(layout.appRoot, realAppRoot);
  assert.equal(layout.entryPath, path.join(realAppRoot, "example_plugin.js"));
  assert.equal(assertExternalAppLayout(layout), layout);
});

test("SEA bootstrap imports the external ESM app without an extraction cache", async () => {
  const fixture = await makeDistributionFixture();
  delete (globalThis as Record<string, unknown>).__PPT_ENGINE_EXTERNAL_APP_TEST__;

  await importExternalApp(fixture.binaryPath);

  assert.equal(
    (globalThis as Record<string, unknown>).__PPT_ENGINE_EXTERNAL_APP_TEST__,
    1,
  );
});

test("SEA bootstrap reports a missing external app entry clearly", async () => {
  const distributionRoot = await mkdtemp(path.join(os.tmpdir(), "ppt-engine-external-app-missing-"));
  const binaryPath = path.join(distributionRoot, "bin", "ppt-engine");
  await mkdir(path.dirname(binaryPath), { recursive: true });
  await writeFile(binaryPath, "binary placeholder", "utf8");

  assert.throws(
    () => assertExternalAppLayout(resolveExternalAppLayout(binaryPath)),
    /Missing external app entry in the ppt-engine Binary distribution/,
  );
});
