import { ArrowLeft } from "lucide-react";
import type { Messages } from "../../../i18n/messages";

interface PageHeaderProps {
  title: string;
  onBack: () => void;
  t: Messages;
}

export function PageHeader({ title, onBack, t }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={14} />
          {t.controls.back}
        </button>
        <div className="page-title">{title}</div>
      </div>
    </div>
  );
}
