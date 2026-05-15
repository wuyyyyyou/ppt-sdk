import { useMemo } from "react";
import { FileText, LayoutDashboard, PlayCircle } from "lucide-react";
import { WORKFLOW_STAGES } from "./routes";
import { detectRuntimeMode } from "../runtime/runtimeMode";

export function App() {
  const runtimeMode = useMemo(() => detectRuntimeMode(), []);

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Workflow stages">
        <div className="brand">
          <FileText size={22} aria-hidden="true" />
          <div>
            <h1>PPT App</h1>
            <span>{runtimeMode}</span>
          </div>
        </div>

        <nav className="stage-nav">
          {WORKFLOW_STAGES.map((stage, index) => (
            <a key={stage.id} href={`#${stage.id}`}>
              <span>{index + 1}</span>
              {stage.label}
            </a>
          ))}
        </nav>
      </aside>

      <section className="workspace" aria-label="Current workflow step">
        <header className="workspace-header">
          <div>
            <p>Workspace</p>
            <h2>Review-first PPT workflow</h2>
          </div>
          <button type="button">
            <PlayCircle size={18} aria-hidden="true" />
            New task
          </button>
        </header>

        <section className="panel">
          <div className="panel-heading">
            <LayoutDashboard size={20} aria-hidden="true" />
            <h3>Project foundation</h3>
          </div>
          <p>
            This screen is a structural placeholder. Feature pages will attach
            to the shared backend adapter as the engine app-facing tools are
            implemented.
          </p>
        </section>
      </section>

      <aside className="inspector" aria-label="Task state">
        <h2>State</h2>
        <dl>
          <div>
            <dt>Backend</dt>
            <dd>PptBackend</dd>
          </div>
          <div>
            <dt>Engine</dt>
            <dd>app_* tools</dd>
          </div>
          <div>
            <dt>Export gate</dt>
            <dd>HTML review</dd>
          </div>
        </dl>
      </aside>
    </main>
  );
}
