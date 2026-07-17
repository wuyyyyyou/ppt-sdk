import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPresentationRequirementsRepairRequest,
  buildPresentationRequirementsRequest,
} from "../../src/ai/requirementsPrompt";

function readText(message: { content: { type: string; text: string } }) {
  return message.content.text;
}

test("uses separate system and user prompts and only places the Brief in user content", () => {
  const brief = "Create a five-slide Chinese launch presentation.";
  const request = buildPresentationRequirementsRequest(brief);
  assert.equal(request.messages.length, 2);
  assert.equal(request.messages[0].role, "system");
  assert.match(readText(request.messages[0]), /senior presentation strategist/);
  assert.match(
    readText(request.messages[0]),
    /candidate labels and descriptions in the language primarily used by the Brief/,
  );
  assert.doesNotMatch(readText(request.messages[0]), new RegExp(brief));
  assert.equal(request.messages[1].role, "user");
  assert.match(readText(request.messages[1]), /<brief>/);
  assert.match(readText(request.messages[1]), new RegExp(brief));
});

test("repair request preserves the full conversation and requests all six fields", () => {
  const initial = buildPresentationRequirementsRequest("A brief");
  const repaired = buildPresentationRequirementsRepairRequest(
    initial,
    '{"slide_count":["auto"]}',
    ["slide_count[0] must be a positive integer."],
  );
  assert.equal(repaired.messages.length, 4);
  assert.deepEqual(repaired.messages.slice(0, 2), initial.messages);
  assert.equal(repaired.messages[2].role, "assistant");
  assert.match(readText(repaired.messages[3]), /all six fields/);
  assert.match(readText(repaired.messages[3]), /desired_outcome/);
  assert.match(readText(repaired.messages[3]), /slide_count\[0\]/);
});
