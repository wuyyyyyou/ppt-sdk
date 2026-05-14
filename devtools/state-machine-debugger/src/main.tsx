import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Editor } from "@monaco-editor/react";
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  FileJson2,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  TerminalSquare,
} from "lucide-react";

import { getRpcData, invokeTool } from "./api";
import {
  buildDefaultArgs,
  buildFileTree,
  DECK_STATES,
  findFileNode,
  getFileLanguage,
  getStateSummary,
  PAGE_STATES,
  stringifyFile,
  TOOL_NAMES,
} from "./state-machine";
import type { FileTreeNode, InvokeResponse, ProjectSnapshot, RpcEnvelope } from "./types";
import "./styles.css";

type RpcTab = "response" | "request" | "diff" | "events";

const STORAGE_PROJECT_DIR = "stateMachineDebugger.projectDir";

function App() {
  const [projectDir, setProjectDir] = useState(() => localStorage.getItem(STORAGE_PROJECT_DIR) ?? "");
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [previousSnapshot, setPreviousSnapshot] = useState<ProjectSnapshot | null>(null);
  const [queryResponse, setQueryResponse] = useState<RpcEnvelope | null>(null);
  const [lastInvoke, setLastInvoke] = useState<InvokeResponse | null>(null);
  const [selectedTool, setSelectedTool] = useState<string>("query_task_state");
  const [argsText, setArgsText] = useState<string>("");
  const [selectedFilePath, setSelectedFilePath] = useState<string>("task-state/state.json");
  const [rpcTab, setRpcTab] = useState<RpcTab>("response");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryData = getRpcData<any>(queryResponse);
  const summary = useMemo(() => getStateSummary(snapshot, queryData), [snapshot, queryData]);
  const fileTree = useMemo(() => buildFileTree(snapshot), [snapshot]);
  const selectedFile = useMemo(() => findFileNode(fileTree, selectedFilePath)?.file ?? null, [fileTree, selectedFilePath]);

  useEffect(() => {
    setArgsText(JSON.stringify(buildDefaultArgs(selectedTool, projectDir, snapshot, queryData), null, 2));
  }, [selectedTool, projectDir, snapshot, queryData]);

  useEffect(() => {
    if (!projectDir) {
      return;
    }
    void runQuery(projectDir, false);
  }, []);

  async function runQuery(targetProjectDir = projectDir, keepPrevious = true) {
    if (!targetProjectDir.trim()) {
      setError("Enter an absolute project_dir first.");
      return;
    }
    await runAsync(async () => {
      localStorage.setItem(STORAGE_PROJECT_DIR, targetProjectDir);
      if (keepPrevious) {
        setPreviousSnapshot(snapshot);
      }
      const response = await invokeTool("query_task_state", {
        project_dir: targetProjectDir,
        response_mode: "compact",
      });
      setProjectDir(targetProjectDir);
      setSnapshot(response.snapshot);
      setQueryResponse(response.rpcResponse);
      setLastInvoke(response);
      setRpcTab("response");
    });
  }

  async function runSelectedTool() {
    await runAsync(async () => {
      const args = JSON.parse(argsText) as Record<string, unknown>;
      setPreviousSnapshot(snapshot);
      const response = await invokeTool(selectedTool, args);
      setLastInvoke(response);
      if (response.snapshot) {
        setSnapshot(response.snapshot);
      }
      if (response.rpcResponse?.result?.tool === "query_task_state") {
        setQueryResponse(response.rpcResponse);
      } else if (typeof args.project_dir === "string" && args.project_dir) {
        const refreshed = await invokeTool("query_task_state", {
          project_dir: args.project_dir,
          response_mode: "compact",
        });
        if (refreshed.snapshot) {
          setSnapshot(refreshed.snapshot);
        }
        setQueryResponse(refreshed.rpcResponse);
      }
      setRpcTab("response");
    });
  }

  async function runAsync(fn: () => Promise<void>) {
    setError(null);
    setIsLoading(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <TerminalSquare size={22} />
          <div>
            <h1>Task State Machine Debugger</h1>
            <span>Local workbench for PPT task-state projects</span>
          </div>
        </div>
        <form
          className="project-form"
          onSubmit={(event) => {
            event.preventDefault();
            void runQuery(projectDir);
          }}
        >
          <Search size={16} />
          <input
            value={projectDir}
            onChange={(event) => setProjectDir(event.target.value)}
            placeholder="/absolute/path/to/task-project"
          />
          <button type="submit" disabled={isLoading}>
            <RefreshCw size={15} className={isLoading ? "spin" : ""} />
            Query
          </button>
        </form>
      </header>

      {error ? (
        <div className="error-banner">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : null}

      <main className="workspace">
        <section className="sidebar panel">
          <PanelHeader title="Explorer" icon={<FolderOpen size={16} />} />
          <FileTree
            nodes={fileTree}
            selectedPath={selectedFilePath}
            onSelect={setSelectedFilePath}
          />
        </section>

        <section className="center">
          <StateOverview summary={summary} />
          <section className="panel file-viewer">
            <PanelHeader
              title={selectedFilePath || "File Viewer"}
              icon={<FileText size={16} />}
              right={selectedFile?.exists ? <span className="pill">{selectedFile.kind}</span> : <span className="pill muted">missing</span>}
            />
            <Editor
              height="100%"
              language={getFileLanguage(selectedFile)}
              value={stringifyFile(selectedFile)}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 12,
                wordWrap: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </section>
        </section>

        <section className="right-rail">
          <ToolPanel
            selectedTool={selectedTool}
            argsText={argsText}
            onToolChange={setSelectedTool}
            onArgsChange={setArgsText}
            onReset={() => setArgsText(JSON.stringify(buildDefaultArgs(selectedTool, projectDir, snapshot, queryData), null, 2))}
            onInvoke={() => void runSelectedTool()}
            isLoading={isLoading}
          />
          <RpcPanel
            tab={rpcTab}
            onTabChange={setRpcTab}
            lastInvoke={lastInvoke}
            snapshot={snapshot}
            previousSnapshot={previousSnapshot}
          />
        </section>
      </main>
    </div>
  );
}

function PanelHeader({ title, icon, right }: { title: string; icon?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="panel-header">
      <div className="panel-title">
        {icon}
        <h2>{title}</h2>
      </div>
      {right}
    </div>
  );
}

function StateOverview({ summary }: { summary: ReturnType<typeof getStateSummary> }) {
  return (
    <section className="panel state-overview">
      <PanelHeader title="State" icon={<GitBranch size={16} />} />
      <div className="state-grid">
        <Metric label="Deck" value={summary.deckState ?? "-"} />
        <Metric label="Page" value={summary.pageState ?? "-"} />
        <Metric label="Current Page" value={summary.currentPageId ?? "-"} />
        <Metric label="Locked" value={summary.allPagesLocked === undefined ? "-" : String(summary.allPagesLocked)} />
      </div>
      <Flow title="Deck Flow" states={[...DECK_STATES]} active={summary.deckState} allowed={summary.allowedTransitions} />
      <Flow title="Page Flow" states={[...PAGE_STATES]} active={summary.pageState} allowed={summary.allowedTransitions} />
      <div className="chips">
        {(summary.blockedBy.length ? summary.blockedBy : ["no blockers"]).map((item) => (
          <span className={`chip ${summary.blockedBy.length ? "blocked" : "ok"}`} key={item}>
            {summary.blockedBy.length ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Flow({ title, states, active, allowed }: { title: string; states: string[]; active?: string; allowed: string[] }) {
  const allowedSet = new Set(allowed);
  return (
    <div className="flow-block">
      <h3>{title}</h3>
      <div className="flow">
        {states.map((state) => (
          <span
            key={state}
            className={`flow-node ${state === active ? "active" : ""} ${allowedSet.has(state) ? "allowed" : ""}`}
          >
            {state === active ? <Circle size={9} fill="currentColor" /> : null}
            {state}
          </span>
        ))}
      </div>
    </div>
  );
}

function FileTree({ nodes, selectedPath, onSelect }: { nodes: FileTreeNode[]; selectedPath: string; onSelect: (path: string) => void }) {
  if (!nodes.length) {
    return <div className="empty">Query a project to load files.</div>;
  }
  return (
    <div className="file-tree">
      {nodes.map((node) => (
        <TreeNode node={node} key={node.id} selectedPath={selectedPath} onSelect={onSelect} depth={0} />
      ))}
    </div>
  );
}

function TreeNode({ node, selectedPath, onSelect, depth }: { node: FileTreeNode; selectedPath: string; onSelect: (path: string) => void; depth: number }) {
  const [open, setOpen] = useState(true);
  const isSelected = node.path === selectedPath;
  const isDir = node.kind === "directory";
  return (
    <div>
      <button
        className={`tree-row ${isSelected ? "selected" : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        type="button"
        onClick={() => {
          if (isDir) {
            setOpen((value) => !value);
          } else {
            onSelect(node.path);
          }
        }}
      >
        {isDir ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="tree-spacer" />}
        {isDir ? (open ? <FolderOpen size={15} /> : <Folder size={15} />) : node.name.endsWith(".json") || node.name.endsWith(".jsonl") ? <FileJson2 size={15} /> : <FileText size={15} />}
        <span>{node.name}</span>
      </button>
      {isDir && open ? node.children?.map((child) => (
        <TreeNode node={child} key={child.id} selectedPath={selectedPath} onSelect={onSelect} depth={depth + 1} />
      )) : null}
    </div>
  );
}

function ToolPanel(props: {
  selectedTool: string;
  argsText: string;
  onToolChange: (tool: string) => void;
  onArgsChange: (value: string) => void;
  onReset: () => void;
  onInvoke: () => void;
  isLoading: boolean;
}) {
  return (
    <section className="panel tool-panel">
      <PanelHeader title="Tool Runner" icon={<Braces size={16} />} />
      <div className="tool-controls">
        <label>
          Tool
          <select value={props.selectedTool} onChange={(event) => props.onToolChange(event.target.value)}>
            {TOOL_NAMES.map((tool) => <option value={tool} key={tool}>{tool}</option>)}
          </select>
        </label>
        <div className="tool-actions">
          <button type="button" onClick={props.onInvoke} disabled={props.isLoading}>
            <Play size={14} />
            Invoke
          </button>
          <button className="secondary" type="button" onClick={props.onReset}>
            <RotateCcw size={14} />
            Defaults
          </button>
        </div>
      </div>
      <div className="args-editor">
        <Editor
          height="100%"
          language="json"
          value={props.argsText}
          theme="vs-dark"
          onChange={(value) => props.onArgsChange(value ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            tabSize: 2,
            wordWrap: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
    </section>
  );
}

function RpcPanel({ tab, onTabChange, lastInvoke, snapshot, previousSnapshot }: {
  tab: RpcTab;
  onTabChange: (tab: RpcTab) => void;
  lastInvoke: InvokeResponse | null;
  snapshot: ProjectSnapshot | null;
  previousSnapshot: ProjectSnapshot | null;
}) {
  const content = getRpcContent(tab, lastInvoke, snapshot, previousSnapshot);
  return (
    <section className="panel rpc-panel">
      <div className="tabs">
        {(["response", "request", "diff", "events"] as RpcTab[]).map((item) => (
          <button
            type="button"
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => onTabChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <Editor
        height="100%"
        language={tab === "diff" ? "plaintext" : "json"}
        value={content}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 12,
          wordWrap: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </section>
  );
}

function getRpcContent(tab: RpcTab, lastInvoke: InvokeResponse | null, snapshot: ProjectSnapshot | null, previousSnapshot: ProjectSnapshot | null): string {
  if (tab === "request") {
    return lastInvoke ? JSON.stringify(lastInvoke.rpcRequest, null, 2) : "No request yet.";
  }
  if (tab === "response") {
    return lastInvoke ? JSON.stringify(lastInvoke.rpcResponse, null, 2) : "No response yet.";
  }
  if (tab === "events") {
    const events = snapshot?.taskStateFiles["events.jsonl"]?.content;
    return events ? JSON.stringify(events, null, 2) : "No events loaded.";
  }
  return buildDiff(previousSnapshot, snapshot);
}

function buildDiff(before: ProjectSnapshot | null, after: ProjectSnapshot | null): string {
  if (!before || !after) {
    return "No before/after snapshot yet.";
  }
  const beforeFiles = flattenSnapshot(before);
  const afterFiles = flattenSnapshot(after);
  const keys = [...new Set([...Object.keys(beforeFiles), ...Object.keys(afterFiles)])].sort();
  const lines: string[] = [];
  for (const key of keys) {
    const beforeValue = stableStringify(beforeFiles[key]);
    const afterValue = stableStringify(afterFiles[key]);
    if (beforeValue === afterValue) continue;
    if (beforeValue === undefined) lines.push(`+ ${key}`);
    else if (afterValue === undefined) lines.push(`- ${key}`);
    else lines.push(`~ ${key}`);
  }
  return lines.length ? lines.join("\n") : "No file-level state changes detected.";
}

function flattenSnapshot(snapshot: ProjectSnapshot): Record<string, unknown> {
  const files: Record<string, unknown> = {};
  for (const [name, file] of Object.entries(snapshot.taskStateFiles)) {
    files[`task-state/${name}`] = file.exists ? file.content : null;
  }
  for (const file of snapshot.promoteFiles) {
    files[file.path] = file.exists ? file.content : null;
  }
  return files;
}

function stableStringify(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return JSON.stringify(sortValue(value), null, 2);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortValue(nested)]),
    );
  }
  return value;
}

createRoot(document.querySelector("#root")!).render(<App />);
