# Anna Search Executa

Anna Search Executa 是一个通过 stdin/stdout JSON-RPC 暴露的 Anna Tool。当前搜索 provider 使用 `ddgs`，代码结构保留了接入其它 provider 的扩展点。

## 安装

```bash
uv sync --extra dev
```

## describe 测试

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"describe"}' | uv run python example_plugin.py
```

`describe` 会直接返回根目录 `manifest.json` 的内容。

## health 测试

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":2,"method":"health"}' | uv run python example_plugin.py
```

## invoke 测试

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":3,"method":"invoke","params":{"tool":"web_search","arguments":{"query":"Anna Executa","max_results":5}}}' | uv run python example_plugin.py
```

`web_search` 返回候选 URL。抓取页面正文时使用 `web_fetch`，默认提取 `text_rich` 格式；正文会写入输出目录中的文件，stdout 只返回文件路径和索引信息。

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":4,"method":"invoke","params":{"tool":"web_fetch","arguments":{"urls":["https://anna.partners/developers"],"max_chars":12000}}}' | uv run python example_plugin.py
```

图片搜索使用 `image_search` 返回图片 URL、缩略图 URL、来源页面和尺寸等元数据。

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":5,"method":"invoke","params":{"tool":"image_search","arguments":{"query":"Anna Executa","max_results":5}}}' | uv run python example_plugin.py
```

下载图片使用 `image_fetch`，图片会写入输出目录中的文件，stdout 只返回文件路径、content type、字节数和 sha256。

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":6,"method":"invoke","params":{"tool":"image_fetch","arguments":{"urls":["https://example.com/image.jpg"]}}}' | uv run python example_plugin.py
```

stdout 只输出 JSON-RPC 响应；诊断日志只能写到 stderr。

## 运行协议测试

```bash
uv run pytest
```

## 打包二进制

```bash
uv sync --extra build
./build_binary.sh
./build_binary.sh --test
```

打包产物写入 `bundle/`。压缩包使用 Anna Binary 分发目录结构：`bin/`、`lib/`、`data/` 和根目录 `manifest.json`。根目录 `manifest.json` 是 binary distribution manifest；Executa tool manifest 来自仓库根目录 `manifest.json`，构建时会嵌入到二进制里，因此压缩包内不会再包含第二个 tool manifest。
