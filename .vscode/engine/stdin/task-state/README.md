# Task State 子工具说明

这里记录 `ppt-engine` 里状态机相关子工具的用途，方便编写 `.vscode/engine/stdin/task-state/*.json` 测试输入。

这些子工具都通过 JSON-RPC 的 `invoke` 调用：

```json
{
  "jsonrpc": "2.0",
  "method": "invoke",
  "id": 1,
  "params": {
    "tool": "create_task_project",
    "arguments": {}
  }
}
```

## 项目入口

- `create_task_project`：创建一个新的 PPT 任务项目，并初始化 `task-state/` 状态文件。
- `open_task_project`：打开已有 PPT 任务项目，读取当前 `task-state/` 信息。
- `query_task_state`：查询当前项目状态，并返回建议 PPT AI Agent 下一步做什么。

### `create_task_project`

这个子工具用于创建一个新的任务项目。

支持参数：

- `cwd`：可选，必须是绝对路径。状态机的文件传输结果会优先写到 `cwd/.executa-file-transport/`。
- `project_dir`：必填，项目目录，建议写绝对路径。
- `title`：可选，任务或项目标题。
- `initial_request`：可选，初始需求描述；当前样例会传入，但实现里主要还是以 `project_dir` 和 `title` 初始化项目。

当前测试样例：

```json
{
  "jsonrpc": "2.0",
  "method": "invoke",
  "id": 1,
  "params": {
    "tool": "create_task_project",
    "arguments": {
      "cwd": "${workspaceFolder}/.vscode/engine/output",
      "project_dir": "${workspaceFolder}/.vscode/engine/output/task-state/create-task-demo",
      "title": "Task State Demo Deck",
      "initial_request": "Create a concise demo deck for testing the PPT task state machine."
    }
  }
}
```

运行后，这个样例会在 `project_dir` 下创建新的任务项目，并把状态机返回结果对应的文件传输内容写到 `cwd` 下。

### `open_task_project`

这个子工具用于打开一个已经存在的任务项目，并读取当前 `task-state/` 信息。

支持参数：

- `cwd`：可选，必须是绝对路径。状态机的文件传输结果会优先写到 `cwd/.executa-file-transport/`。
- `project_dir`：必填，已有任务项目目录，必须是绝对路径。

当前测试样例：

```json
{
  "jsonrpc": "2.0",
  "method": "invoke",
  "id": 1,
  "params": {
    "tool": "open_task_project",
    "arguments": {
      "cwd": "${workspaceFolder}/.vscode/engine/output",
      "project_dir": "${workspaceFolder}/.vscode/engine/output/task-state/create-task-demo"
    }
  }
}
```

运行前需要先跑 `Engine-Task: Create Task`，确保 `project_dir` 目录已经存在并包含 `task-state/`。

### `query_task_state`

这个子工具用于查询当前任务项目的状态，并生成 `promote/current.md` 和当前阶段对应的 `promote/*.md` 行动说明，再返回建议 PPT AI Agent 下一步做什么。

支持参数：

- `cwd`：可选，必须是绝对路径。状态机的文件传输结果会优先写到 `cwd/.executa-file-transport/`。
- `project_dir`：必填，已有任务项目目录，必须是绝对路径。

当前测试样例：

```json
{
  "jsonrpc": "2.0",
  "method": "invoke",
  "id": 1,
  "params": {
    "tool": "query_task_state",
    "arguments": {
      "cwd": "${workspaceFolder}/.vscode/engine/output",
      "project_dir": "${workspaceFolder}/.vscode/engine/output/task-state/create-task-demo"
    }
  }
}
```

运行前需要先跑 `Engine-Task: Create Task`，并且这个项目目录里已经有状态文件可读。

返回结果里，`recommendation` 会包含这些关键字段：

- `promotePath`：当前阶段真正应该先读的 md 文件。
- `promoteKind`：`deck`、`page` 或 `recovery`。
- `promoteVersion`：当前 promote 文档版本。
- `promoteFreshness`：当前文档是否是本次查询生成的。
- `promoteEntryPath`：`promote/current.md` 的入口路径。
- `agentInstruction`：给 PPT AI Agent 的简短执行提示。

## 需求和规划

- `record_requirements`：记录用户需求，例如主题、目标受众、风格、素材要求等。
- `record_template_selection`：记录用户确认的模板组，并进入模板已选择阶段。
- `record_outline`：记录已经确认的大纲和页数安排。
- `record_page_plan`：记录或更新每页的实现计划，用来连接“大纲”到“一页一页实现”。

### `record_requirements`

这个子工具用于把已经和用户确认过的 PPT 需求写入 `task-state/requirements.json`，并把 deck 状态推进到 `requirements_collected`。

支持参数：

- `cwd`：可选，必须是绝对路径。状态机的文件传输结果会优先写到 `cwd/.executa-file-transport/`。
- `project_dir`：必填，已有任务项目目录，必须是绝对路径。
- `mode`：可选，支持 `"merge"` 或 `"replace_all"`，默认是 `"merge"`。
- `requirements`：必填，结构化需求对象。
- `requirements.topic`：必填，PPT 主题。
- `requirements.audience`：必填，目标受众。
- `requirements.scenario`：必填，使用场景。
- `requirements.pageCount`：必填，页数，必须是数字。
- `requirements.tone`：可选，语气或视觉风格。
- `requirements.language`：可选，输出语言。
- `requirements.mustCover`：可选，必须覆盖的信息数组；没有必须覆盖的信息时可以传空数组。
- `source`：可选，需求来源；用户确认的需求建议写 `"user"`。

写入行为：

- `mode: "merge"`：默认行为。如果已有 `requirements.json`，只覆盖本次 `requirements` 里传入的字段，未传入字段保留原样；如果没有已有文件，则创建新文件。
- `mode: "replace_all"`：整份替换 `requirements.json` 里的 `requirements` 内容。只有用户明确要求重写全部需求时才建议使用。
- 无论使用哪种模式，写入后的结果都必须包含 `topic`、`audience`、`scenario` 和有效的 `pageCount`。

当前测试样例：

```json
{
  "jsonrpc": "2.0",
  "method": "invoke",
  "id": 1,
  "params": {
    "tool": "record_requirements",
    "arguments": {
      "cwd": "${workspaceFolder}/.vscode/engine/output",
      "project_dir": "${workspaceFolder}/.vscode/engine/output/task-state/create-task-demo",
      "mode": "merge",
      "requirements": {
        "topic": "AI Agent 介绍",
        "audience": "学生",
        "scenario": "上课",
        "pageCount": 5,
        "tone": "专业、精致",
        "language": "中文",
        "mustCover": []
      },
      "source": "user"
    }
  }
}
```

运行前需要先跑 `Engine-Task: Create Task`，确保 `project_dir` 目录已经存在并包含 `task-state/`。

### `record_template_selection`

这个子工具用于把用户最终确认的模板组写入状态机，并把 deck 状态推进到 `template_selected`。

支持参数：

- `cwd`：可选，必须是绝对路径。状态机的文件传输结果会优先写到 `cwd/.executa-file-transport/`。
- `project_dir`：必填，已有任务项目目录，必须是绝对路径。
- `template_group`：必填，用户确认的模板组 id。
- `selection_reason`：可选，选择理由或确认说明。
- `source`：可选，来源，通常写 `"user"`。

当前测试样例：

```json
{
  "jsonrpc": "2.0",
  "method": "invoke",
  "id": 1,
  "params": {
    "tool": "record_template_selection",
    "arguments": {
      "cwd": "${workspaceFolder}/.vscode/engine/output",
      "project_dir": "${workspaceFolder}/.vscode/engine/output/task-state/create-task-demo",
      "template_group": "general",
      "selection_reason": "用户确认使用通用模板组。",
      "source": "user"
    }
  }
}
```

运行前需要先跑 `Engine-Task: Record Requirements` 后再选择模板组，确保当前状态已进入 `requirements_collected`。

## 单页实现流程

- `start_page_iteration`：选择某一页，进入这一页的设计和实现流程。
- `record_page_progress`：记录这一页的阶段进度，例如已实现、已截图、已审查、需要修改、已锁定。

## 状态推进和回退

- `advance_task_state`：推进整个 deck 或当前页面的状态，并创建检查点。
- `rewind_task_state`：回退到某个检查点，或回退到指定的安全状态。
- `branch_task_project`：基于当前状态或某个检查点创建分支，用于尝试另一版方案。

## 检查点和恢复

- `list_task_checkpoints`：列出项目已有的检查点，也可以一起列出分支。
- `recover_task_project`：尝试修复缺失或损坏的 `task-state/` 文件。
- `validate_task_project`：只校验当前 `task-state/` 是否完整和一致，不修改文件。
