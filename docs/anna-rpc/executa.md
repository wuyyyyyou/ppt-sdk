# Executa 二进制直接调用命令

这份文档对应当前仓库里的 Executa 插件调试入口，直接在 fish 里构造 JSON-RPC 请求并调用打包后的二进制。

## 前提

以下命令默认都在仓库根目录执行

先确保二进制已经打好：

```fish
./ppt-app/executas/ppt-engine/build_binary.sh --test
```

`ppt-engine` 现在打包成 Anna Binary 分发 archive。`--test` 会自动解压 archive 并调用 `describe` 冒烟；如果要手工执行下面的 Engine 命令，先解压当前平台 archive 并设置 `PPT_ENGINE_BIN`：

```fish
set engine_archive (ls ./ppt-app/executas/ppt-engine/bundle/ppt-engine-v*-*.tar.gz | head -n 1)
rm -rf /tmp/ppt-engine-binary
mkdir -p /tmp/ppt-engine-binary
tar -C /tmp/ppt-engine-binary -xzf $engine_archive
set PPT_ENGINE_BIN /tmp/ppt-engine-binary/bin/ppt-engine
```

Windows 平台 archive 是 `.zip`，包内入口是 `bin/ppt-engine.exe`。archive 顶层的 `manifest.json` 是 Anna Binary 分发入口配置；插件 `describe` 返回的 Executa tool manifest 仍来自 engine 包内嵌的 tool manifest。

## 约定

- 所有请求都走 JSON-RPC 2.0 over stdio。
- 这里统一用 `jq -nc` 构造请求 JSON。
- 最后一个 `| jq` 只是为了把响应格式化输出，方便看结果。
- 插件日志会走 `stderr`，不会影响 `stdout` 里的 JSON-RPC 响应。

## Engine

### Engine: Describe

```fish
jq -nc '{jsonrpc:"2.0",method:"describe",id:1}' \
| $PPT_ENGINE_BIN \
| jq
```

### Engine: Health

```fish
jq -nc '{jsonrpc:"2.0",method:"health",id:1}' \
| $PPT_ENGINE_BIN \
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
| $PPT_ENGINE_BIN \
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
| $PPT_ENGINE_BIN \
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
| $PPT_ENGINE_BIN \
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
| $PPT_ENGINE_BIN \
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
| $PPT_ENGINE_BIN \
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
| $PPT_ENGINE_BIN \
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
| $PPT_ENGINE_BIN \
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
| $PPT_ENGINE_BIN \
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
| $PPT_ENGINE_BIN \
| jq
```

## PPTX 导出

PPTX 不再通过公开的任意 HTML 转换工具或独立 Generator 生成。App 工作区完成 Final Deck Render 后调用 `app_start_pptx_export`，再轮询 `app_get_pptx_export_status`；`ppt-engine` 从已记录的整体 `deck.html` 直接生成 `output/deck.pptx`。

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
| $PPT_ENGINE_BIN \
| tee /tmp/executa-response.json \
| jq
```

然后：

```fish
cat (jq -r '.__file_transport' /tmp/executa-response.json) | jq
```
