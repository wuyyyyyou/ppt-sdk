import { AnnaAppRuntime } from "/static/anna-apps/_sdk/latest/index.js";

const I18N = {
  zh: {
    title: "Web 与图片搜索 Demo",
    subtitle: "从 Anna App 前端直接测试官方 Web 搜索、网页抓取、图片搜索和 APS 图片下载，不经过 Executa。",
    language: "语言",
    connecting: "正在连接 Anna Runtime…",
    connected: "Anna Runtime 已连接",
    connectionFailed: "Anna Runtime 连接失败",
    webSearchTitle: "Web 搜索与正文抓取",
    webSearchHelp: "搜索结果可单独抓取正文，也可以批量抓取当前前五条结果。",
    query: "搜索词",
    maxResults: "结果数量",
    topic: "主题",
    general: "综合",
    news: "新闻",
    timeRange: "时间范围",
    unlimited: "不限",
    day: "一天",
    week: "一周",
    month: "一月",
    year: "一年",
    searchDepth: "搜索深度",
    basic: "基础",
    advanced: "高级",
    search: "开始搜索",
    fetchTop: "抓取前五条",
    webEmpty: "搜索结果会显示在这里。",
    fetchPage: "抓取正文",
    imageSearchTitle: "图片搜索与 APS 下载",
    imageSearchHelp: "图片下载由宿主执行，并返回 APS path 与短时效 get_url，而不是图片字节。",
    imageQuery: "图片搜索词",
    minWidth: "最小宽度",
    minHeight: "最小高度",
    aspect: "宽高比",
    any: "不限",
    wide: "宽屏",
    tall: "竖版",
    square: "方形",
    searchImages: "搜索图片",
    imageEmpty: "图片结果会显示在这里。",
    downloadImage: "下载到 APS",
    diagnosticsTitle: "调用诊断",
    diagnosticsHelp: "这里保留每次调用的参数、原始返回值、错误和耗时，方便对照官方协议。",
    clearLogs: "清空日志",
    logEmpty: "尚未发起调用。",
    searching: "搜索中…",
    fetching: "抓取中…",
    downloading: "下载中…",
    results: "结果",
    tier: "实际层级",
    quota: "CU 消耗",
    elapsed: "耗时",
    cached: "缓存",
    yes: "是",
    no: "否",
    success: "成功",
    failed: "失败",
    pageFailed: "页面抓取失败",
    noResults: "没有搜索结果。",
    source: "来源",
    dimensions: "尺寸",
    license: "许可提示",
    unavailable: "未提供",
    truncated: "内容已截断",
    rawResponse: "原始响应",
    request: "请求参数",
    response: "响应",
    error: "错误",
    apsArtifact: "APS 图片工件",
    openImage: "打开图片",
  },
  en: {
    title: "Web & Image Search Demo",
    subtitle: "Test Anna's official web search, page fetch, image search, and APS image download APIs directly from the App frontend without an Executa.",
    language: "Language",
    connecting: "Connecting to Anna Runtime…",
    connected: "Anna Runtime connected",
    connectionFailed: "Anna Runtime connection failed",
    webSearchTitle: "Web search and page fetch",
    webSearchHelp: "Fetch an individual result or batch-fetch the first five current results.",
    query: "Query",
    maxResults: "Max results",
    topic: "Topic",
    general: "General",
    news: "News",
    timeRange: "Time range",
    unlimited: "Any time",
    day: "Day",
    week: "Week",
    month: "Month",
    year: "Year",
    searchDepth: "Search depth",
    basic: "Basic",
    advanced: "Advanced",
    search: "Search",
    fetchTop: "Fetch top five",
    webEmpty: "Search results will appear here.",
    fetchPage: "Fetch page",
    imageSearchTitle: "Image search and APS download",
    imageSearchHelp: "The host downloads images and returns an APS path plus a short-lived get_url, never image bytes.",
    imageQuery: "Image query",
    minWidth: "Min width",
    minHeight: "Min height",
    aspect: "Aspect",
    any: "Any",
    wide: "Wide",
    tall: "Tall",
    square: "Square",
    searchImages: "Search images",
    imageEmpty: "Image results will appear here.",
    downloadImage: "Download to APS",
    diagnosticsTitle: "Call diagnostics",
    diagnosticsHelp: "Every call keeps its parameters, raw response, error, and duration for protocol inspection.",
    clearLogs: "Clear logs",
    logEmpty: "No calls yet.",
    searching: "Searching…",
    fetching: "Fetching…",
    downloading: "Downloading…",
    results: "Results",
    tier: "Provider tier",
    quota: "CU consumed",
    elapsed: "Elapsed",
    cached: "Cached",
    yes: "Yes",
    no: "No",
    success: "Success",
    failed: "Failed",
    pageFailed: "Page fetch failed",
    noResults: "No results.",
    source: "Source",
    dimensions: "Dimensions",
    license: "License hint",
    unavailable: "Unavailable",
    truncated: "Content truncated",
    rawResponse: "Raw response",
    request: "Request",
    response: "Response",
    error: "Error",
    apsArtifact: "APS image artifact",
    openImage: "Open image",
  },
};

const state = {
  anna: null,
  locale: navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en",
  webResults: [],
  logs: [],
};

const $ = (id) => document.getElementById(id);
const t = (key) => I18N[state.locale][key] || I18N.en[key] || key;

function applyLocale() {
  document.documentElement.lang = state.locale === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  $("language-select").value = state.locale;
  if (state.webResults.length) renderWebResults(state.webResults);
  renderLogs();
}

function setRuntimeStatus(kind, text) {
  const status = $("runtime-status");
  status.className = `status ${kind}`;
  status.textContent = text;
}

function setButtonBusy(button, busy, busyTextKey, idleTextKey) {
  button.disabled = busy;
  button.textContent = t(busy ? busyTextKey : idleTextKey);
}

function errorPayload(error) {
  if (error && typeof error === "object") {
    return {
      name: error.name,
      code: error.code ?? error.error?.code,
      message: error.message ?? error.error?.message ?? String(error),
      data: error.data ?? error.error?.data,
    };
  }
  return { message: String(error) };
}

async function timedCall(method, params, operation) {
  const startedAt = performance.now();
  try {
    const result = await operation();
    const elapsedMs = Math.round(performance.now() - startedAt);
    addLog({ method, params, result, elapsedMs, ok: true });
    return { result, elapsedMs };
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startedAt);
    const normalized = errorPayload(error);
    addLog({ method, params, error: normalized, elapsedMs, ok: false });
    throw error;
  }
}

function addLog(entry) {
  state.logs.unshift({ timestamp: new Date().toISOString(), ...entry });
  renderLogs();
}

function renderLogs() {
  const container = $("log-list");
  container.replaceChildren();
  if (!state.logs.length) {
    container.className = "log-list empty-state";
    const empty = document.createElement("p");
    empty.textContent = t("logEmpty");
    container.appendChild(empty);
    return;
  }
  container.className = "log-list";
  for (const entry of state.logs) {
    const details = document.createElement("details");
    details.className = `log-entry ${entry.ok ? "ok" : "error"}`;
    const summary = document.createElement("summary");
    const resultLabel = entry.ok ? t("success") : t("failed");
    summary.textContent = `${entry.method} · ${resultLabel} · ${entry.elapsedMs} ms · ${new Date(entry.timestamp).toLocaleTimeString()}`;
    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify({
      [t("request")]: entry.params,
      [entry.ok ? t("response") : t("error")]: entry.ok ? entry.result : entry.error,
    }, null, 2);
    details.append(summary, pre);
    container.appendChild(details);
  }
}

function renderMetrics(containerId, metrics) {
  const container = $(containerId);
  container.replaceChildren();
  for (const [label, value] of metrics) {
    const node = $("metric-template").content.firstElementChild.cloneNode(true);
    node.querySelector("span").textContent = label;
    node.querySelector("strong").textContent = String(value);
    container.appendChild(node);
  }
}

function createExternalLink(url, label) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label || url;
  return link;
}

function renderWebResults(results) {
  const list = $("web-results");
  list.replaceChildren();
  if (!results.length) {
    list.className = "result-list empty-state";
    const item = document.createElement("li");
    item.textContent = t("noResults");
    list.appendChild(item);
    return;
  }
  list.className = "result-list";
  results.forEach((result, index) => {
    const item = document.createElement("li");
    item.className = "result-card";
    const content = document.createElement("div");
    const title = createExternalLink(result.url, result.title || result.url);
    title.className = "result-title";
    const meta = document.createElement("p");
    meta.className = "result-meta";
    meta.textContent = [result.site, result.published_at, result.score != null ? `score ${result.score}` : ""]
      .filter(Boolean)
      .join(" · ");
    const snippet = document.createElement("p");
    snippet.textContent = result.snippet || "";
    content.append(title, meta, snippet);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = t("fetchPage");
    button.addEventListener("click", () => fetchPages([result.url], button));
    item.append(content, button);
    item.dataset.index = String(index);
    list.appendChild(item);
  });
}

function renderFetchedPages(payload, elapsedMs) {
  const container = $("fetch-output");
  container.replaceChildren();
  container.className = "fetch-output";

  const heading = document.createElement("div");
  heading.className = "fetch-heading";
  heading.textContent = `${t("elapsed")}: ${elapsedMs} ms · ${t("quota")}: ${payload.quota_consumed ?? 0}`;
  container.appendChild(heading);

  for (const page of payload.pages || []) {
    const article = document.createElement("article");
    article.className = `fetched-page ${page.ok ? "ok" : "error"}`;
    const title = document.createElement("h3");
    title.textContent = page.title || page.final_url || page.url;
    const url = createExternalLink(page.final_url || page.url, page.final_url || page.url);
    url.className = "source-link";
    article.append(title, url);
    if (page.ok) {
      if (page.truncated) {
        const warning = document.createElement("p");
        warning.className = "warning";
        warning.textContent = t("truncated");
        article.appendChild(warning);
      }
      const pre = document.createElement("pre");
      pre.textContent = page.content || "";
      article.appendChild(pre);
    } else {
      const error = document.createElement("p");
      error.className = "error-text";
      error.textContent = `${t("pageFailed")}: ${page.error || t("unavailable")}`;
      article.appendChild(error);
    }
    container.appendChild(article);
  }
}

async function fetchPages(urls, button) {
  if (!state.anna || !urls.length) return;
  const originalText = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = t("fetching");
  }
  const params = { urls, format: "markdown", max_chars: 8000 };
  try {
    const { result, elapsedMs } = await timedCall("anna.web.fetch", params, () =>
      state.anna.web.fetch(params, { timeoutMs: 90000 }),
    );
    renderFetchedPages(result, elapsedMs);
  } catch (error) {
    renderCallError("fetch-output", error);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function renderCallError(containerId, error) {
  const container = $(containerId);
  container.replaceChildren();
  container.className = containerId === "image-artifact" ? "artifact-panel error" : "fetch-output error";
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(errorPayload(error), null, 2);
  container.appendChild(pre);
}

async function handleWebSearch(event) {
  event.preventDefault();
  if (!state.anna) return;
  const button = $("web-search-button");
  setButtonBusy(button, true, "searching", "search");
  const params = {
    query: $("web-query").value.trim(),
    max_results: Number($("web-max-results").value),
    topic: $("web-topic").value,
    search_depth: $("web-search-depth").value,
  };
  const timeRange = $("web-time-range").value;
  if (timeRange) params.time_range = timeRange;
  try {
    const { result, elapsedMs } = await timedCall("anna.web.search", params, () => state.anna.web.search(params));
    state.webResults = result.results || [];
    renderWebResults(state.webResults);
    renderMetrics("web-metrics", [
      [t("results"), state.webResults.length],
      [t("tier"), result.provider_tier ?? t("unavailable")],
      [t("quota"), result.quota_consumed ?? 0],
      [t("elapsed"), `${elapsedMs} ms`],
    ]);
    $("fetch-top-button").disabled = state.webResults.length === 0;
  } catch (error) {
    state.webResults = [];
    renderWebResults([]);
    renderCallError("fetch-output", error);
    $("fetch-top-button").disabled = true;
  } finally {
    setButtonBusy(button, false, "searching", "search");
  }
}

function renderImageResults(results) {
  const grid = $("image-results");
  grid.replaceChildren();
  if (!results.length) {
    grid.className = "image-grid empty-state";
    const empty = document.createElement("p");
    empty.textContent = t("noResults");
    grid.appendChild(empty);
    return;
  }
  grid.className = "image-grid";
  for (const result of results) {
    const figure = document.createElement("figure");
    figure.className = "image-card";
    const image = document.createElement("img");
    image.src = result.thumbnail_url || result.image_url;
    image.alt = result.title || result.image_url;
    image.loading = "lazy";
    const caption = document.createElement("figcaption");
    const title = createExternalLink(result.source_url, result.title || result.source_url);
    title.className = "image-title";
    const metadata = document.createElement("dl");
    const values = [
      [t("dimensions"), result.width && result.height ? `${result.width} × ${result.height}` : t("unavailable")],
      [t("license"), result.license_hint || t("unavailable")],
    ];
    for (const [label, value] of values) {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      metadata.append(dt, dd);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = t("downloadImage");
    button.addEventListener("click", () => downloadImage(result.image_url, button));
    caption.append(title, metadata, button);
    figure.append(image, caption);
    grid.appendChild(figure);
  }
}

async function handleImageSearch(event) {
  event.preventDefault();
  if (!state.anna) return;
  const button = $("image-search-button");
  setButtonBusy(button, true, "searching", "searchImages");
  const params = {
    query: $("image-query").value.trim(),
    max_results: Number($("image-max-results").value),
    min_width: Number($("image-min-width").value),
    min_height: Number($("image-min-height").value),
    aspect: $("image-aspect").value,
  };
  try {
    const { result, elapsedMs } = await timedCall("anna.web.image_search", params, () =>
      state.anna.web.image_search(params),
    );
    renderImageResults(result.results || []);
    renderMetrics("image-metrics", [
      [t("results"), (result.results || []).length],
      [t("quota"), result.quota_consumed ?? 0],
      [t("cached"), result.cached ? t("yes") : t("no")],
      [t("elapsed"), `${elapsedMs} ms`],
    ]);
  } catch (error) {
    renderImageResults([]);
    renderCallError("image-artifact", error);
  } finally {
    setButtonBusy(button, false, "searching", "searchImages");
  }
}

async function downloadImage(url, button) {
  if (!state.anna) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = t("downloading");
  const params = { url, purpose: "ppt-sdk-web-search-demo" };
  try {
    const { result, elapsedMs } = await timedCall("anna.web.image_fetch", params, () =>
      state.anna.web.image_fetch(params, { timeoutMs: 90000 }),
    );
    const container = $("image-artifact");
    container.replaceChildren();
    container.className = "artifact-panel";
    const preview = document.createElement("img");
    preview.src = result.get_url;
    preview.alt = result.path || t("apsArtifact");
    const content = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = t("apsArtifact");
    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify({ ...result, elapsed_ms: elapsedMs }, null, 2);
    const link = createExternalLink(result.get_url, t("openImage"));
    link.className = "button-link";
    content.append(title, pre, link);
    container.append(preview, content);
  } catch (error) {
    renderCallError("image-artifact", error);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function connectRuntime() {
  try {
    state.anna = await AnnaAppRuntime.connect();
    if (!state.anna.web) throw new Error("Anna Runtime does not expose the web namespace.");
    setRuntimeStatus("ok", t("connected"));
    state.anna.window?.set_title?.({ title: t("title") }).catch(() => {});
  } catch (error) {
    setRuntimeStatus("error", `${t("connectionFailed")}: ${errorPayload(error).message}`);
    addLog({ method: "AnnaAppRuntime.connect", params: {}, error: errorPayload(error), elapsedMs: 0, ok: false });
  }
}

$("language-select").addEventListener("change", (event) => {
  state.locale = event.target.value;
  applyLocale();
  state.anna?.window?.set_title?.({ title: t("title") }).catch(() => {});
});
$("web-search-form").addEventListener("submit", handleWebSearch);
$("image-search-form").addEventListener("submit", handleImageSearch);
$("fetch-top-button").addEventListener("click", () => {
  const urls = state.webResults.map((item) => item.url).filter(Boolean).slice(0, 5);
  fetchPages(urls, $("fetch-top-button"));
});
$("clear-log-button").addEventListener("click", () => {
  state.logs = [];
  renderLogs();
});

applyLocale();
connectRuntime();
