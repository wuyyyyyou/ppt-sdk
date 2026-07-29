import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DOWNLOAD_SINK_ID,
  DOWNLOAD_SINK_LIFETIME_MS,
  startBrowserDownload,
  type DownloadSinkHost,
} from "../../src/features/deck-workspace/browserDownload.ts";

interface FakeFrame {
  id: string;
  hidden: boolean;
  src: string;
  removed: boolean;
  attributes: Record<string, string>;
  style: { display: string };
}

function fakeHost(existing: string[] = []) {
  const created: FakeFrame[] = [];
  const appended: FakeFrame[] = [];
  const removedExisting: string[] = [];
  const host: DownloadSinkHost = {
    getElementById: (id) => existing.includes(id)
      ? { remove: () => removedExisting.push(id) }
      : null,
    createElement: () => {
      const frame: FakeFrame = {
        id: "",
        hidden: false,
        src: "",
        removed: false,
        attributes: {},
        style: { display: "" },
      };
      created.push(frame);
      return {
        get id() { return frame.id; },
        set id(value: string) { frame.id = value; },
        get hidden() { return frame.hidden; },
        set hidden(value: boolean) { frame.hidden = value; },
        get src() { return frame.src; },
        set src(value: string) { frame.src = value; },
        style: frame.style,
        setAttribute: (name, value) => { frame.attributes[name] = value; },
        remove: () => { frame.removed = true; },
      };
    },
    body: { appendChild: (node) => appended.push(node as FakeFrame) },
  };
  return { host, created, appended, removedExisting };
}

describe("export download sink", () => {
  it("loads the signed URL in an offscreen frame instead of the app document", () => {
    const { host, created } = fakeHost();
    const cleanups: Array<{ delay: number; task: () => void }> = [];

    const started = startBrowserDownload(
      "https://storage.example/deck.pptx",
      host,
      (task, delay) => { cleanups.push({ task, delay }); },
    );

    assert.equal(started, true);
    assert.equal(created.length, 1);
    assert.equal(created[0].id, DOWNLOAD_SINK_ID);
    assert.equal(created[0].src, "https://storage.example/deck.pptx");
    assert.equal(created[0].hidden, true);
    assert.equal(created[0].style.display, "none");
    assert.equal(created[0].attributes["aria-hidden"], "true");
    assert.equal(cleanups[0].delay, DOWNLOAD_SINK_LIFETIME_MS);
  });

  it("keeps the frame alive long enough for the browser to take the bytes", () => {
    const { host, created } = fakeHost();
    const cleanups: Array<() => void> = [];

    startBrowserDownload("https://storage.example/deck.pptx", host, (task) => { cleanups.push(task); });
    assert.equal(created[0].removed, false);

    cleanups[0]();
    assert.equal(created[0].removed, true);
  });

  it("drops a sink left over from an earlier download", () => {
    const { host, removedExisting } = fakeHost([DOWNLOAD_SINK_ID]);

    startBrowserDownload("https://storage.example/deck.pptx", host, () => undefined);

    assert.deepEqual(removedExisting, [DOWNLOAD_SINK_ID]);
  });

  it("reports that nothing was attempted without a URL or a document", () => {
    const { host, created } = fakeHost();

    assert.equal(startBrowserDownload("", host, () => undefined), false);
    assert.equal(startBrowserDownload("https://storage.example/deck.pptx", null, () => undefined), false);
    assert.equal(created.length, 0);
  });
});
