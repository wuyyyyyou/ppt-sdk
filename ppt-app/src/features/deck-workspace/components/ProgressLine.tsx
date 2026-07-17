import type { Messages } from "../../../i18n/messages";
import type { MainStage } from "../types";
import { stageLabel, stageOrder } from "../utils";

interface ProgressLineProps {
  stage: MainStage;
  t: Messages;
  outlineEnabled: boolean;
  onNavigate: (stage: MainStage) => void;
}

export function ProgressLine({ stage, t, outlineEnabled, onNavigate }: ProgressLineProps) {
  const stages = ["brief", "requirements", "uploaded-source-analysis", "outline", "generating", "deck"] as MainStage[];
  const currentIndex = Math.max(0, stages.indexOf(stage));
  const progress = `${(currentIndex / (stages.length - 1)) * 100}%`;

  return (
    <div className="progress-line-container">
      <div className="progress-line-track" />
      <div className="progress-line-fill" style={{ width: progress }} />
      {stages.map((item) => {
        const disabled = item === "outline" && !outlineEnabled;
        return (
          <button
            key={item}
            className={`progress-node ${
              item === stage ? "active" : stageOrder(item) < stageOrder(stage) ? "completed" : ""
            }`}
            title={disabled ? t.toasts.confirmRequirementsFirst : stageLabel(t, item)}
            disabled={disabled}
            onClick={() => onNavigate(item)}
          />
        );
      })}
    </div>
  );
}
