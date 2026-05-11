# `.vscode/engine/stdin`

这里放 VS Code 调试用的 `stdin.json` 样例。

这些文件默认不纳入 git 追踪，适合本地反复改参数、反复跑测试。

## 通用格式

大多数文件都是 JSON-RPC 请求：

```json
{
  "jsonrpc": "2.0",
  "method": "invoke",
  "id": 1,
  "params": {
    "tool": "toolName",
    "arguments": {}
  }
}
```

少数工具是直接调用：

```json
{ "jsonrpc": "2.0", "method": "describe", "id": 1 }
```

## 各文件示例

- `describe-stdin.json`：`describe`，用于查看插件暴露的工具列表。
- `health-stdin.json`：`health`，用于检查插件是否可用。
- `list-summary-stdin.json`：`invoke -> listDiscoveredTemplateGroupSummaries`，列出模板组摘要。
- `all-groups-stdin.json`：`invoke -> getAllDiscoveredTemplateGroups`，列出所有模板组。
- `get-group-stdin.json`：`invoke -> getDiscoveredTemplateGroup`，读取单个模板组详情。
- `deck-html-stdin.json`：`invoke -> buildDeckHtmlFromManifest`，生成 deck HTML。
- `convert-stdin.json`：`invoke -> convertDeckHtmlToPptxModel`，把 HTML 转成中间模型。
- `validate-stdin.json`：`invoke -> validateDeckFromManifest`，校验 deck / manifest。
- `fork-stdin.json`：`invoke -> forkTemplateGroup`，从模板组 fork 出工作副本。

## 常见可改字段

- `cwd`：一般指向 `.vscode/engine/output`
- `manifest_path`：模板或项目的 `manifest.json`
- `output_dir` / `out_dir`：输出目录
- `group_id` / `template_group`：模板组标识
- `page` / `single_page`：单页或整页测试
- `${workspaceFolder}`：会在运行时展开为当前仓库根目录
