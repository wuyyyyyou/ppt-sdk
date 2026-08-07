import { ArrowLeft, ArrowRight, Check, ChevronDown, RefreshCw, Save, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import type {
  PresentationRequirementCandidate,
  PresentationRequirements,
  PresentationRequirementsSelections,
} from "../../api/types";
import type { Messages } from "../../i18n/messages";
import { ErrorNotice } from "../deck-workspace/components/ErrorNotice";
import { requirementsAreCompleteWithoutVisualSelection } from "./presentationRequirements";

type SemanticField = "audience" | "purpose" | "desired_outcome";
type SimpleField = "slide_count" | "output_language";
type RequirementField = SemanticField | SimpleField;

export interface PresentationRequirementsPageProps {
  t: Messages;
  brief: string;
  requirements: PresentationRequirements;
  status: "idle" | "loading" | "ready" | "error";
  error: string;
  errorDetail?: string;
  saving: boolean;
  confirming: boolean;
  dirty: boolean;
  hasSavedDraft: boolean;
  onSelect: <K extends keyof PresentationRequirementsSelections>(
    field: K,
    value: PresentationRequirementsSelections[K],
  ) => void;
  onRetry: () => void;
  onManual: () => void;
  onBack: () => void;
  onForward?: () => void;
  onSave: () => void;
  onConfirm: () => void;
}

const GROUPS: Array<{ title: keyof Messages["requirements"]["groups"]; fields: Array<SemanticField | SimpleField> }> = [
  { title: "content", fields: ["audience", "purpose", "desired_outcome"] },
  { title: "specifications", fields: ["slide_count", "output_language"] },
];

function semanticMatches(
  left: PresentationRequirementCandidate | null,
  right: PresentationRequirementCandidate,
) {
  return left?.label === right.label && left.description === right.description;
}

export function PresentationRequirementsPage(props: PresentationRequirementsPageProps) {
  const { t, brief, requirements, status, error, errorDetail, saving, confirming, dirty, hasSavedDraft, onSelect, onRetry, onManual, onBack, onForward, onSave, onConfirm } = props;
  const [customValues, setCustomValues] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {};
    for (const field of ["audience", "purpose", "desired_outcome"] as const) {
      const selection = requirements.selections[field];
      if (selection && !requirements.candidates[field].some((candidate) => semanticMatches(selection, candidate))) {
        values[field] = selection.description;
      }
    }
    for (const field of ["slide_count", "output_language"] as const) {
      const selection = requirements.selections[field];
      if (selection !== null && !(requirements.candidates[field] as Array<number | string>).includes(selection)) {
        values[field] = String(selection);
      }
    }
    return values;
  });
  const [activeCustomFields, setActiveCustomFields] = useState<Set<RequirementField>>(() => {
    const active = new Set<RequirementField>();
    for (const field of ["audience", "purpose", "desired_outcome"] as const) {
      const selection = requirements.selections[field];
      if (selection && !requirements.candidates[field].some((candidate) => semanticMatches(selection, candidate))) {
        active.add(field);
      }
    }
    for (const field of ["slide_count", "output_language"] as const) {
      const selection = requirements.selections[field];
      if (selection !== null && !(requirements.candidates[field] as Array<number | string>).includes(selection)) {
        active.add(field);
      }
    }
    return active;
  });
  const customInputRefs = useRef<Partial<Record<RequirementField, HTMLInputElement | null>>>({});

  function setCustomFieldActive(field: RequirementField, active: boolean) {
    setActiveCustomFields((current) => {
      const next = new Set(current);
      if (active) next.add(field);
      else next.delete(field);
      return next;
    });
  }

  function clearSelection(field: RequirementField) {
    onSelect(field as never, null as never);
  }

  function setCustomSemantic(field: SemanticField, value: string) {
    setCustomValues((current) => ({ ...current, [field]: value }));
    setCustomFieldActive(field, true);
    onSelect(field, value.trim() ? { label: t.requirements.other, description: value.trim() } : null);
  }

  function setCustomSimple(field: SimpleField, value: string) {
    setCustomValues((current) => ({ ...current, [field]: value }));
    setCustomFieldActive(field, true);
    if (field === "slide_count") {
      const number = Number(value);
      onSelect(field, Number.isInteger(number) && number > 0 ? number : null);
      return;
    }
    const language = value.trim();
    onSelect(field, language && language.toLowerCase() !== "auto" ? language : null);
  }

  function applyCustomValue(field: RequirementField, value: string) {
    if (field === "slide_count" || field === "output_language") {
      setCustomSimple(field, value);
    } else {
      setCustomSemantic(field, value);
    }
  }

  function activateCustomField(field: RequirementField, focusInput = false) {
    setCustomFieldActive(field, true);
    applyCustomValue(field, customValues[field] ?? "");
    if (focusInput) {
      window.setTimeout(() => customInputRefs.current[field]?.focus(), 0);
    }
  }

  function toggleCustomField(field: RequirementField) {
    if (activeCustomFields.has(field)) {
      setCustomFieldActive(field, false);
      clearSelection(field);
      return;
    }
    activateCustomField(field, true);
  }

  function selectCandidate(field: RequirementField, candidate: unknown) {
    setCustomFieldActive(field, false);
    onSelect(field as never, candidate as never);
  }

  if (status === "loading") {
    return (
      <section className="page active requirements-page requirements-loading" aria-live="polite">
        <div className="requirements-breathing-mark"><Sparkles size={26} /></div>
        <h1>{t.requirements.loadingTitle}</h1>
        <p>{t.requirements.loadingBody}</p>
        <div className="requirements-loading-lines" aria-hidden="true"><span /><span /><span /></div>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="page active requirements-page requirements-error">
        <h1>{t.requirements.errorTitle}</h1>
        <ErrorNotice
          t={t}
          tone="block"
          summary={error || t.requirements.errorBody}
          detail={errorDetail}
        />
        <div className="requirements-error-actions">
          <button data-performance-id="requirements.create.retry" className="primary-btn" type="button" onClick={onRetry} disabled={saving || confirming}>
            <RefreshCw size={16} aria-hidden="true" />
            {t.requirements.retry}
          </button>
          <button data-performance-id="requirements.create-manually" className="secondary-btn" type="button" onClick={onManual} disabled={saving || confirming}>
            {t.requirements.manual}
          </button>
          <button data-performance-id="requirements.back" className="secondary-btn" type="button" onClick={onBack}>{t.requirements.back}</button>
        </div>
      </section>
    );
  }

  return (
    <section className="page active requirements-page">
      <header className="requirements-header">
        <div><h1>{t.requirements.title}</h1><p>{t.requirements.helper}</p></div>
      </header>

      <details className="requirements-brief">
        <summary>
          <span className="requirements-brief-label">{t.requirements.briefLabel}</span>
          <span className="requirements-brief-preview">{brief}</span>
          <ChevronDown size={17} />
        </summary>
        <p>{brief}</p>
      </details>

      <div className="requirements-groups">
        {GROUPS.map((group) => (
          <section className="requirements-group" key={group.title}>
            <h2>{t.requirements.groups[group.title]}</h2>
            {group.fields.map((field) => {
              const isSemantic = field !== "slide_count" && field !== "output_language";
              const candidates = requirements.candidates[field];
              const selection = requirements.selections[field];
              const customValue = customValues[field] ?? "";
              const customSelected = activeCustomFields.has(field);
              return (
                <fieldset className="requirement-field" key={field}>
                  <legend>{t.requirements.fields[field]}</legend>
                  <div className="requirement-options">
                    {candidates.map((candidate, index) => {
                      const selected = isSemantic
                        ? semanticMatches(selection as PresentationRequirementCandidate | null, candidate as PresentationRequirementCandidate)
                        : selection === candidate;
                      const label = isSemantic ? (candidate as PresentationRequirementCandidate).label : String(candidate);
                      const description = isSemantic ? (candidate as PresentationRequirementCandidate).description : "";
                      return (
                        <button
                          data-performance-id={`requirements.${field}.select-candidate`}
                          type="button"
                          className={`requirement-option ${selected ? "selected" : ""}`}
                          onClick={() => selectCandidate(field, candidate)}
                          key={`${label}-${index}`}
                        >
                          <span className="requirement-radio">{selected ? <Check size={13} strokeWidth={3} /> : null}</span>
                          <span><strong>{label}</strong>{description ? <small>{description}</small> : null}</span>
                          {index === 0 ? <em>{t.requirements.recommended}</em> : null}
                        </button>
                      );
                    })}
                    <div
                      className={`requirement-option requirement-custom${customSelected ? " selected" : ""}`}
                      role="radio"
                      aria-checked={customSelected}
                      tabIndex={0}
                      onClick={() => toggleCustomField(field)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                        event.preventDefault();
                        toggleCustomField(field);
                      }}
                    >
                      <span className="requirement-radio">{customSelected ? <Check size={13} strokeWidth={3} /> : null}</span>
                      <span><strong>{t.requirements.other}</strong>
                        <input
                          ref={(element) => { customInputRefs.current[field] = element; }}
                          type={field === "slide_count" ? "number" : "text"}
                          min={field === "slide_count" ? 1 : undefined}
                          value={customValue}
                          disabled={saving || confirming}
                          placeholder={t.requirements.customPlaceholders[field]}
                          onClick={(event) => event.stopPropagation()}
                          onFocus={() => {
                            if (!activeCustomFields.has(field)) activateCustomField(field);
                          }}
                          onChange={(event) => isSemantic
                            ? setCustomSemantic(field as SemanticField, event.target.value)
                            : setCustomSimple(field as SimpleField, event.target.value)}
                        />
                      </span>
                    </div>
                  </div>
                </fieldset>
              );
            })}
          </section>
        ))}
      </div>

      <footer className="requirements-footer">
        <div className="stage-navigation">
          <button data-performance-id="requirements.back" className="secondary-btn" type="button" onClick={onBack}><ArrowLeft size={16} />{t.requirements.back}</button>
          {onForward ? (
            <button data-performance-id="requirements.forward" className="secondary-btn" type="button" onClick={onForward} disabled={saving || confirming}>
              {t.controls.forward}<ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <span>{confirming ? t.requirements.confirming : saving ? t.requirements.saving : dirty ? t.requirements.unsaved : hasSavedDraft ? t.requirements.saved : ""}</span>
        <div className="requirements-footer-actions">
          <button data-performance-id="requirements.save" className="secondary-btn" type="button" disabled={saving || confirming || !dirty} onClick={onSave}>
            <Save size={16} />{t.controls.save}
          </button>
          <button data-performance-id="requirements.confirm" className="primary-btn" type="button" disabled={saving || confirming || !requirementsAreCompleteWithoutVisualSelection(requirements)} onClick={onConfirm}>
            <Check size={16} />{t.requirements.confirm}
          </button>
        </div>
      </footer>
    </section>
  );
}
