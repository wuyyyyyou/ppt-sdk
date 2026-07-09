import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { downloadExportArtifact } from "../../src/features/deck-workspace/exportArtifactDownload.ts";
import type { ExportArtifact } from "../../src/features/deck-workspace/types.ts";

function makeArtifact(overrides: Partial<ExportArtifact> = {}): ExportArtifact {
  return {
    type: "PDF",
    path: "/tmp/workspaces/demo/output/deck.pdf",
    href: "https://uploads.example.test/artifact/demo/deck.pdf",
    fileName: "deck.pdf",
    ...overrides,
  };
}

function makeDocument() {
  const clicks: string[] = [];
  const appended: unknown[] = [];
  return {
    clicks,
    document: {
      body: {
        appendChild(element: unknown) {
          appended.push(element);
        },
      },
      createElement(tagName: string) {
        assert.equal(tagName, "a");
        return {
          href: "",
          download: "",
          rel: "",
          style: { display: "" },
          click() {
            clicks.push(this.href);
          },
          remove() {
            const index = appended.indexOf(this);
            if (index >= 0) appended.splice(index, 1);
          },
        };
      },
    } as unknown as Document,
    appended,
  };
}

describe("downloadExportArtifact", () => {
  it("downloads artifacts through a Blob URL so the browser honors the filename", async () => {
    const fetchMock = mock.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => new Blob(["pdf"], { type: "application/pdf" }),
    } as Response));
    const createdUrls: string[] = [];
    const revokedUrls: string[] = [];
    const documentFixture = makeDocument();
    const openMock = mock.fn();
    const warnMock = mock.fn();

    await downloadExportArtifact(makeArtifact(), {
      fetch: fetchMock as typeof fetch,
      document: documentFixture.document,
      url: {
        createObjectURL(blob: Blob) {
          assert.equal(blob.type, "application/pdf");
          createdUrls.push("blob:deck");
          return "blob:deck";
        },
        revokeObjectURL(url: string) {
          revokedUrls.push(url);
        },
      },
      open: openMock as unknown as typeof window.open,
      warn: warnMock,
      releaseObjectUrl: (callback) => callback(),
    });

    assert.equal(fetchMock.mock.callCount(), 1);
    assert.deepEqual(fetchMock.mock.calls[0].arguments, [
      "https://uploads.example.test/artifact/demo/deck.pdf",
      { cache: "no-store" },
    ]);
    assert.deepEqual(createdUrls, ["blob:deck"]);
    assert.deepEqual(documentFixture.clicks, ["blob:deck"]);
    assert.deepEqual(revokedUrls, ["blob:deck"]);
    assert.equal(openMock.mock.callCount(), 0);
    assert.equal(warnMock.mock.callCount(), 0);
  });

  it("opens the original URL in a new tab when Blob download fails", async () => {
    const fetchMock = mock.fn(async () => ({
      ok: false,
      status: 403,
      blob: async () => new Blob([]),
    } as Response));
    const documentFixture = makeDocument();
    const openMock = mock.fn();
    const warnMock = mock.fn();

    await downloadExportArtifact(makeArtifact({
      href: "https://uploads.example.test/artifact/demo/deck.pptx",
      fileName: "deck.pptx",
      type: "PPTX",
    }), {
      fetch: fetchMock as typeof fetch,
      document: documentFixture.document,
      url: {
        createObjectURL() {
          return "blob:deck";
        },
        revokeObjectURL() {
          throw new Error("must not be called");
        },
      },
      open: openMock as unknown as typeof window.open,
      warn: warnMock,
      releaseObjectUrl: (callback) => callback(),
    });

    assert.equal(warnMock.mock.callCount(), 1);
    assert.equal(openMock.mock.callCount(), 1);
    assert.deepEqual(openMock.mock.calls[0].arguments, [
      "https://uploads.example.test/artifact/demo/deck.pptx",
      "_blank",
      "noopener,noreferrer",
    ]);
    assert.deepEqual(documentFixture.clicks, []);
  });
});
