import { ArrowLeft, Check, ChevronDown, RefreshCw, Save, Sparkles } from "lucide-react";
import { useState } from "react";
import type {
  PresentationRequirementCandidate,
  PresentationRequirements,
  PresentationRequirementsSelections,
} from "../../api/types";
import type { Messages } from "../../i18n/messages";

type SemanticField = "audience" | "purpose" | "desired_outcome" | "visual_tone";
type SimpleField = "slide_count" | "output_language";

export interface PresentationRequirementsPageProps {
  t: Messages;
  brief: string;
  requirements: PresentationRequirements;
  status: "idle" | "loading" | "ready" | "error";
  error: string;
  saving: boolean;
  dirty: boolean;
  hasSavedDraft: boolean;
  onSelect: <K extends keyof PresentationRequirementsSelections>(
    field: K,
    value: PresentationRequirementsSelections[K],
  ) => void;
  onRetry: () => void;
  onManual: () => void;
  onBack: () => void;
  onSave: () => void;
  onConfirm: () => void;
}

const GROUPS: Array<{ title: keyof Messages["requirements"]["groups"]; fields: Array<SemanticField | SimpleField> }> = [
  { title: "content", fields: ["audience", "purpose", "desired_outcome"] },
  { title: "specifications", fields: ["slide_count", "output_language"] },
  { title: "visual", fields: ["visual_tone"] },
];

function semanticMatches(
  left: PresentationRequirementCandidate | null,
  right: PresentationRequirementCandidate,
) {
  return left?.label === right.label && left.description === right.description;
}

export function PresentationRequirementsPage(props: PresentationRequirementsPageProps) {
  const { t, brief, requirements, status, error, saving, dirty, hasSavedDraft, onSelect, onRetry, onManual, onBack, onSave, onConfirm } = props;
  const [customValues, setCustomValues] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {};
    for (const field of ["audience", "purpose", "desired_outcome", "visual_tone"] as const) {
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

  function setCustomSemantic(field: SemanticField, value: string) {
    setCustomValues((current) => ({ ...current, [field]: value }));
    onSelect(field, value.trim() ? { label: t.requirements.other, description: value.trim() } : null);
  }

  function setCustomSimple(field: SimpleField, value: string) {
    setCustomValues((current) => ({ ...current, [field]: value }));
    if (field === "slide_count") {
      const number = Number(value);
      onSelect(field, Number.isInteger(number) && number > 0 ? number : null);
      return;
    }
    const language = value.trim();
    onSelect(field, language && language.toLowerCase() !== "auto" ? language : null);
  }

  if (status === "loading") {
    return (
      <section className="page active requirements-page requirements-loading" aria-live="polite">
        <div className="requirements-breathing-mark"><Sparkles size={26} /></div>
        <h1>{t.requirements.loadingTitle}</h1>
        <p>{t.requirements.loadingBody}</p>
        <div className="requirements-loading-lines" aria-hidden="true"><span /><span /><span /></div>
        <button className="secondary-btn" type="button" onClick={onBack}>
          <ArrowLeft size={16} />{t.requirements.back}
        </button>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="page active requirements-page requirements-error" role="alert">
        <h1>{t.requirements.errorTitle}</h1>
        <p>{error || t.requirements.errorBody}</p>
        <div className="requirements-error-actions">
          <button className="primary-btn" type="button" onClick={onRetry}><RefreshCw size={16} />{t.requirements.retry}</button>
          <button className="secondary-btn" type="button" onClick={onManual}>{t.requirements.manual}</button>
          <button className="text-btn" type="button" onClick={onBack}>{t.requirements.back}</button>
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
              const customSelected = isSemantic
                ? Boolean(selection && !candidates.some((candidate) => semanticMatches(selection as PresentationRequirementCandidate, candidate as PresentationRequirementCandidate)))
                : Boolean(selection !== null && !candidates.includes(selection as never));
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
                          type="button"
                          className={`requirement-option ${selected ? "selected" : ""}`}
                          onClick={() => onSelect(field as never, candidate as never)}
                          key={`${label}-${index}`}
                        >
                          <span className="requirement-radio">{selected ? <Check size={13} strokeWidth={3} /> : null}</span>
                          <span><strong>{label}</strong>{description ? <small>{description}</small> : null}</span>
                          {index === 0 ? <em>{t.requirements.recommended}</em> : null}
                        </button>
                      );
                    })}
                    <label className={`requirement-option requirement-custom ${customSelected ? "selected" : ""}`}>
                      <span className="requirement-radio">{customSelected ? <Check size={13} strokeWidth={3} /> : null}</span>
                      <span><strong>{t.requirements.other}</strong>
                        <input
                          type={field === "slide_count" ? "number" : "text"}
                          min={field === "slide_count" ? 1 : undefined}
                          value={customValue}
                          placeholder={t.requirements.customPlaceholders[field]}
                          onChange={(event) => isSemantic
                            ? setCustomSemantic(field as SemanticField, event.target.value)
                            : setCustomSimple(field as SimpleField, event.target.value)}
                        />
                      </span>
                    </label>
                  </div>
                </fieldset>
              );
            })}
          </section>
        ))}
      </div>

      <footer className="requirements-footer">
        <button className="secondary-btn" type="button" onClick={onBack}><ArrowLeft size={16} />{t.requirements.back}</button>
        <span>{saving ? t.requirements.saving : dirty ? t.requirements.unsaved : hasSavedDraft ? t.requirements.saved : ""}</span>
        <div className="requirements-footer-actions">
          <button className="secondary-btn" type="button" disabled={saving || !dirty} onClick={onSave}>
            <Save size={16} />{t.controls.save}
          </button>
          <button className="primary-btn" type="button" disabled={saving || !Object.values(requirements.selections).every(Boolean) || requirements.selections.output_language?.trim().toLowerCase() === "auto"} onClick={onConfirm}>
            <Check size={16} />{t.requirements.confirm}
          </button>
        </div>
      </footer>
    </section>
  );
}
