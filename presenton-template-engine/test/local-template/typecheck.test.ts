import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { assertLocalTemplateTypecheck } from "../../src/local-template/typecheck.ts";

async function writeFixtureFile(filePath: string, lines: string[]) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

test("passes a local TSX slide with correctly shaped component props", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "presenton-local-template-typecheck-"));

  try {
    await writeFixtureFile(path.join(rootDir, "components", "PillarCard.tsx"), [
      'import React from "react";',
      "",
      "export type PillarCardProps = {",
      "  title: string;",
      "  icon: 'shield' | 'box';",
      "  items: Array<{ lead: string; body: string }>;",
      "};",
      "",
      "export default function PillarCard({ title, icon, items }: PillarCardProps) {",
      "  return <section data-icon={icon}><h2>{title}</h2>{items.map((item) => <p key={item.lead}>{item.body}</p>)}</section>;",
      "}",
      "",
    ]);
    await writeFixtureFile(path.join(rootDir, "slides", "Slide.tsx"), [
      'import React from "react";',
      'import * as z from "zod";',
      'import PillarCard from "../components/PillarCard.tsx";',
      "",
      "export const Schema = z.object({ title: z.string().default('Title') });",
      "export const layoutId = 'typecheck-pass';",
      "export const layoutName = 'Typecheck Pass';",
      "export const layoutDescription = 'Valid component props.';",
      "export default function Slide() {",
      "  return <PillarCard title=\"Valid\" icon=\"shield\" items={[{ lead: 'A', body: 'Body' }]} />;",
      "}",
      "",
    ]);

    await assert.doesNotReject(() =>
      assertLocalTemplateTypecheck({
        entryPath: path.join(rootDir, "slides", "Slide.tsx"),
        cwd: rootDir,
      })
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("reports local component prop contract errors before rendering", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "presenton-local-template-typecheck-"));

  try {
    await writeFixtureFile(path.join(rootDir, "components", "PillarCard.tsx"), [
      'import React from "react";',
      "",
      "export type PillarCardProps = {",
      "  title: string;",
      "  icon: 'shield' | 'box';",
      "  items: Array<{ lead: string; body: string }>;",
      "};",
      "",
      "export default function PillarCard({ title, icon, items }: PillarCardProps) {",
      "  return <section data-icon={icon}><h2>{title}</h2>{items.map((item) => <p key={item.lead}>{item.body}</p>)}</section>;",
      "}",
      "",
    ]);
    await writeFixtureFile(path.join(rootDir, "slides", "Slide.tsx"), [
      'import React from "react";',
      'import * as z from "zod";',
      'import PillarCard from "../components/PillarCard.tsx";',
      "",
      "export const Schema = z.object({ title: z.string().default('Title') });",
      "export const layoutId = 'typecheck-fail';",
      "export const layoutName = 'Typecheck Fail';",
      "export const layoutDescription = 'Invalid component props.';",
      "export default function Slide() {",
      "  return <PillarCard title=\"Invalid\" icon={<span />} bullets={[]} />;",
      "}",
      "",
    ]);

    await assert.rejects(
      () =>
        assertLocalTemplateTypecheck({
          entryPath: path.join(rootDir, "slides", "Slide.tsx"),
          cwd: rootDir,
          label: 'slide "page-01"',
        }),
      (error) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Pre-render TypeScript check failed/);
        assert.match(error.message, /TS2322|TS2741/);
        assert.match(error.message, /Element|icon|bullets|items/);
        return true;
      },
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
