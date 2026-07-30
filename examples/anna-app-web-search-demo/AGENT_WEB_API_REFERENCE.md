# Anna App `web.*` Host API Agent 参考手册

> 面向在本仓库中编写 Anna App 集成代码的 AI Agent。
>
> 最后核对日期：2026-07-27。
>
> 本文依据 Anna staging 官方文档和本目录下的真实平台测试结果编写。官方契约与实测行为会明确区分；未注明的行为不得自行推断。

## 1. 使用范围

本文覆盖 Anna App iframe（内嵌页面）中的四个 Host API（宿主接口）：

- `anna.web.search`：搜索 Web 或新闻。
- `anna.web.fetch`：抓取网页并提取 Markdown 或纯文本正文。
- `anna.web.image_search`：搜索开启安全过滤的图片。
- `anna.web.image_fetch`：由宿主下载图片并保存到 Anna Persistent Storage，简称 APS（Anna 持久化存储）。

这些接口由 Anna Host（Anna 宿主）执行。App 不需要也不应持有搜索供应商密钥。

本文不覆盖：

- 自定义 Executa 搜索工具的协议。
- 搜索结果的业务筛选、事实核查或 Research Curation（研究整理）实现。
- `anna.files.*` 的完整接口，仅说明它与 `image_fetch` 工件的关系。
- Anna 平台内部供应商实现细节。

## 2. 权威来源与证据等级

实现时按以下优先级判断：

1. [Anna 官方 `web.*` 参考文档](https://staging.anna.partners/developers/reference/host-api-web.md)：规范性来源。
2. [Anna App UI SDK 文档](https://staging.anna.partners/developers/apps/app-ui-sdk.md)：SDK 连接、调用和通用错误说明。
3. [本 Demo 的调用代码](./src/app.js)：已经运行过的调用示例。
4. 本目录 `.tmp/*_result_1.json`：2026-07-27 在 Anna 平台得到的一次真实响应样本。

注意：官方入口当前是 staging 文档，接口可能继续演进。修改集成前，应重新读取：

```bash
curl -fsSL https://staging.anna.partners/llms.txt
curl -fsSL https://staging.anna.partners/developers/reference/host-api-web.md
```

一次实测响应只能证明该字段或行为曾经出现，不能把它提升为稳定契约。稳定字段、可选字段、限制和安全规则以官方文档为准。

## 3. 强制实现规则

编写调用代码时必须遵守以下规则：

1. 只能从 Anna App iframe 通过 `AnnaAppRuntime` 调用这些接口。
2. 必须在 `manifest.json` 的 `ui.host_api.web` 中声明需要的方法。
3. manifest 授权不等于用户授权。每次调用仍受用户控制的 `web_grant` 限制。
4. 所有可选字段都必须按缺失或 `null` 处理，不得假定一定存在。
5. `web.fetch` 必须逐项检查 `pages[i].ok`，不能只根据顶层 Promise 是否成功判断所有页面成功。
6. `image_fetch` 返回工件引用，不返回图片字节。
7. `get_url` 是短时效预签名 URL，不得作为长期持久化标识。
8. 不得关闭图片安全搜索，也不得尝试绕过 SSRF（服务端请求伪造）保护。
9. 不得把 `license_hint` 当成版权许可证明。
10. 不得硬编码供应商、CU 价格、实际执行层级或响应耗时。
11. 在本仓库中，搜索和抓取结果属于 Raw Research Material（原始研究材料），未经 Research Curation（研究整理）不得直接作为 Page Authoring（页面创作）的事实依据。

## 4. 初始化与权限声明

### 4.1 连接 Anna Runtime

```js
import { AnnaAppRuntime } from "/static/anna-apps/_sdk/latest/index.js";

const anna = await AnnaAppRuntime.connect();
```

不要在普通浏览器页面中假定 `AnnaAppRuntime` 可用。本 Demo 必须由 Anna Host 或 `anna-app dev` 加载；直接打开 `index.html` 无法连接宿主。

### 4.2 Manifest 声明

只声明实际需要的方法：

```json
{
  "ui": {
    "host_api": {
      "web": ["search", "fetch", "image_search", "image_fetch"]
    }
  }
}
```

也可以使用 `"*"`，但面向生产的 App 应优先采用最小权限。

### 4.3 用户授权 `web_grant`

官方文档定义的授权形状为：

```ts
interface WebGrant {
  enabled: boolean;
  allowSearch: boolean;
  allowFetch: boolean;
  allowAdvanced: boolean;
  allowImageSearch: boolean;
  allowImageFetch: boolean;
  maxResultsPerCall: number;
}
```

关键语义：

- 生产环境默认未启用 Web 授权。
- 首次调用可能返回 `APP_NOT_GRANTED`，由宿主驱动用户授权流程。
- `allowAdvanced` 默认关闭。
- `allowImageSearch` 和 `allowImageFetch` 即使 Web 已启用也可能保持关闭。
- `anna-app dev` 通常会安装完整启用的开发授权，因此本地开发不一定能复现生产环境首次授权流程。
- 开发调用通常不计费，不能据此推断生产环境 CU 消耗。

应用应展示清晰错误或等待用户完成授权，不得自动无限重试。

## 5. 调用与错误处理通则

### 5.1 推荐调用包装

当前 Demo 和真实调用行为采用 Promise 成功返回结果、失败进入 `catch` 的方式：

```js
function normalizeAnnaError(error) {
  if (!error || typeof error !== "object") {
    return { message: String(error) };
  }

  return {
    name: error.name,
    code: error.code ?? error.error?.code,
    message: error.message ?? error.error?.message ?? String(error),
    data: error.data ?? error.error?.data,
  };
}

async function callAnna(operation) {
  try {
    return await operation();
  } catch (error) {
    const normalized = normalizeAnnaError(error);
    // 记录结构化诊断信息，但不要记录仍然有效的敏感预签名 URL。
    console.error(normalized);
    throw error;
  }
}
```

Anna SDK 文档还描述了 `{ok: false, error}` 形式的底层 RPC 响应，但当前四个高级 SDK 方法的失败对象尚无本目录真实样本。不要编造确切错误对象层级；使用兼容归一化逻辑，并在获得真实错误样本后更新本文。

### 5.2 两层失败模型

需要区分：

- 顶层调用失败：权限、参数、配额、限流或整个供应商链失败，Promise 进入 `catch`。
- `web.fetch` 单项失败：顶层调用仍可能成功，但某个 `pages[i].ok` 为 `false`。

常见顶层错误包括但不限于：

- `APP_NOT_GRANTED`：用户尚未授权对应能力。
- `APP_INVALID_REQUEST`：参数非法或超过服务端限制。
- `permission_denied`：manifest 未声明方法，或 Host API 权限不允许。
- `invalid_arg`：RPC 参数结构不匹配。
- `rate_limited`：并发或调用频率受限。

以上错误并未全部在本目录实测。业务代码不得只匹配这一份列表；未知错误也必须保留 `code`、`message` 和诊断数据。

### 5.3 SDK 超时与服务端超时

下面两个参数属于不同层级：

```js
await anna.web.fetch(
  {
    urls,
    timeout_ms: 30000, // 服务端对抓取操作的参数。
  },
  {
    timeoutMs: 90000, // SDK 等待整个 RPC 调用的时间。
  },
);
```

批量抓取时，SDK 外层 `timeoutMs` 应大于单项服务端超时和合理的调度开销。官方建议大批量调用可使用 `{ timeoutMs: 90000 }`；SDK Web 命名空间默认约为 60 秒。

## 6. `anna.web.search`

### 6.1 用途

搜索普通网页或新闻，返回供应商无关的标准化结果。`search_depth: "advanced"` 表达质量意图，不指定实际供应商，也不保证最终执行高级层级。

### 6.2 请求

```ts
interface WebSearchRequest {
  query: string;
  max_results?: number;
  search_depth?: "basic" | "advanced";
  topic?: "general" | "news";
  time_range?: "day" | "week" | "month" | "year";
  region?: string;
  include_domains?: string[];
  exclude_domains?: string[];
}
```

约束：

- `query` 必填，调用方应先去除首尾空白并拒绝空字符串。
- 实际最大结果数受 `web_grant.maxResultsPerCall` 限制；官方文档给出的默认授权上限是 10。
- `advanced` 需要 `web_grant.allowAdvanced`。
- 超限参数会被拒绝，不会被静默截断。
- `include_domains`、`exclude_domains` 和 `region` 已列入官方接口，但本 Demo 尚未实测其具体格式边界。不得自行添加未记录的子字段。

### 6.3 调用示例

```js
const response = await anna.web.search({
  query: "The 2026 World Cup",
  max_results: 6,
  topic: "general",
  search_depth: "basic",
});
```

### 6.4 响应

```ts
interface WebSearchResponse {
  results: WebSearchResult[];
  provider_tier: string;
  quota_consumed: number;
}

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  site: string;
  published_at?: string | null;
  score?: number | null;
}
```

处理规则：

- 始终以 `results.length` 判断实际结果数量。
- `published_at` 和 `score` 都是可选字段，必须允许缺失或 `null`。
- `provider_tier` 表示实际执行层级。请求 `advanced` 后可能降级并返回 basic 层级。
- `quota_consumed` 是本次实际 CU 消耗，仅用于展示和审计，不得用固定价格反推调用是否成功。
- 搜索摘要不是已核验事实；需要抓取原网页并进入研究整理流程。

### 6.5 当前实测

样本：[`.tmp/web_search_result_1.json`](./.tmp/web_search_result_1.json)

- 请求 6 条 basic/general 结果，实际返回 6 条。
- `provider_tier` 为 `basic`。
- `quota_consumed` 为 `6.8966`。
- 6 条结果均有 `score`。
- 6 条结果的 `published_at` 均为 `null`。

这些数值只能作为样本，不能硬编码为预期值。

## 7. `anna.web.fetch`

### 7.1 用途

抓取 1～10 个 HTTP/HTTPS URL，移除导航和广告等页面噪声，提取 Markdown 或纯文本正文。

宿主会执行强制 SSRF 防护，包括：

- 只允许 HTTP/HTTPS。
- 仅允许规定端口。
- DNS 解析后检查私有、保留和 metadata 地址。
- 每次重定向都重新验证目标。
- 最多跟随官方规定数量的重定向。

调用方不得尝试绕过这些限制。

### 7.2 请求

```ts
interface WebFetchRequest {
  urls: string[]; // 1～10 项。
  format?: "markdown" | "text";
  max_chars?: number;
  timeout_ms?: number;
}
```

### 7.3 调用示例

```js
const response = await anna.web.fetch(
  {
    urls: ["https://example.com/article"],
    format: "markdown",
    max_chars: 8000,
  },
  { timeoutMs: 90000 },
);
```

### 7.4 响应

```ts
interface WebFetchResponse {
  pages: WebFetchPage[];
  quota_consumed: number;
}

interface WebFetchPage {
  url: string;
  final_url?: string | null;
  ok: boolean;
  title?: string | null;
  content?: string | null;
  published_at?: string | null;
  truncated?: boolean | null;
  error?: string | null;
}
```

官方保证：

- `pages` 与输入 `urls` 长度相同、顺序相同。
- 单个 URL 失败不会让其他 URL 一起失败。
- 每项都必须检查 `ok`。

单项错误可能包括：

- `SSRF_BLOCKED`
- `TIMEOUT`
- `HTTP_<status>`
- `PARSE_FAILED`
- `TOO_LARGE`
- `RESPONSE_BUDGET_EXCEEDED`

处理规则：

```js
for (const page of response.pages) {
  if (!page.ok) {
    recordFetchFailure(page.url, page.error ?? "UNKNOWN_FETCH_ERROR");
    continue;
  }

  const content = page.content ?? "";
  if (page.truncated) {
    recordContentGap(page.url, "FETCH_CONTENT_TRUNCATED");
  }

  consumeRawResearchMaterial({
    requestedUrl: page.url,
    finalUrl: page.final_url ?? page.url,
    title: page.title ?? "",
    content,
  });
}
```

不要把 `content` 缺失自动解释为空网页，也不要在 `truncated: true` 时声称已获得完整页面。

### 7.5 当前实测

样本：[`.tmp/web_fetch_result_1.json`](./.tmp/web_fetch_result_1.json)

- 抓取 1 个 FIFA 页面。
- `ok` 为 `true`。
- 请求 `max_chars: 8000`，返回正文长度为 8000 字符。
- `truncated` 为 `true`，验证了正文截断语义。
- `error` 为 `null`。
- `quota_consumed` 为 `1.3793`。

当前样本没有覆盖批量部分失败。

## 8. `anna.web.image_search`

### 8.1 用途

通过宿主管理的供应商搜索图片。安全搜索由平台强制开启，调用方不能关闭。

SDK 同时接受 camelCase（驼峰命名）别名 `anna.web.imageSearch`，但本仓库示例和 manifest 使用协议方法名 `image_search`。新增代码应在同一代码域内保持命名一致。

### 8.2 请求

```ts
interface ImageSearchRequest {
  query: string;
  max_results?: number; // 默认 8，官方上限 20。
  min_width?: number;
  min_height?: number;
  aspect?: "any" | "wide" | "tall" | "square";
}
```

约束：

- `query` 必填，调用方应拒绝空字符串。
- `safe_search: false` 会被服务端拒绝；不要发送该参数。
- 需要 `web_grant.allowImageSearch`。
- 搜索结果缓存约 10 分钟。

### 8.3 调用示例

```js
const response = await anna.web.image_search({
  query: "The 2026 World Cup",
  max_results: 8,
  min_width: 1024,
  min_height: 576,
  aspect: "wide",
});
```

### 8.4 响应

```ts
interface ImageSearchResponse {
  results: ImageSearchResult[];
  quota_consumed: number;
  cached?: boolean;
}

interface ImageSearchResult {
  image_url: string;
  thumbnail_url?: string | null;
  source_url: string;
  title?: string | null;
  width?: number | null;
  height?: number | null;
  mime_type?: string | null;
  license_hint?: string | null;
}
```

处理规则：

- 图片展示可优先使用 `thumbnail_url ?? image_url`。
- 下载原图时使用 `image_url`，不要下载缩略图代替原图。
- `width`、`height`、`thumbnail_url`、`title`、`mime_type` 和 `license_hint` 均需按可选或可空字段处理。
- `cached` 也是可选字段。字段缺失不能被记录成“平台明确返回 false”。
- `source_url` 是图片来源页面，研究记录应同时保留图片 URL 和来源页 URL。
- `license_hint` 仅是尽力提供的提示，不构成版权保证。需要调用方完成使用权判断。
- 图片搜索元数据不足以判断图片是否适合 PPT。图片成为 Visual Research Evidence（视觉研究证据）前，必须经过实际图片检查和研究整理。

推荐显示缓存状态：

```js
const cacheStatus =
  response.cached === true
    ? "hit"
    : response.cached === false
      ? "miss"
      : "not_reported";
```

### 8.5 当前实测

样本：[`.tmp/image_search_result_1.json`](./.tmp/image_search_result_1.json)

- 请求并返回 8 条结果。
- `quota_consumed` 为 `0.5`。
- 8 条结果均提供缩略图和宽高。
- 8 条结果的 `mime_type` 均为 `null`。
- 8 条结果的 `license_hint` 均为 `null`。
- 顶层响应没有 `cached` 字段。

这验证了调用方不能依赖 MIME、许可提示或缓存字段一定存在。

## 9. `anna.web.image_fetch`

### 9.1 用途

让宿主下载一张远程图片，验证真实文件类型，然后把图片保存到当前 App 的 APS Files（APS 文件存储）中。

SDK 同时接受别名 `anna.web.imageFetch`。本仓库示例使用 `anna.web.image_fetch`。

### 9.2 请求

```ts
interface ImageFetchRequest {
  url: string;
  max_bytes?: number; // 默认 5 MiB，官方上限 20 MiB。
  purpose?: string;
}
```

约束：

- 需要 `web_grant.allowImageFetch`。
- 只允许 JPEG、PNG、WebP 和 GIF。
- 宿主通过 magic bytes（文件魔数）验证真实类型，不信任远端 `Content-Type`。
- 下载执行与 `web.fetch` 相同的 SSRF 和重定向安全检查。
- 保存后的文件占用用户 APS 存储配额。
- 下载失败不应产生本次图片下载 CU 费用；调用方仍应以实际 `quota_consumed` 和平台账单为准。

### 9.3 调用示例

```js
const artifact = await anna.web.image_fetch(
  {
    url: selectedImage.image_url,
    purpose: "ppt-research",
  },
  { timeoutMs: 90000 },
);
```

### 9.4 响应

```ts
interface ImageFetchResponse {
  path: string;
  get_url: string;
  mime_type: string;
  bytes_size: number;
  sha256: string;
  source_url: string;
  final_url: string;
  quota_consumed: number;
}
```

字段语义：

- `path`：APS 中的文件路径，适合作为 App 内的持久化引用。
- `get_url`：约 30 分钟有效的预签名下载 URL，只适合短期预览或下载。
- `mime_type`：宿主验证后的图片 MIME。
- `bytes_size`：实际保存的字节数。
- `sha256`：内容摘要，可用于去重、完整性检查和审计。
- `source_url`：调用方请求的原始 URL。
- `final_url`：重定向完成后的实际下载 URL。
- `quota_consumed`：本次实际 CU 消耗。

持久化时推荐保存：

```js
const persistedArtifact = {
  path: artifact.path,
  mime_type: artifact.mime_type,
  bytes_size: artifact.bytes_size,
  sha256: artifact.sha256,
  source_url: artifact.source_url,
  final_url: artifact.final_url,
};
```

不要把 `get_url` 当成永久 URL 写入长期工件。URL 过期后，应通过 `anna.files.download_url` 为 `path` 重新生成下载地址。

### 9.5 当前实测

样本：[`.tmp/image_fetch_result_1.json`](./.tmp/image_fetch_result_1.json)

- 返回 `image/jpeg`。
- 文件大小为 193869 字节。
- 返回了 APS `path`、SHA-256 和带查询参数的预签名 `get_url`。
- `source_url` 与 `final_url` 相同，本样本未覆盖重定向。
- `quota_consumed` 为 `1`。

测试文件中的 `get_url` 是短时效地址，不应把其当前是否还能访问作为回归判断条件。

## 10. 配额、供应商和缓存

官方当前说明：

- 所有调用计入用户统一的 Anna CU 池。
- `web.search` 按调用计费。
- `web.fetch` 按 URL 计费。
- `image_search` 按调用计费；缓存命中仍可能收取最低 CU。
- `image_fetch` 按图片计费。
- 供应商链全部失败或图片下载失败时不计费。
- `search_depth: "advanced"` 可能降级到更便宜的 basic 层级，响应通过 `provider_tier` 报告实际层级。

Agent 不得：

- 根据请求参数猜测最终供应商。
- 根据 `search_depth` 猜测最终 CU。
- 把本文或测试样本中的 CU 数值作为固定价格。
- 以缓存命中为前提设计正确性逻辑。

## 11. 数据生命周期与研究证据边界

在本仓库的 PPT 生成领域模型中：

```text
web.search / web.fetch / image_search
              │
              ▼
Raw Research Material（原始研究材料）
              │
              ▼
Research Curation（研究整理与筛选）
              │
              ▼
Research Evidence（研究证据）
              │
              ▼
Page Evidence Assignment（页面证据分配）
              │
              ▼
Page Authoring（页面创作）
```

强制边界：

- 搜索摘要不是事实来源。
- 网页正文也不能未经筛选直接注入 Page Authoring。
- 图片中的文字、图表或数字不能自动成为事实证据。
- 图片只有经过视觉检查、适用性判断和页面分配后，才可以成为 Visual Research Evidence。
- `image_fetch` 只解决安全下载和存储问题，不完成图片版权、真实性或页面适配判断。
- 出现 Research Evidence Gap（研究证据缺口）时，应省略、概括或标记 `TBD / 待补充`，不得编造细节。

## 12. 当前已验证与未验证矩阵

| 接口行为 | 当前状态 | 证据 |
|---|---|---|
| Web basic/general 搜索成功 | 已验证 | `web_search_result_1.json` |
| 搜索结果 `published_at: null` | 已验证 | `web_search_result_1.json` |
| 抓取成功并达到 `max_chars` 后截断 | 已验证 | `web_fetch_result_1.json` |
| 图片搜索成功 | 已验证 | `image_search_result_1.json` |
| 图片元数据可为 `null` | 已验证 | `image_search_result_1.json` |
| 图片保存为 APS 工件引用 | 已验证 | `image_fetch_result_1.json` |
| `APP_NOT_GRANTED` 错误结构 | 未验证 | 需要生产首次授权测试 |
| `APP_INVALID_REQUEST` 错误结构 | 未验证 | 需要非法参数测试 |
| Web advanced 搜索与降级 | 未验证 | 需要 advanced 测试 |
| news、时间范围、地区和域名过滤 | 未验证 | 需要选项测试 |
| Fetch 批量部分失败和顺序保持 | 未验证 | 需要混合 URL 测试 |
| Fetch `format: "text"` | 未验证 | 需要纯文本测试 |
| 图片搜索 `cached: true` | 未验证 | 需要短时间重复请求 |
| 图片下载非图片、超限和重定向 | 未验证 | 需要失败与重定向测试 |
| 配额不足和限流错误 | 未验证 | 需要平台环境测试 |

Agent 在依赖“未验证”行为前，应查阅最新官方文档并补充真实测试，不得根据命名猜测。

## 13. 后续测试结果的保存要求

新增测试样本时，至少保存：

```json
{
  "测试环境": "Anna staging / production-like",
  "测试时间": "ISO-8601",
  "接口": "anna.web.fetch",
  "请求参数": {},
  "响应": {},
  "错误": null,
  "耗时毫秒": 0,
  "备注": "说明授权状态、是否开发环境、预期场景"
}
```

保存前必须处理：

- 对仍然有效的 `get_url` 等预签名 URL 进行脱敏，或等待其失效。
- 不记录用户 token、窗口 token、授权凭据或 Cookie。
- 保留错误码、错误消息和不含敏感信息的 details/data。
- 区分“顶层调用失败”和“顶层成功但某一项失败”。
- 记录 manifest 版本、App 版本和官方文档核对日期，方便判断协议是否变化。

本目录 `.tmp/` 已被仓库 `.gitignore` 忽略。若测试样本需要成为长期回归资料，应先脱敏，再移动到明确的 fixtures（测试样本）目录，并由维护者确认是否提交。

## 14. Agent 实现检查清单

提交任何 `web.*` 集成前，逐项确认：

- [ ] 只声明实际使用的 `ui.host_api.web` 权限。
- [ ] 能处理 `APP_NOT_GRANTED`，没有无限自动重试。
- [ ] 请求参数使用官方字段名，没有自造参数。
- [ ] 没有硬编码供应商、CU 或 `provider_tier`。
- [ ] 所有可选字段都兼容缺失和 `null`。
- [ ] `web.fetch` 逐项检查 `ok`，并处理 `truncated`。
- [ ] 批量抓取按输入顺序关联结果，没有按 URL 重新猜测匹配。
- [ ] 图片搜索没有尝试关闭安全搜索。
- [ ] 没有把 `license_hint` 当成版权授权。
- [ ] `image_fetch` 持久化 `path`，没有长期依赖 `get_url`。
- [ ] 日志没有泄露仍有效的预签名 URL 或认证信息。
- [ ] 搜索结果先进入 Raw Research Material 和 Research Curation，而不是直接成为页面事实。
- [ ] 未验证行为有官方文档或新增实测支撑。

