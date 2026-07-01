import test from "node:test";
import assert from "node:assert/strict";

import { buildDiscoveryDraftId } from "../../src/features/deck-generation/researchDiscoveryWorkflow.ts";

test("buildDiscoveryDraftId uses deck scope when no target pages are provided", () => {
  assert.equal(
    buildDiscoveryDraftId({
      phase: "web",
      iteration: 1,
      curationRunId: "research-web-discovery-web-1-mjabc123-k9x2pq",
    }),
    "discovery-deck-web-1-mjabc123-k9x2pq",
  );
});

test("buildDiscoveryDraftId preserves single-page identity", () => {
  assert.equal(
    buildDiscoveryDraftId({
      phase: "visual",
      iteration: 2,
      curationRunId: "research-visual-discovery-visual-2-mjabc456-a8c0de",
      targetPageIds: ["page-06"],
      allPageIds: ["page-01", "page-06"],
    }),
    "discovery-page-06-visual-2-mjabc456-a8c0de",
  );
});

test("buildDiscoveryDraftId collapses full-deck targets to deck scope", () => {
  assert.equal(
    buildDiscoveryDraftId({
      phase: "web",
      iteration: 1,
      curationRunId: "research-web-discovery-web-1-mjabc123-k9x2pq",
      targetPageIds: ["page-02", "page-01"],
      allPageIds: ["page-01", "page-02"],
    }),
    "discovery-deck-web-1-mjabc123-k9x2pq",
  );
});

test("buildDiscoveryDraftId hashes multi-page scopes independent of input order", () => {
  const first = buildDiscoveryDraftId({
    phase: "web",
    iteration: 3,
    curationRunId: "research-web-discovery-web-3-mjabc789-qw12er",
    targetPageIds: ["page-09", "page-02", "page-06"],
    allPageIds: ["page-01", "page-02", "page-06", "page-09"],
  });
  const second = buildDiscoveryDraftId({
    phase: "web",
    iteration: 3,
    curationRunId: "research-web-discovery-web-3-mjabc789-qw12er",
    targetPageIds: ["page-06", "page-09", "page-02"],
    allPageIds: ["page-01", "page-02", "page-06", "page-09"],
  });

  assert.equal(first, second);
  assert.match(first, /^discovery-pages-3-[a-z0-9]+-web-3-mjabc789-qw12er$/);
});

test("buildDiscoveryDraftId keeps long multi-page scopes under a safe basename length", () => {
  const pageIds = Array.from({ length: 60 }, (_, index) => `page-${String(index + 1).padStart(2, "0")}`);
  const draftId = buildDiscoveryDraftId({
    phase: "visual",
    iteration: 5,
    curationRunId: "research-visual-discovery-visual-5-mjabc999-z9y8x7",
    targetPageIds: pageIds.slice(0, 45),
    allPageIds: pageIds,
  });
  const basename = `${draftId}-visual.json`;

  assert.match(draftId, /^discovery-pages-45-[a-z0-9]+-visual-5-mjabc999-z9y8x7$/);
  assert.ok(basename.length < 120, basename);
});

test("buildDiscoveryDraftId sanitizes unsafe filename characters", () => {
  const draftId = buildDiscoveryDraftId({
    phase: "web",
    iteration: 1,
    curationRunId: "research web/discovery web 1/mjabc123/k9x2pq",
    targetPageIds: ["Page 06 / Côte d'Ivoire"],
    allPageIds: ["page-01", "Page 06 / Côte d'Ivoire"],
  });

  assert.equal(draftId, "discovery-Page-06-C-te-d-Ivoire-web-1-mjabc123-k9x2pq");
  assert.match(draftId, /^[a-zA-Z0-9_-]+$/);
});
