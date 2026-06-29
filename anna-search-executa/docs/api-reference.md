# Anna Search Executa 接口文档

本文档面向需要调用 Anna Search Executa 的 Anna app 开发者。Anna Search Executa 是一个长驻 stdin/stdout JSON-RPC 工具进程，当前通过 `ddgs` provider 提供网页搜索、网页抓取、图片搜索和图片下载能力。

## 基本信息

| 项目 | 值 |
| --- | --- |
| Tool name | `tool-anna-search-local` |
| Display name | `Anna Search` |
| 当前版本 | `0.1.0` |
| JSON-RPC 版本 | `2.0` |
| 通信方式 | 每行一个 JSON-RPC request，经 stdin 输入；每行一个 JSON-RPC response，经 stdout 输出 |
| 支持方法 | `describe`、`health`、`invoke` |

启动方式：

```bash
uv run anna-search-executa
```

开发环境中也可以直接运行：

```bash
uv run python example_plugin.py
```

调用方需要注意：

- 每个请求必须单行输出到工具进程的 stdin。
- 工具只会向 stdout 输出 JSON-RPC response frame。
- 诊断日志、异常堆栈等只会写入 stderr，不应从 stdout 解析日志。
- 每次 stdout response 后工具会 flush。
- 工具会持续读取 stdin，直到 EOF。

## JSON-RPC 调用格式

请求通用格式：

```json
{"jsonrpc":"2.0","id":1,"method":"invoke","params":{"tool":"web_search","arguments":{"query":"Anna Executa"}}}
```

成功响应通用格式：

```json
{"jsonrpc":"2.0","id":1,"result":{}}
```

错误响应通用格式：

```json
{"jsonrpc":"2.0","id":1,"error":{"code":-32602,"message":"query is required"}}
```

错误码：

| code | 含义 | 常见原因 |
| --- | --- | --- |
| `-32700` | Parse error | 输入不是合法 JSON |
| `-32600` | Invalid request | 请求不是对象、`jsonrpc` 不是 `2.0`、`method` 不是字符串 |
| `-32601` | Method not found | JSON-RPC method 不存在，或 `invoke` 的 tool 不存在 |
| `-32602` | Invalid params | `params`、`arguments` 或工具参数不合法 |
| `-32603` | Internal error | 工具内部未捕获异常 |

## describe

`describe` 返回项目根目录 `manifest.json` 的完整内容。调用方可以用它发现当前工具版本、展示名和工具参数定义。

请求示例：

```json
{"jsonrpc":"2.0","id":1,"method":"describe"}
```

响应示例节选：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "name": "tool-anna-search-local",
    "version": "0.1.0",
    "display_name": "Anna Search",
    "tools": [
      {"name": "web_search"},
      {"name": "web_fetch"},
      {"name": "image_search"},
      {"name": "image_fetch"}
    ]
  }
}
```

## health

`health` 返回工具进程健康状态、版本和工具数量。

请求示例：

```json
{"jsonrpc":"2.0","id":2,"method":"health"}
```

响应字段：

| 字段 | 类型 | 说明 | 示例 |
| --- | --- | --- | --- |
| `status` | string | 健康状态。当前健康时固定为 `healthy`。 | `"healthy"` |
| `timestamp` | string | UTC ISO 8601 时间戳。 | `"2026-06-17T09:30:00.000000+00:00"` |
| `version` | string | 当前工具版本，来自 `manifest.json`。 | `"0.1.0"` |
| `tools_count` | integer | manifest 中声明的工具数量。 | `4` |

响应示例：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "status": "healthy",
    "timestamp": "2026-06-17T09:30:00.000000+00:00",
    "version": "0.1.0",
    "tools_count": 4
  }
}
```

## invoke

`invoke` 用来调用具体工具。`params` 必须是对象，且必须包含：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `tool` | string | 是 | 要调用的工具名。支持 `web_search`、`web_fetch`、`image_search`、`image_fetch`。 |
| `arguments` | object | 是 | 对应工具的参数对象。不同工具参数不同。 |

成功响应的 `result` 固定包含：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `success` | boolean | 工具调用成功时为 `true`。注意：对 `web_fetch` 和 `image_fetch`，单个 URL 抓取失败不会让整个 invoke 失败，失败信息在 `data.results[].error` 中。 |
| `tool` | string | 实际调用的工具名。 |
| `data` | object | 工具返回数据。结构由具体工具决定。 |

请求模板：

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "invoke",
  "params": {
    "tool": "web_search",
    "arguments": {}
  }
}
```

## invoke: web_search

`web_search` 用于搜索网页，返回归一化后的搜索结果列表。它适合先找候选 URL；如果需要页面正文，再把 URL 传给 `web_fetch`。

### 参数

| 参数 | 类型 | 必填 | 默认值 | 限制 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `query` | string | 是 | 无 | 去除首尾空白后不能为空 | 搜索关键词、问题或自然语言查询。 |
| `max_results` | integer | 否 | `5` | `1` 到 `20`，不能是 boolean | 最多返回多少条结果。实际返回数量可能少于该值。 |
| `region` | string | 否 | `"us-en"` | 去除首尾空白后不能为空 | 搜索地区参数，会传给 provider。例如 `"us-en"`。 |
| `safesearch` | string | 否 | `"moderate"` | 只能是 `"off"`、`"moderate"`、`"strict"` | 安全搜索级别。 |
| `timelimit` | string | 否 | `null` | 只能是 `"d"`、`"w"`、`"m"`、`"y"` | 时间范围过滤。`d` 表示最近一天，`w` 表示最近一周，`m` 表示最近一月，`y` 表示最近一年。 |

不允许传入未声明字段。传入额外字段会返回 `-32602 Unknown argument`，并在 `error.data.fields` 中列出字段名。

### 请求示例

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "invoke",
  "params": {
    "tool": "web_search",
    "arguments": {
      "query": "Anna Executa",
      "max_results": 5,
      "region": "us-en",
      "safesearch": "moderate",
      "timelimit": "m"
    }
  }
}
```

### 返回字段

`result.data` 字段：

| 字段 | 类型 | 说明 | 示例 |
| --- | --- | --- | --- |
| `query` | string | 归一化后的搜索 query，即去除首尾空白后的输入。 | `"Anna Executa"` |
| `provider` | string | 实际使用的搜索 provider 名称。当前默认为 `"ddgs"`。 | `"ddgs"` |
| `results` | array | 搜索结果数组。 | 见下表 |
| `count` | integer | `results` 数组长度。 | `5` |

`results[]` 字段：

| 字段 | 类型 | 是否一定存在 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| `title` | string | 是 | 搜索结果标题。provider 没有返回时为空字符串。 | `"Anna Executa"` |
| `url` | string | 是 | 搜索结果 URL。 | `"https://example.com/anna"` |
| `snippet` | string | 是 | 搜索结果摘要。provider 没有返回时为空字符串。 | `"Anna Executa developer documentation..."` |
| `source` | string | 否 | 结果来源。只有 provider 返回非空来源时才存在。 | `"example.com"` |

### 响应示例

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "success": true,
    "tool": "web_search",
    "data": {
      "query": "Anna Executa",
      "provider": "ddgs",
      "results": [
        {
          "title": "Anna Executa",
          "url": "https://example.com/anna",
          "snippet": "Anna Executa developer documentation...",
          "source": "example.com"
        }
      ],
      "count": 1
    }
  }
}
```

### 常见参数错误

| 场景 | 错误 |
| --- | --- |
| 缺少 `query` 或 `query` 为空字符串 | `-32602 query is required` |
| `max_results` 不是整数 | `-32602 max_results must be an integer` |
| `max_results` 小于 1 或大于 20 | `-32602 max_results must be between 1 and 20` |
| `safesearch` 不在允许值内 | `-32602 safesearch must be one of: off, moderate, strict` |
| `timelimit` 不在允许值内 | `-32602 timelimit must be one of: d, w, m, y` |

## invoke: web_fetch

`web_fetch` 用于抓取网页正文，把每个 URL 的正文写入文件，并返回文件路径、索引路径和每个 URL 的抓取结果。它不会把网页全文直接写到 stdout。

适合流程：

1. 用 `web_search` 搜索候选 URL。
2. 从搜索结果中选择需要阅读的 URL。
3. 用 `web_fetch` 抓取正文文件。
4. 调用方读取返回的 `file_path` 或 `index_path`。

### 参数

| 参数 | 类型 | 必填 | 默认值 | 限制 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `urls` | array<string> | 是 | 无 | 数组长度 `1` 到 `10` | 要抓取的网页 URL 列表。结果顺序与输入顺序一致。 |
| `output_dir` | string | 否 | 系统临时目录下的 `anna-search-executa` | 非空字符串；如果路径已存在，必须是目录 | 输出根目录。工具会在该目录下创建本次调用专属子目录。 |
| `format` | string | 否 | `"text_rich"` | 只能是 `"text_markdown"`、`"text_plain"`、`"text_rich"` | 正文提取格式，会传给 provider。 |
| `max_chars` | integer | 否 | `12000` | `1000` 到 `50000`，不能是 boolean | 每个 URL 最多写入多少个字符。超过会截断，并把 `truncated` 置为 `true`。 |

URL 限制：

- 只允许 `http` 和 `https`。
- URL 必须包含 host。
- URL 不能包含 username/password。
- 不允许 `localhost`、`localhost.localdomain`。
- 不允许直接使用 loopback、private、link-local、unspecified IP，例如 `127.0.0.1`、`192.168.1.10`。

重复 URL 处理：

- 工具会对完全相同的 URL 去重抓取，避免重复网络请求。
- 返回的 `results` 仍保留输入顺序和输入数量。
- 如果输入中同一个 URL 出现多次，对应结果会指向同一个文件路径。

### 请求示例

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "invoke",
  "params": {
    "tool": "web_fetch",
    "arguments": {
      "urls": [
        "https://example.com/anna",
        "https://example.com/docs"
      ],
      "output_dir": "/tmp/anna-search-results",
      "format": "text_markdown",
      "max_chars": 12000
    }
  }
}
```

### 返回字段

`result.data` 字段：

| 字段 | 类型 | 说明 | 示例 |
| --- | --- | --- | --- |
| `output_dir` | string | 本次调用创建的专属输出目录绝对路径。 | `"/tmp/anna-search-results/web-fetch-20260617-093000-a1b2c3d4"` |
| `index_path` | string | 本次调用索引文件绝对路径。索引文件内容与 `data` 基本一致。 | `"/tmp/anna-search-results/web-fetch-20260617-093000-a1b2c3d4/index.json"` |
| `format` | string | 本次使用的正文格式。 | `"text_markdown"` |
| `max_chars` | integer | 本次每个 URL 最多写入字符数。 | `12000` |
| `results` | array | 每个输入 URL 对应的结果。 | 见下表 |
| `count` | integer | `results` 数组长度。 | `2` |

`results[]` 成功字段：

| 字段 | 类型 | 是否一定存在 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| `url` | string | 是 | 原始输入 URL。 | `"https://example.com/anna"` |
| `success` | boolean | 是 | 单个 URL 是否抓取成功。成功时为 `true`。 | `true` |
| `format` | string | 是 | 写入内容格式。 | `"text_markdown"` |
| `file_path` | string | 是 | 写入的正文文件绝对路径。 | `"/tmp/.../001-example-com.md"` |
| `relative_path` | string | 是 | 相对于 `output_dir` 的文件名。 | `"001-example-com.md"` |
| `content_length` | integer | 是 | provider 返回的原始正文字符数，截断前长度。 | `18000` |
| `written_chars` | integer | 是 | 实际写入文件的字符数。 | `12000` |
| `truncated` | boolean | 是 | 是否因为超过 `max_chars` 被截断。 | `true` |
| `final_url` | string | 否 | 如果 provider 返回的最终 URL 与原始 URL 不同，则返回该字段。 | `"https://example.com/final"` |

`results[]` 失败字段：

| 字段 | 类型 | 说明 | 示例 |
| --- | --- | --- | --- |
| `url` | string | 原始输入 URL。 | `"https://example.com/fail"` |
| `success` | boolean | 失败时为 `false`。 | `false` |
| `error.type` | string | 当前固定为 `"fetch_error"`。 | `"fetch_error"` |
| `error.message` | string | provider 或下载过程返回的错误信息。 | `"fetch failed"` |

文件扩展名：

| `format` | 文件扩展名 |
| --- | --- |
| `text_markdown` | `.md` |
| `text_plain` | `.txt` |
| `text_rich` | `.txt` |

### 响应示例

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "success": true,
    "tool": "web_fetch",
    "data": {
      "output_dir": "/tmp/anna-search-results/web-fetch-20260617-093000-a1b2c3d4",
      "index_path": "/tmp/anna-search-results/web-fetch-20260617-093000-a1b2c3d4/index.json",
      "format": "text_markdown",
      "max_chars": 12000,
      "results": [
        {
          "url": "https://example.com/anna",
          "success": true,
          "format": "text_markdown",
          "file_path": "/tmp/anna-search-results/web-fetch-20260617-093000-a1b2c3d4/001-example-com.md",
          "relative_path": "001-example-com.md",
          "content_length": 18000,
          "written_chars": 12000,
          "truncated": true,
          "final_url": "https://example.com/anna/final"
        },
        {
          "url": "https://example.com/docs",
          "success": false,
          "error": {
            "type": "fetch_error",
            "message": "fetch failed"
          }
        }
      ],
      "count": 2
    }
  }
}
```

### 常见参数错误

| 场景 | 错误 |
| --- | --- |
| 缺少 `urls` | `-32602 urls must be an array` |
| `urls` 不是数组 | `-32602 urls must be an array` |
| `urls` 数量小于 1 或大于 10 | `-32602 urls must contain between 1 and 10 items` |
| `urls[]` 不是非空字符串 | `-32602 urls items must be non-empty strings` |
| URL 不是 `http` 或 `https` | `-32602 url scheme must be http or https` |
| URL 没有 host | `-32602 url must include a host` |
| URL 包含 username/password | `-32602 url must not include credentials` |
| URL host 不允许 | `-32602 url host is not allowed` |
| `output_dir` 为空字符串 | `-32602 output_dir must be a non-empty string` |
| `output_dir` 已存在但不是目录 | `-32602 output_dir must be a directory` |
| `format` 不在允许值内 | `-32602 format must be one of: text_markdown, text_plain, text_rich` |
| `max_chars` 不是整数 | `-32602 max_chars must be an integer` |
| `max_chars` 小于 1000 或大于 50000 | `-32602 max_chars must be between 1000 and 50000` |

## invoke: image_search

`image_search` 用于搜索图片，返回图片 URL、缩略图、来源页面、尺寸等元数据。它只返回元数据，不下载图片文件；如果需要下载图片，再把 `image_url` 传给 `image_fetch`。

### 参数

| 参数 | 类型 | 必填 | 默认值 | 限制 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `query` | string | 是 | 无 | 去除首尾空白后不能为空 | 图片搜索关键词、问题或自然语言查询。 |
| `max_results` | integer | 否 | `5` | `1` 到 `20`，不能是 boolean | 最多返回多少条图片结果。实际返回数量可能少于该值。 |
| `region` | string | 否 | `"us-en"` | 去除首尾空白后不能为空 | 搜索地区参数，会传给 provider。 |
| `safesearch` | string | 否 | `"moderate"` | 只能是 `"off"`、`"moderate"`、`"strict"` | 安全搜索级别。 |
| `timelimit` | string | 否 | `null` | 只能是 `"d"`、`"w"`、`"m"`、`"y"` | 时间范围过滤。 |
| `size` | string | 否 | `null` | 如果传入，去除首尾空白后不能为空 | provider-specific 图片尺寸过滤参数。 |
| `color` | string | 否 | `null` | 如果传入，去除首尾空白后不能为空 | provider-specific 图片颜色过滤参数。 |
| `type_image` | string | 否 | `null` | 如果传入，去除首尾空白后不能为空 | provider-specific 图片类型过滤参数。 |
| `layout` | string | 否 | `null` | 如果传入，去除首尾空白后不能为空 | provider-specific 图片布局过滤参数。 |

`size`、`color`、`type_image`、`layout` 的具体可用值由底层 provider 决定。当前实现会原样传给 `ddgs`。

### 请求示例

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "invoke",
  "params": {
    "tool": "image_search",
    "arguments": {
      "query": "Anna Executa logo",
      "max_results": 5,
      "region": "us-en",
      "safesearch": "moderate",
      "size": "Large",
      "color": "Blue",
      "type_image": "photo",
      "layout": "Wide"
    }
  }
}
```

### 返回字段

`result.data` 字段：

| 字段 | 类型 | 说明 | 示例 |
| --- | --- | --- | --- |
| `query` | string | 归一化后的搜索 query。 | `"Anna Executa logo"` |
| `provider` | string | 实际使用的图片搜索 provider 名称。当前默认为 `"ddgs"`。 | `"ddgs"` |
| `results` | array | 图片结果数组。只包含存在 `image_url` 的结果。 | 见下表 |
| `count` | integer | `results` 数组长度。 | `5` |

`results[]` 字段：

| 字段 | 类型 | 是否一定存在 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| `title` | string | 是 | 图片结果标题。provider 没有返回时为空字符串。 | `"Anna Executa logo"` |
| `image_url` | string | 是 | 原图 URL。 | `"https://example.com/image.jpg"` |
| `thumbnail_url` | string | 否 | 缩略图 URL。 | `"https://example.com/thumb.jpg"` |
| `page_url` | string | 否 | 图片所在页面 URL。 | `"https://example.com/page"` |
| `width` | integer | 否 | 图片宽度。provider 可解析为整数时返回。 | `640` |
| `height` | integer | 否 | 图片高度。provider 可解析为整数时返回。 | `480` |
| `source` | string | 否 | 图片来源。 | `"example.com"` |

### 响应示例

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "success": true,
    "tool": "image_search",
    "data": {
      "query": "Anna Executa logo",
      "provider": "ddgs",
      "results": [
        {
          "title": "Anna Executa logo",
          "image_url": "https://example.com/image.jpg",
          "thumbnail_url": "https://example.com/thumb.jpg",
          "page_url": "https://example.com/page",
          "width": 640,
          "height": 480,
          "source": "example.com"
        }
      ],
      "count": 1
    }
  }
}
```

### 常见参数错误

`image_search` 复用 `web_search` 的基础参数校验，因此 `query`、`max_results`、`region`、`safesearch`、`timelimit` 的错误与 `web_search` 一致。

额外错误：

| 场景 | 错误 |
| --- | --- |
| `size` 传入空字符串 | `-32602 size must be a non-empty string` |
| `color` 传入空字符串 | `-32602 color must be a non-empty string` |
| `type_image` 传入空字符串 | `-32602 type_image must be a non-empty string` |
| `layout` 传入空字符串 | `-32602 layout must be a non-empty string` |
| 传入未声明字段 | `-32602 Unknown argument` |

## invoke: image_fetch

`image_fetch` 用于下载图片 URL，把图片二进制内容写入文件，并返回文件路径、content type、字节数和 SHA-256。它不会把图片二进制内容写到 stdout。

### 参数

| 参数 | 类型 | 必填 | 默认值 | 限制 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `urls` | array<string> | 是 | 无 | 数组长度 `1` 到 `10` | 要下载的图片 URL 列表。结果顺序与输入顺序一致。 |
| `output_dir` | string | 否 | 系统临时目录下的 `anna-search-executa` | 非空字符串；如果路径已存在，必须是目录 | 输出根目录。工具会在该目录下创建本次调用专属子目录。 |
| `max_bytes` | integer | 否 | `10485760` | `1048576` 到 `52428800`，不能是 boolean | 每张图片允许下载的最大字节数。默认 10 MiB，最小 1 MiB，最大 50 MiB。 |

URL 限制与 `web_fetch` 相同。

下载行为：

- 每个图片请求超时时间固定为 60 秒。
- HTTP 请求会带浏览器风格 `User-Agent` 和图片 `Accept` header。
- 响应 `Content-Type` 必须是 `image/*`，否则该 URL 结果为失败。
- 如果响应 `Content-Length` 大于 `max_bytes`，该 URL 结果为失败。
- 如果读取过程中累计下载字节数超过 `max_bytes`，该 URL 结果为失败。
- 重复 URL 会去重下载，但 `results` 保留输入顺序和输入数量。

### 请求示例

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "invoke",
  "params": {
    "tool": "image_fetch",
    "arguments": {
      "urls": [
        "https://example.com/image.jpg"
      ],
      "output_dir": "/tmp/anna-images",
      "max_bytes": 10485760
    }
  }
}
```

### 返回字段

`result.data` 字段：

| 字段 | 类型 | 说明 | 示例 |
| --- | --- | --- | --- |
| `output_dir` | string | 本次调用创建的专属输出目录绝对路径。 | `"/tmp/anna-images/image-fetch-20260617-093000-a1b2c3d4"` |
| `index_path` | string | 本次调用索引文件绝对路径。索引文件内容与 `data` 基本一致。 | `"/tmp/anna-images/image-fetch-20260617-093000-a1b2c3d4/index.json"` |
| `max_bytes` | integer | 本次每张图片允许下载的最大字节数。 | `10485760` |
| `results` | array | 每个输入 URL 对应的结果。 | 见下表 |
| `count` | integer | `results` 数组长度。 | `1` |

`results[]` 成功字段：

| 字段 | 类型 | 是否一定存在 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| `url` | string | 是 | 原始输入 URL。 | `"https://example.com/image.jpg"` |
| `success` | boolean | 是 | 单个 URL 是否下载成功。成功时为 `true`。 | `true` |
| `file_path` | string | 是 | 写入的图片文件绝对路径。 | `"/tmp/.../001-example-com.jpg"` |
| `relative_path` | string | 是 | 相对于 `output_dir` 的文件名。 | `"001-example-com.jpg"` |
| `content_type` | string | 是 | 响应图片 MIME type。 | `"image/jpeg"` |
| `bytes` | integer | 是 | 写入文件的字节数。 | `15324` |
| `sha256` | string | 是 | 图片内容 SHA-256 十六进制摘要。 | `"b0423673071359e7ff62ec7f2766b1bfe8682ee426b8d6672f8aab0619ba7648"` |
| `final_url` | string | 否 | 如果最终下载 URL 与原始 URL 不同，则返回该字段。 | `"https://cdn.example.com/image.jpg"` |

`results[]` 失败字段：

| 字段 | 类型 | 说明 | 示例 |
| --- | --- | --- | --- |
| `url` | string | 原始输入 URL。 | `"https://example.com/page"` |
| `success` | boolean | 失败时为 `false`。 | `false` |
| `error.type` | string | 当前固定为 `"fetch_error"`。 | `"fetch_error"` |
| `error.message` | string | 下载或校验过程返回的错误信息。 | `"Content-Type is not image/*: text/html"` |

图片文件扩展名：

- `image/jpeg` -> `.jpg`
- `image/png` -> `.png`
- `image/webp` -> `.webp`
- `image/gif` -> `.gif`
- `image/svg+xml` -> `.svg`
- 其它图片 MIME type 会通过系统 MIME 映射推断扩展名，推断失败时使用 `.img`。

### 响应示例

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": {
    "success": true,
    "tool": "image_fetch",
    "data": {
      "output_dir": "/tmp/anna-images/image-fetch-20260617-093000-a1b2c3d4",
      "index_path": "/tmp/anna-images/image-fetch-20260617-093000-a1b2c3d4/index.json",
      "max_bytes": 10485760,
      "results": [
        {
          "url": "https://example.com/image.jpg",
          "success": true,
          "file_path": "/tmp/anna-images/image-fetch-20260617-093000-a1b2c3d4/001-example-com.jpg",
          "relative_path": "001-example-com.jpg",
          "content_type": "image/jpeg",
          "bytes": 15324,
          "sha256": "b0423673071359e7ff62ec7f2766b1bfe8682ee426b8d6672f8aab0619ba7648",
          "final_url": "https://cdn.example.com/image.jpg"
        }
      ],
      "count": 1
    }
  }
}
```

### 常见参数错误

| 场景 | 错误 |
| --- | --- |
| 缺少 `urls` | `-32602 urls must be an array` |
| `urls` 数量小于 1 或大于 10 | `-32602 urls must contain between 1 and 10 items` |
| URL 不满足安全限制 | `-32602 url scheme must be http or https`、`url host is not allowed` 等 |
| `output_dir` 为空字符串 | `-32602 output_dir must be a non-empty string` |
| `output_dir` 已存在但不是目录 | `-32602 output_dir must be a directory` |
| `max_bytes` 不是整数 | `-32602 max_bytes must be an integer` |
| `max_bytes` 小于 1048576 或大于 52428800 | `-32602 max_bytes must be between 1048576 and 52428800` |
| 传入未声明字段 | `-32602 Unknown argument` |

## 推荐调用流程

搜索网页并读取正文：

```text
web_search(query) -> 选取 results[].url -> web_fetch(urls) -> 读取 data.results[].file_path
```

搜索图片并下载：

```text
image_search(query) -> 选取 results[].image_url -> image_fetch(urls) -> 读取 data.results[].file_path
```

调用方建议：

- 对 `web_fetch` 和 `image_fetch`，先判断 `result.success`，再逐项判断 `data.results[].success`。
- 不要假设 `web_search` 和 `image_search` 一定返回 `max_results` 条结果。
- 不要从 stdout 读取正文或图片二进制；只从返回的文件路径读取内容。
- 如果调用方需要稳定落盘位置，应显式传入 `output_dir`。
- 如果调用方只是临时使用，可以省略 `output_dir`，工具会写入系统临时目录。

## 最小端到端示例

下面示例展示如何通过 shell 向长驻进程发送单个请求。实际 app 中通常会持有一个子进程，并按行写入请求、按行读取响应。

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":3,"method":"invoke","params":{"tool":"web_search","arguments":{"query":"Anna Executa","max_results":5}}}' | uv run python example_plugin.py
```

网页抓取：

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":4,"method":"invoke","params":{"tool":"web_fetch","arguments":{"urls":["https://example.com"],"max_chars":12000}}}' | uv run python example_plugin.py
```

图片搜索：

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":5,"method":"invoke","params":{"tool":"image_search","arguments":{"query":"Anna Executa","max_results":5}}}' | uv run python example_plugin.py
```

图片下载：

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":6,"method":"invoke","params":{"tool":"image_fetch","arguments":{"urls":["https://example.com/image.jpg"]}}}' | uv run python example_plugin.py
```
