import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createAppHostFileDownloadClient,
  isUnsupportedHostDownload,
} from "../../src/runtime/appHostFileDownload.ts";
import type { AnnaFilesDownloadInput, AnnaRuntime } from "../../src/runtime/annaRuntime.ts";

function runtimeWith(
  download?: (input: AnnaFilesDownloadInput) => Promise<unknown>,
): AnnaRuntime {
  return {
    tools: { invoke: async () => undefined },
    llm: { complete: async () => undefined },
    agent: { session: async () => { throw new Error("unused"); } },
    ...(download ? { files: { download } } : {}),
  } as AnnaRuntime;
}

class RpcError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

describe("host mediated file download", () => {
  it("hands the Host a path instead of a signed URL", async () => {
    const calls: AnnaFilesDownloadInput[] = [];
    const client = createAppHostFileDownloadClient(runtimeWith(async (input) => {
      calls.push(input);
      return { ok: true };
    }));

    const outcome = await client.download({
      path: "workspaces/ws-1/exports/current.pptx",
      scope: "user",
      filename: "季度回顾.pptx",
    });

    assert.equal(outcome, "downloaded");
    assert.deepEqual(calls, [{
      path: "workspaces/ws-1/exports/current.pptx",
      scope: "user",
      filename: "季度回顾.pptx",
    }]);
  });

  it("omits the optional fields the caller left empty", async () => {
    const calls: AnnaFilesDownloadInput[] = [];
    const client = createAppHostFileDownloadClient(runtimeWith(async (input) => {
      calls.push(input);
    }));

    await client.download({ path: "exports/deck.pdf" });

    assert.deepEqual(calls, [{ path: "exports/deck.pdf" }]);
  });

  it("reports an older Host as unsupported rather than as a failure", async () => {
    const missingNamespace = createAppHostFileDownloadClient(runtimeWith());
    assert.equal(await missingNamespace.download({ path: "exports/deck.pptx" }), "unsupported");

    for (const error of [
      new RpcError(-32601, "unknown method files.download"),
      new RpcError(-32000, "files.download is not implemented"),
      new Error("host_api method files.download not granted"),
    ]) {
      const client = createAppHostFileDownloadClient(runtimeWith(async () => { throw error; }));
      assert.equal(await client.download({ path: "exports/deck.pptx" }), "unsupported");
    }
  });

  it("lets a real failure through so it is not hidden behind the fallback", async () => {
    const client = createAppHostFileDownloadClient(runtimeWith(async () => {
      throw new RpcError(-32602, "path does not exist");
    }));

    await assert.rejects(
      () => client.download({ path: "exports/missing.pptx" }),
      /path does not exist/,
    );
  });

  it("classifies only absent or refused methods as unsupported", () => {
    assert.equal(isUnsupportedHostDownload(new RpcError(-32601, "nope")), true);
    assert.equal(isUnsupportedHostDownload(new Error("files.download is not a function")), true);
    assert.equal(isUnsupportedHostDownload(new RpcError(-32603, "internal error")), false);
    assert.equal(isUnsupportedHostDownload(new Error("session expired")), false);
    assert.equal(isUnsupportedHostDownload(null), false);
  });
});
