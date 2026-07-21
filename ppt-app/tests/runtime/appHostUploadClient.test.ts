import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { createAppHostUploadClient } from "../../src/runtime/appHostUploadClient.ts";
import type { AnnaRuntime } from "../../src/runtime/annaRuntime.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restoreAll();
});

function runtimeWithUpload(): AnnaRuntime {
  return {
    tools: {
      invoke: async () => ({}),
    },
    llm: {
      complete: async () => ({}),
    },
    agent: {
      session: async () => {
        throw new Error("not used");
      },
    },
    upload: {
      negotiate: async (input) => ({
        put_url: "https://uploads.example.test/put",
        headers: {
          "Content-Type": input.mime_type,
          "x-upload-token": "token-1",
        },
        r2_key: "r2/key",
        expires_at: "2026-07-09T12:00:00Z",
      }),
      confirm: async ({ r2_key }) => ({
        download_url: "https://uploads.example.test/get",
        r2_key,
        size_bytes: 5,
        expires_at: "2026-07-09T12:30:00Z",
      }),
    },
  };
}

describe("AppHostUploadClient", () => {
  it("fails clearly when runtime upload APIs are missing", async () => {
    const client = createAppHostUploadClient({
      tools: { invoke: async () => ({}) },
      llm: { complete: async () => ({}) },
      agent: {
        session: async () => {
          throw new Error("not used");
        },
      },
    });

    await assert.rejects(
      () => client.uploadFile(new File(["hello"], "source.txt", { type: "text/plain" }), {
        purpose: "user_artifact",
      }),
      /upload\.negotiate\/upload\.confirm is not available/,
    );
  });

  it("uses negotiate headers unchanged for PUT and returns HostUploadRef", async () => {
    const fetchMock = mock.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(String(url), "https://uploads.example.test/put");
      assert.deepEqual(init?.headers, {
        "Content-Type": "text/plain",
        "x-upload-token": "token-1",
      });
      assert.equal(init?.method, "PUT");
      return new Response("", { status: 200 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createAppHostUploadClient(runtimeWithUpload());
    const ref = await client.uploadFile(new File(["hello"], "source.txt", { type: "text/plain" }), {
      purpose: "user_artifact",
    });

    assert.equal(fetchMock.mock.callCount(), 1);
    assert.deepEqual(ref, {
      transport: "host_upload",
      r2_key: "r2/key",
      url: "https://uploads.example.test/get",
      mime_type: "text/plain",
      size_bytes: 5,
      filename: "source.txt",
      expires_at: "2026-07-09T12:30:00Z",
      expires_in: undefined,
      mode: "negotiate+confirm",
    });
  });

  it("records storage phases without leaking signed URLs", async () => {
    globalThis.fetch = mock.fn(async () => new Response("", { status: 200 })) as typeof fetch;
    const events: Array<{ workspace_dir: string; entry: Record<string, unknown> }> = [];
    const client = createAppHostUploadClient(runtimeWithUpload(), {
      appendWorkspaceLog: async (event) => {
        events.push(event);
      },
    });

    await client.uploadFile(new File(["hello"], "source.txt", { type: "text/plain" }), {
      purpose: "user_artifact",
      metadata: {
        workspace_dir: "/tmp/workspace",
        operation_id: "operation-1",
        interaction_id: "interaction-1",
      },
    });

    assert.deepEqual(events.map((event) => event.entry.event), [
      "storage.transfer.started",
      "storage.transfer.negotiate",
      "storage.transfer.put",
      "storage.transfer.confirm",
      "storage.transfer.finished",
    ]);
    assert.equal(events[0].workspace_dir, "/tmp/workspace");
    assert.equal(events[1].entry.r2_key, "r2/key");
    assert.equal((events[1].entry.response as Record<string, unknown>).put_url, "[REDACTED]");
    assert.equal(events[1].entry.operation_id, "operation-1");
    assert.equal(events[1].entry.interaction_id, "interaction-1");
  });
});
