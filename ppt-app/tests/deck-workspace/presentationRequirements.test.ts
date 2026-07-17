import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PresentationRequirementsPage } from "../../src/features/requirements/PresentationRequirementsPage";
import {
  confirmedRequirementsAllowOutline,
  createRequirementsDraft,
  projectRequirementsToLegacyInputs,
  requirementsOwnedRecoveryStage,
} from "../../src/features/requirements/presentationRequirements";
import { messages } from "../../src/i18n/messages";

const candidates = {
  audience: [{ label: "管理层", description: "面向负责决策的管理层。" }],
  purpose: [{ label: "方案评审", description: "用于评审方案并确定下一步。" }],
  desired_outcome: [{ label: "批准执行", description: "推动受众批准后续执行。" }],
  slide_count: [5],
  output_language: ["中文"],
  visual_tone: [{ label: "体育媒体特刊", description: "强视觉、鲜明标题和编辑式阅读节奏。" }],
};

test("defaults every field to the first recommended candidate and projects legacy inputs", () => {
  const draft = createRequirementsDraft("制作一份 5 页中文方案", candidates);
  assert.equal(draft.selections.slide_count, 5);
  assert.equal(draft.selections.output_language, "中文");
  assert.deepEqual(draft.selections.visual_tone, candidates.visual_tone[0]);
  const projection = projectRequirementsToLegacyInputs(draft);
  assert.equal(projection.outputLanguage, "中文");
  assert.equal(projection.contextRows.find((row) => row.id === "slides")?.value, "5");
  assert.match(projection.contextRows.find((row) => row.id === "visual_tone")?.value ?? "", /体育媒体特刊/);
});

test("only confirmed presentation requirements allow outline work", () => {
  assert.equal(confirmedRequirementsAllowOutline({ status: "draft" }), false);
  assert.equal(confirmedRequirementsAllowOutline({ status: "confirmed" }), true);
  assert.equal(confirmedRequirementsAllowOutline(null), false);
});

test("draft presentation requirements own workspace recovery even when later artifacts exist", () => {
  assert.equal(requirementsOwnedRecoveryStage({ status: "empty" }), "brief");
  assert.equal(requirementsOwnedRecoveryStage({ status: "draft" }), "requirements");
  assert.equal(requirementsOwnedRecoveryStage({ status: "confirmed" }), null);
});

test("renders loading, candidates, Other inputs, and the final confirmation action", () => {
  const draft = createRequirementsDraft("制作一份 5 页中文方案", candidates);
  const common = {
    t: messages.zh,
    brief: draft.source!.brief,
    requirements: draft,
    error: "",
    saving: false,
    confirming: false,
    dirty: true,
    hasSavedDraft: true,
    onSelect: () => undefined,
    onRetry: () => undefined,
    onManual: () => undefined,
    onBack: () => undefined,
    onSave: () => undefined,
    onConfirm: () => undefined,
  };
  const ready = renderToStaticMarkup(createElement(PresentationRequirementsPage, { ...common, status: "ready" }));
  assert.match(ready, /体育媒体特刊/);
  assert.equal((ready.match(/>其他</g) ?? []).length, 6);
  assert.match(ready, /<details class="requirements-brief">/);
  assert.match(ready, /用户需求/);
  assert.match(ready, />保存</);
  assert.match(ready, />返回</);
  assert.match(ready, /确认并继续/);
  const loading = renderToStaticMarkup(createElement(PresentationRequirementsPage, { ...common, status: "loading" }));
  assert.match(loading, /正在梳理演示需求\.\.\./);
  assert.match(loading, /requirements-breathing-mark/);
  assert.doesNotMatch(loading, />返回</);
});

test("shows a generated draft as saved until the user edits it", () => {
  const draft = createRequirementsDraft("制作一份 5 页中文方案", candidates);
  const html = renderToStaticMarkup(createElement(PresentationRequirementsPage, {
    t: messages.zh,
    brief: draft.source!.brief,
    requirements: draft,
    status: "ready",
    error: "",
    saving: false,
    confirming: false,
    dirty: false,
    hasSavedDraft: true,
    onSelect: () => undefined,
    onRetry: () => undefined,
    onManual: () => undefined,
    onBack: () => undefined,
    onSave: () => undefined,
    onConfirm: () => undefined,
  }));

  assert.match(html, /草稿已保存/);
  assert.doesNotMatch(html, /有未保存的修改/);
  assert.match(html, /<button class="secondary-btn" type="button" disabled="">/);
});

test("shows confirmation separately from draft saving", () => {
  const draft = createRequirementsDraft("制作一份 5 页中文方案", candidates);
  const html = renderToStaticMarkup(createElement(PresentationRequirementsPage, {
    t: messages.zh,
    brief: draft.source!.brief,
    requirements: draft,
    status: "ready",
    error: "",
    saving: false,
    confirming: true,
    dirty: false,
    hasSavedDraft: true,
    onSelect: () => undefined,
    onRetry: () => undefined,
    onManual: () => undefined,
    onBack: () => undefined,
    onSave: () => undefined,
    onConfirm: () => undefined,
  }));

  assert.match(html, /正在确认\.\.\./);
  assert.doesNotMatch(html, /正在保存草稿\.\.\./);
});
