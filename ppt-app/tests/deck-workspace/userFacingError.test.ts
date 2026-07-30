import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyUserFacingError,
  isOpaqueErrorDetail,
  summarizeUserFacingError,
} from "../../src/features/deck-workspace/userFacingError.ts";
import { messages } from "../../src/i18n/messages.ts";

describe("classifyUserFacingError", () => {
  it("recognises the artifact transport failure behind the open-work bug", () => {
    assert.equal(
      classifyUserFacingError("Error: r2_key does not belong to this invoke"),
      "transport",
    );
  });

  it("recognises timeouts, missing files and connectivity problems", () => {
    assert.equal(classifyUserFacingError("Request timed out after 60s"), "timeout");
    assert.equal(classifyUserFacingError("ENOENT: no such file or directory"), "notFound");
    assert.equal(classifyUserFacingError("fetch failed"), "network");
    assert.equal(classifyUserFacingError("something odd"), "unknown");
  });
});

describe("isOpaqueErrorDetail", () => {
  it("treats RPC envelopes and stack traces as unfit for display", () => {
    assert.equal(isOpaqueErrorDetail('{"jsonrpc":"2.0","error":{"code":-32000}}'), true);
    assert.equal(isOpaqueErrorDetail("Boom\n    at run (file.ts:1:1)"), true);
    assert.equal(isOpaqueErrorDetail(""), true);
    assert.equal(isOpaqueErrorDetail("Workspace is locked by another run."), false);
  });
});

describe("summarizeUserFacingError", () => {
  it("replaces the RPC envelope with a readable summary but keeps the detail", () => {
    const raw = '{"jsonrpc":"2.0","error":{"code":-32000,"message":"r2_key does not belong to this invoke"}}';

    const { summary, detail } = summarizeUserFacingError(messages.en, new Error(raw));

    assert.equal(summary, messages.en.errors.summaryTransport);
    assert.equal(detail, raw);
  });

  it("falls back to the caller's message when nothing can be classified", () => {
    const { summary } = summarizeUserFacingError(
      messages.zh,
      new Error('{"jsonrpc":"2.0","error":{"code":-1}}'),
      messages.zh.myWork.openFailed,
    );

    assert.equal(summary, messages.zh.myWork.openFailed);
  });

  it("keeps a short human-written backend message as the summary", () => {
    const { summary } = summarizeUserFacingError(messages.en, new Error("Workspace is locked by another run."));

    assert.equal(summary, "Workspace is locked by another run.");
  });
});
