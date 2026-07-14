import assert from "node:assert/strict";
import test from "node:test";

import {
  elapsedMs,
  extractCompletionText,
  isTimeoutError,
  toSerializable,
} from "../src/record-utils.js";

test("extractCompletionText supports Anna completion response variants", () => {
  assert.equal(extractCompletionText("plain"), "plain");
  assert.equal(extractCompletionText({ text: "top-level" }), "top-level");
  assert.equal(extractCompletionText({ content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] }), "ab");
  assert.equal(extractCompletionText({ message: { content: { type: "text", text: "nested" } } }), "nested");
});

test("toSerializable preserves error fields and replaces circular references", () => {
  const error = new Error("failed");
  error.code = "E_TEST";
  const value = { error, bigint: 12n };
  value.self = value;

  const serialized = toSerializable(value);
  assert.equal(serialized.error.name, "Error");
  assert.equal(serialized.error.message, "failed");
  assert.equal(serialized.error.code, "E_TEST");
  assert.equal(serialized.bigint, "12n");
  assert.match(serialized.self, /^\[Circular /);
});

test("elapsedMs returns millisecond precision without negative values", () => {
  assert.equal(elapsedMs(10, 25.1234), 15.123);
  assert.equal(elapsedMs(25, 10), 0);
});

test("isTimeoutError recognizes common timeout messages", () => {
  assert.equal(isTimeoutError(new Error("Request timed out")), true);
  assert.equal(isTimeoutError(new Error("请求超时")), true);
  assert.equal(isTimeoutError(new Error("network failed")), false);
});
