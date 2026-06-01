# Executa 二进制直接调用命令

这份文档对应当前仓库里的 Executa 插件调试入口，直接在 fish 里构造 JSON-RPC 请求并调用打包后的二进制。

## 前提

以下命令默认都在仓库根目录执行

先确保二进制已经打好：

```fish
./presenton-template-engine/build_binary.sh --test
./presenton-pptx-generator/build_binary.sh --test
```

当前脚本定义的二进制路径是：

- `./presenton-template-engine/bundle/ppt-engine`
- `./presenton-pptx-generator/bundle/ppt-gener/ppt-gener`

如果你本地 `presenton-pptx-generator/bundle/` 里还是旧的 `presenton-pptx-generator-plugin/` 目录，说明那是历史产物；先重新执行一次当前的 `./presenton-pptx-generator/build_binary.sh`，再按这份文档里的 `ppt-gener` 路径调用。

## 约定

- 所有请求都走 JSON-RPC 2.0 over stdio。
- 这里统一用 `jq -nc` 构造请求 JSON。
- 最后一个 `| jq` 只是为了把响应格式化输出，方便看结果。
- 插件日志会走 `stderr`，不会影响 `stdout` 里的 JSON-RPC 响应。

## Engine

### Engine: Describe

```fish
jq -nc '{jsonrpc:"2.0",method:"describe",id:1}' \
| ./presenton-template-engine/bundle/ppt-engine \
| jq
```

### Engine: Health

```fish
jq -nc '{jsonrpc:"2.0",method:"health",id:1}' \
| ./presenton-template-engine/bundle/ppt-engine \
| jq
```

### Engine: List Summary

```fish
jq -nc \
  --arg cwd $PWD/.vscode/engine/output \
  '{
    jsonrpc: "2.0",
    method: "invoke",
    id: 1,
    params: {
      tool: "listDiscoveredTemplateGroupSummaries",
      arguments: {
        cwd: $cwd,
        include_builtin: true,
        local_roots: [$cwd]
      }
    }
  }' \
| ./presenton-template-engine/bundle/ppt-engine \
| jq
```

### Engine: All Groups

```fish
jq -nc \
  --arg cwd $PWD/.vscode/engine/output \
  '{
    jsonrpc: "2.0",
    method: "invoke",
    id: 1,
    params: {
      tool: "getAllDiscoveredTemplateGroups",
      arguments: {
        cwd: $cwd,
        include_builtin: true,
        local_roots: [$cwd]
      }
    }
  }' \
| ./presenton-template-engine/bundle/ppt-engine \
| jq
```

### Engine: Get Group

```fish
jq -nc \
  --arg cwd $PWD/.vscode/engine/output \
  '{
    jsonrpc: "2.0",
    method: "invoke",
    id: 1,
    params: {
      tool: "getDiscoveredTemplateGroup",
      arguments: {
        cwd: $cwd,
        include_builtin: true,
        group_id: "red-finance-fork",
        local_roots: [$cwd]
      }
    }
  }' \
| ./presenton-template-engine/bundle/ppt-engine \
| jq
```

### Engine: Deck Html

生成整份 deck html：

```fish
jq -nc \
  --arg cwd $PWD/.vscode/engine/output \
  --arg manifest_path $PWD/.vscode/engine/output/red-finance/manifest.json \
  --arg output_dir $PWD/.vscode/engine/output/html-model \
  '{
    jsonrpc: "2.0",
    method: "invoke",
    id: 1,
    params: {
      tool: "buildDeckHtmlFromManifest",
      arguments: {
        cwd: $cwd,
        manifest_path: $manifest_path,
        output_dir: $output_dir,
        name: "red-finance",
        single_page: false
      }
    }
  }' \
| ./presenton-template-engine/bundle/ppt-engine \
| jq
```

如果你要只生成某一页，可以把 `single_page` 改成 `true`，再传 `page`：

```fish
jq -nc \
  --arg cwd $PWD/.vscode/engine/output \
  --arg manifest_path $PWD/.vscode/engine/output/red-finance/manifest.json \
  --arg output_dir $PWD/.vscode/engine/output/html-model \
  '{
    jsonrpc: "2.0",
    method: "invoke",
    id: 1,
    params: {
      tool: "buildDeckHtmlFromManifest",
      arguments: {
        cwd: $cwd,
        manifest_path: $manifest_path,
        output_dir: $output_dir,
        name: "red-finance",
        single_page: true,
        page: 18
      }
    }
  }' \
| ./presenton-template-engine/bundle/ppt-engine \
| jq
```

### Engine: Convert

```fish
jq -nc \
  --arg cwd $PWD/.vscode/engine/output \
  --arg html_path $PWD/.vscode/engine/output/html-model/red-finance-deck.html \
  --arg output_path $PWD/.vscode/engine/output/model/red-finance-model.json \
  --arg screenshots_dir $PWD/.vscode/engine/output/model/screenshots \
  '{
    jsonrpc: "2.0",
    method: "invoke",
    id: 1,
    params: {
      tool: "convertDeckHtmlToPptxModel",
      arguments: {
        cwd: $cwd,
        html_path: $html_path,
        output_path: $output_path,
        name: "red-finance",
        screenshots_dir: $screenshots_dir
      }
    }
  }' \
| ./presenton-template-engine/bundle/ppt-engine \
| jq
```

### Engine: Validate

带 rendered 校验：

```fish
jq -nc \
  --arg cwd $PWD/.vscode/engine/output \
  --arg manifest_path $PWD/.vscode/engine/output/red-finance/manifest.json \
  --arg output_dir $PWD/.vscode/engine/output/validation \
  '{
    jsonrpc: "2.0",
    method: "invoke",
    id: 1,
    params: {
      tool: "validateDeckFromManifest",
      arguments: {
        cwd: $cwd,
        manifest_path: $manifest_path,
        output_dir: $output_dir,
        name: "red-finance",
        include_rendered_checks: true
      }
    }
  }' \
| ./presenton-template-engine/bundle/ppt-engine \
| jq
```

只跑静态校验：

```fish
jq -nc \
  --arg cwd $PWD/.vscode/engine/output \
  --arg manifest_path $PWD/.vscode/engine/output/red-finance/manifest.json \
  --arg output_dir $PWD/.vscode/engine/output/validation \
  '{
    jsonrpc: "2.0",
    method: "invoke",
    id: 1,
    params: {
      tool: "validateDeckFromManifest",
      arguments: {
        cwd: $cwd,
        manifest_path: $manifest_path,
        output_dir: $output_dir,
        name: "red-finance",
        include_rendered_checks: false
      }
    }
  }' \
| ./presenton-template-engine/bundle/ppt-engine \
| jq
```

只校验某一页，避免长 deck 返回过多诊断：

```fish
jq -nc \
  --arg cwd $PWD/.vscode/engine/output \
  --arg manifest_path $PWD/.vscode/engine/output/red-finance/manifest.json \
  --arg output_dir $PWD/.vscode/engine/output/validation \
  '{
    jsonrpc: "2.0",
    method: "invoke",
    id: 1,
    params: {
      tool: "validateDeckFromManifest",
      arguments: {
        cwd: $cwd,
        manifest_path: $manifest_path,
        output_dir: $output_dir,
        name: "red-finance",
        single_page: true,
        page: 18,
        include_rendered_checks: true
      }
    }
  }' \
| ./presenton-template-engine/bundle/ppt-engine \
| jq
```

说明：

- `single_page=true` 时必须同时传 `page`。
- 单页模式只关注目标页本身，不再返回其他页上的跨页问题。

### Engine: Fork

```fish
jq -nc \
  --arg cwd $PWD/.vscode/engine/output \
  --arg out_dir $PWD/.vscode/engine/output/red-finance \
  '{
    jsonrpc: "2.0",
    method: "invoke",
    id: 1,
    params: {
      tool: "forkTemplateGroup",
      arguments: {
        cwd: $cwd,
        template_group: "red-finance",
        out_dir: $out_dir,
        overwrite: true
      }
    }
  }' \
| ./presenton-template-engine/bundle/ppt-engine \
| jq
```

## Generator

### Generator: Describe

```fish
jq -nc '{jsonrpc:"2.0",method:"describe",id:1}' \
| ./presenton-pptx-generator/bundle/ppt-gener/ppt-gener \
| jq
```

### Generator: Health

```fish
jq -nc '{jsonrpc:"2.0",method:"health",id:1}' \
| ./presenton-pptx-generator/bundle/ppt-gener/ppt-gener \
| jq
```

### Generator: Generate PPTX

```fish
jq -nc \
  --arg cwd $PWD/.vscode/generator/output \
  --arg model_path $PWD/.vscode/engine/output/model/red-finance-model.json \
  --arg output_path $PWD/.vscode/generator/output/red-finance.pptx \
  '{
    jsonrpc: "2.0",
    method: "invoke",
    id: 1,
    params: {
      tool: "generatePptx",
      arguments: {
        cwd: $cwd,
        model_path: $model_path,
        output_path: $output_path
      }
    }
  }' \
| ./presenton-pptx-generator/bundle/ppt-gener/ppt-gener \
| jq
```

## 整条 3 步链路

如果你想在命令行里手动跑完整链路，可以按这个顺序执行：

1. 先执行 `Engine: Deck Html`
2. 再执行 `Engine: Convert`
3. 最后执行 `Generator: Generate PPTX`

## 大响应与 `__file_transport`

有些大响应不会直接把完整 JSON 打到 stdout，而是返回一个文件路径：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "__file_transport": "/absolute/path/to/executa-resp-xxxx.json"
}
```

这种情况下，可以先把响应存下来，再读取真实文件：

```fish
jq -nc \
  --arg cwd $PWD/.vscode/engine/output \
  '{
    jsonrpc: "2.0",
    method: "invoke",
    id: 1,
    params: {
      tool: "getAllDiscoveredTemplateGroups",
      arguments: {
        cwd: $cwd,
        include_builtin: true,
        local_roots: [$cwd]
      }
    }
  }' \
| ./presenton-template-engine/bundle/ppt-engine \
| tee /tmp/executa-response.json \
| jq
```

然后：

```fish
cat (jq -r '.__file_transport' /tmp/executa-response.json) | jq
```
