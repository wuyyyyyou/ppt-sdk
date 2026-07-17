import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePresentationRequirementsCandidates,
  PresentationRequirementsValidationError,
} from "../../src/ai/requirementsParser";

const validValue = {
  audience: [{ label: "Leadership", description: "Senior leaders making the decision." }],
  purpose: [{ label: "Decision meeting", description: "Support a concrete decision." }],
  desired_outcome: [{ label: "Approve", description: "Secure approval for the next step." }],
  slide_count: [8],
  output_language: ["English"],
  visual_tone: [{ label: "Editorial", description: "A strong editorial reading experience." }],
};

function expectInvalid(value: unknown, expectedError: RegExp) {
  assert.throws(
    () => parsePresentationRequirementsCandidates(JSON.stringify(value)),
    (error) => error instanceof PresentationRequirementsValidationError &&
      expectedError.test(error.errors.join("\n")),
  );
}

test("parses plain and fenced Presentation Requirements JSON", () => {
  assert.deepEqual(
    parsePresentationRequirementsCandidates(JSON.stringify(validValue)),
    validValue,
  );
  assert.deepEqual(
    parsePresentationRequirementsCandidates(`\`\`\`json\n${JSON.stringify(validValue)}\n\`\`\``),
    validValue,
  );
});

test("rejects missing and unexpected fields", () => {
  const { purpose: _purpose, ...missing } = validValue;
  expectInvalid(missing, /missing purpose/);
  expectInvalid({ ...validValue, extra: [] }, /unexpected field extra/);
});

test("requires 1 to 4 candidates", () => {
  expectInvalid({ ...validValue, audience: [] }, /1 to 4/);
  expectInvalid({ ...validValue, slide_count: [1, 2, 3, 4, 5] }, /1 to 4/);
});

test("rejects auto, string slide counts, and duplicate candidates", () => {
  expectInvalid({ ...validValue, output_language: ["auto"] }, /concrete language/);
  expectInvalid({ ...validValue, slide_count: ["8"] }, /positive integer/);
  expectInvalid({ ...validValue, audience: [validValue.audience[0], validValue.audience[0]] }, /duplicate/);
});
