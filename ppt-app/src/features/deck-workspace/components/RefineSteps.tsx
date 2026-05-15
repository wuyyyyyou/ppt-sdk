import { CheckCircle2 } from "lucide-react";

interface RefineStepsProps {
  steps: string[];
}

export function RefineSteps({ steps }: RefineStepsProps) {
  return (
    <div className="refine-progress-list">
      {steps.map((step, index) => (
        <div key={step} className={`refine-progress-item ${index === 0 ? "active" : ""}`}>
          {index === 0 ? <span className="spinner tiny" /> : <CheckCircle2 size={14} />}
          {step}
        </div>
      ))}
    </div>
  );
}
