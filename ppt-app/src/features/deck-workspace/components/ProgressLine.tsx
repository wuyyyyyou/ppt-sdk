import type { Messages } from "../../../i18n/messages";
import type { MainStage } from "../types";
import { stageOrder } from "../utils";

interface ProgressLineProps {
  stage: MainStage;
  t: Messages;
  requirementsEnabled: boolean;
  outlineEnabled: boolean;
  generatingEnabled: boolean;
  deckEnabled: boolean;
  onNavigate: (stage: MainStage) => void;
}

export type ProgressStage = Exclude<MainStage, "uploaded-source-analysis">;

export const progressStages: readonly ProgressStage[] = [
  "brief",
  "requirements",
  "outline",
  "generating",
  "deck",
];

export type ProgressStageAvailability = Record<ProgressStage, boolean>;

export function adjacentEnabledStage(
  stage: MainStage,
  enabledStages: ProgressStageAvailability,
  direction: -1 | 1,
): ProgressStage | null {
  const currentIndex = progressStages.indexOf(stage as ProgressStage);
  if (currentIndex < 0) return null;

  for (
    let index = currentIndex + direction;
    index >= 0 && index < progressStages.length;
    index += direction
  ) {
    const candidate = progressStages[index];
    if (enabledStages[candidate]) return candidate;
  }
  return null;
}

export function ProgressLine({
  stage,
  t,
  requirementsEnabled,
  outlineEnabled,
  generatingEnabled,
  deckEnabled,
  onNavigate,
}: ProgressLineProps) {
  const currentIndex = Math.max(0, progressStages.indexOf(stage as ProgressStage));
  const progress = `${(currentIndex / (progressStages.length - 1)) * 100}%`;
  const enabledStages: ProgressStageAvailability = {
    brief: true,
    requirements: requirementsEnabled,
    outline: outlineEnabled,
    generating: generatingEnabled,
    deck: deckEnabled,
  };

  return (
    <nav className="progress-line-container" aria-label={t.appName}>
      <div className="progress-line-rail" aria-hidden="true">
        <div className="progress-line-track" />
        <div className="progress-line-fill" style={{ width: progress }} />
      </div>
      {progressStages.map((item) => {
        const disabled = !enabledStages[item];
        const label = t.progressStages[item];
        return (
          <button
            data-performance-id={`navigation.stage.${item}`}
            key={item}
            className={`progress-node ${
              item === stage ? "active" : stageOrder(item) < stageOrder(stage) ? "completed" : ""
            }`}
            title={label}
            aria-current={item === stage ? "step" : undefined}
            disabled={disabled}
            onClick={() => onNavigate(item)}
          >
            <span className="progress-node-dot" aria-hidden="true" />
            <span className="progress-node-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
