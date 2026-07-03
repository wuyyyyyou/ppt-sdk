import { Check } from "lucide-react";
import type { Messages } from "../../../i18n/messages";
import type { ResearchSearchControlSettings } from "../researchSearchControl";

interface ResearchSearchControlSwitchesProps {
  t: Messages;
  settings: ResearchSearchControlSettings;
  disabled?: boolean;
  onChange: (settings: ResearchSearchControlSettings) => void;
}

export function ResearchSearchControlSwitches(props: ResearchSearchControlSwitchesProps) {
  const { t, settings, disabled = false, onChange } = props;

  return (
    <div className="research-search-control-options">
      <button
        type="button"
        className={`checkbox-row ${settings.disableWebResearch ? "active" : ""}`}
        onClick={() => onChange({
          ...settings,
          disableWebResearch: !settings.disableWebResearch,
        })}
        aria-checked={settings.disableWebResearch}
        role="switch"
        disabled={disabled}
      >
        <span className="checkbox-custom">
          {settings.disableWebResearch ? <Check size={11} strokeWidth={3} /> : null}
        </span>
        <span>{t.controls.disableWebResearch}</span>
      </button>
      <button
        type="button"
        className={`checkbox-row ${settings.disableImageResearch ? "active" : ""}`}
        onClick={() => onChange({
          ...settings,
          disableImageResearch: !settings.disableImageResearch,
        })}
        aria-checked={settings.disableImageResearch}
        role="switch"
        disabled={disabled}
      >
        <span className="checkbox-custom">
          {settings.disableImageResearch ? <Check size={11} strokeWidth={3} /> : null}
        </span>
        <span>{t.controls.disableImageResearch}</span>
      </button>
    </div>
  );
}
