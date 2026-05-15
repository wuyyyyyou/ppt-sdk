import type { Messages } from "../../../i18n/messages";
import type { MainStage } from "../types";
import { stageOrder } from "../utils";

interface ProgressLineProps {
  stage: MainStage;
  t: Messages;
  onNavigate: (stage: MainStage) => void;
}

export function ProgressLine({ stage, t, onNavigate }: ProgressLineProps) {
  const progress = stage === "brief" ? "33%" : stage === "outline" ? "66%" : "100%";

  return (
    <div className="progress-line-container">
      <div className="progress-line-track" />
      <div className="progress-line-fill" style={{ width: progress }} />
      {(["brief", "outline", "deck"] as MainStage[]).map((item) => (
        <button
          key={item}
          className={`progress-node ${
            item === stage ? "active" : stageOrder(item) < stageOrder(stage) ? "completed" : ""
          }`}
          title={t.stages[item]}
          onClick={() => onNavigate(item)}
        />
      ))}
    </div>
  );
}
