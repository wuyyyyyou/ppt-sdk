export interface FileSnapshot {
  path: string;
  exists: boolean;
  kind: "json" | "jsonl" | "markdown" | "text";
  content: unknown;
  error?: string;
}

export interface ProjectSnapshot {
  projectDir: string;
  taskStateFiles: Record<string, FileSnapshot>;
  promoteFiles: FileSnapshot[];
}

export interface RpcEnvelope {
  jsonrpc?: "2.0";
  id?: number | string | null;
  result?: {
    success: true;
    data: unknown;
    tool: string;
  };
  error?: {
    code: number;
    message: string;
  };
  __file_transport?: string;
}

export interface InvokeResponse {
  rpcRequest: unknown;
  rpcResponse: RpcEnvelope;
  snapshot: ProjectSnapshot | null;
}

export type FileTreeNode = {
  id: string;
  name: string;
  path: string;
  kind: "directory" | "file";
  file?: FileSnapshot;
  children?: FileTreeNode[];
};

export type ToolDefaults = Record<string, unknown>;
