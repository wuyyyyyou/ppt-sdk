import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Moveable from "react-moveable";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUp,
  ArrowUpToLine,
  Bold,
  ImagePlus,
  Italic,
  Layers,
  LoaderCircle,
  MoreHorizontal,
  PaintBucket,
  PanelLeftClose,
  PanelLeftOpen,
  Pilcrow,
  Redo2,
  RotateCcw,
  Save,
  Shapes,
  SlidersHorizontal,
  Square,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { createPptBackend, type PptBackend } from "../../api/pptBackend";
import type {
  GetPageEditContextResult,
  RestorePageSourceVersionResult,
  SaveManualPageRevisionResult,
} from "../../api/types";
import { createAppHostUploadClient, type AppHostUploadClient } from "../../runtime/appHostUploadClient";
import { connectAnnaRuntime } from "../../runtime/annaRuntime";
import {
  MOVEABLE_EDITOR_CLASS,
  canvasDistance,
  exceedsDragThreshold,
  isMoveableEditorTarget,
} from "./manualPageEditorInteractions";
import "./manual-page-editor.css";

const FONT_FAMILIES = [
  "Arial",
  "Helvetica",
  "Times New Roman",
  "PingFang SC",
  "Microsoft YaHei",
  "Noto Sans SC",
  "SimSun",
];
const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 72, 88];
const MAX_HISTORY = 50;

export interface ManualPageEditorPage {
  pageId: string;
  title: string;
  screenshotUrl?: string;
}

interface Props {
  workspaceDir: string;
  pages: ManualPageEditorPage[];
  initialPageIndex: number;
  onPageUpdated: (result: SaveManualPageRevisionResult | RestorePageSourceVersionResult) => void;
  onExit: (requiresDeckRender: boolean) => Promise<void> | void;
}

type SaveStatus = "saved" | "unsaved" | "saving" | "conflict" | "error";
type ToolbarPopover = "paragraph" | "fill" | "border" | "opacity" | "more" | null;

function editableTarget(target: EventTarget | null): target is HTMLElement {
  const element = target && typeof (target as HTMLElement).closest === "function" ? target as HTMLElement : null;
  return Boolean(element?.closest("input,textarea,select,[contenteditable='true']"));
}

function selectionTarget(target: EventTarget | null, shell: HTMLElement): HTMLElement | null {
  let element = target && typeof (target as HTMLElement).closest === "function" ? target as HTMLElement : null;
  const inlineTags = new Set(["SPAN", "STRONG", "EM", "B", "I", "U", "S", "BR", "SMALL"]);
  while (element && element !== shell) {
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (
      !element.dataset.pptEditorPlaceholder && !element.dataset.pptEditorDeleted &&
      style?.display !== "none" && style?.visibility !== "hidden" && rect.width > 0 && rect.height > 0 &&
      !inlineTags.has(element.tagName)
    ) return element;
    element = element.parentElement;
  }
  return null;
}

function serializeDocument(doc: Document): string {
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

function makeId(): string {
  return `ppt-editor-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

function primaryFontFamily(value: string | undefined): string {
  return value?.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

function colorInputValue(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return fallback;
  return `#${rgb.slice(1, 4).map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0")).join("")}`;
}

function promoteToAbsolute(element: HTMLElement): void {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (style?.position === "absolute") return;
  const parent = element.parentElement;
  if (!parent) return;
  const rect = element.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  const placeholder = element.ownerDocument.createElement("div");
  placeholder.dataset.pptEditorPlaceholder = "true";
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.style.width = `${rect.width}px`;
  placeholder.style.height = `${rect.height}px`;
  placeholder.style.visibility = "hidden";
  placeholder.style.pointerEvents = "none";
  placeholder.style.flex = style?.flex ?? "0 0 auto";
  if (style?.gridArea) placeholder.style.gridArea = style.gridArea;
  parent.insertBefore(placeholder, element);
  if (style?.position === "static" && element.ownerDocument.defaultView?.getComputedStyle(parent).position === "static") {
    parent.style.position = "relative";
  }
  Object.assign(element.style, {
    position: "absolute",
    left: `${rect.left - parentRect.left + parent.scrollLeft}px`,
    top: `${rect.top - parentRect.top + parent.scrollTop}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
  });
}

export function ManualPageEditorShell(props: Props) {
  const [backend, setBackend] = useState<PptBackend | null>(null);
  const [uploadClient, setUploadClient] = useState<AppHostUploadClient | null>(null);
  const [pageIndex, setPageIndex] = useState(Math.min(props.initialPageIndex, Math.max(0, props.pages.length - 1)));
  const [context, setContext] = useState<GetPageEditContextResult | null>(null);
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  const [iframeDocument, setIframeDocument] = useState<Document | null>(null);
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const [fitScale, setFitScale] = useState(0.75);
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<null | { kind: "exit" | "switch" | "restore"; target?: number }>(null);
  const [imageMode, setImageMode] = useState<"add" | "replace">("add");
  const [filmstripCollapsed, setFilmstripCollapsed] = useState(false);
  const [toolbarPopover, setToolbarPopover] = useState<ToolbarPopover>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const textEditBeforeRef = useRef<string | null>(null);
  const selectionRangeRef = useRef<Range | null>(null);
  const iframeCleanupRef = useRef<(() => void) | null>(null);
  const deckRenderRequiredRef = useRef(false);
  const dragGestureRef = useRef<{
    before: string;
    startLeft: number;
    startTop: number;
    moved: boolean;
  } | null>(null);
  const resizeGestureRef = useRef<{
    before: string;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
    moved: boolean;
  } | null>(null);

  const recordDeckRenderRequirement = useCallback((required: boolean) => {
    if (!required) return;
    deckRenderRequiredRef.current = true;
  }, []);

  const page = props.pages[pageIndex];
  const dirty = saveStatus === "unsaved" || saveStatus === "error" || saveStatus === "conflict";

  useEffect(() => {
    let cancelled = false;
    void Promise.all([createPptBackend(), connectAnnaRuntime()]).then(([nextBackend, runtime]) => {
      if (cancelled) return;
      setBackend(nextBackend);
      setUploadClient(createAppHostUploadClient(runtime));
    }).catch((value) => setError(value instanceof Error ? value.message : String(value)));
    return () => { cancelled = true; };
  }, []);

  const loadPage = useCallback(async (index: number) => {
    const target = props.pages[index];
    if (!backend || !target) return;
    setLoading(true);
    setError("");
    setSelected(null);
    iframeCleanupRef.current?.();
    iframeCleanupRef.current = null;
    setIframeDocument(null);
    try {
      const nextContext = await backend.getPageEditContext({ workspace_dir: props.workspaceDir, page_id: target.pageId });
      const response = await fetch(nextContext.html_upload.url, { cache: "no-store" });
      if (!response.ok) throw new Error(`加载页面 HTML 失败：HTTP ${response.status}`);
      setContext(nextContext);
      setHtml(await response.text());
      setPageIndex(index);
      setSaveStatus("saved");
      setHistory([]);
      setFuture([]);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setLoading(false);
    }
  }, [backend, props.pages, props.workspaceDir]);

  useEffect(() => { if (backend) void loadPage(pageIndex); }, [backend]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => iframeCleanupRef.current?.(), []);

  useEffect(() => {
    if (!toolbarPopover) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && toolbarRef.current?.contains(event.target)) return;
      setToolbarPopover(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [toolbarPopover]);

  useEffect(() => {
    const area = canvasAreaRef.current;
    if (!area) return;
    const update = () => setFitScale(Math.max(0.1, Math.min((area.clientWidth - 80) / 1280, (area.clientHeight - 100) / 720)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  const currentHtml = useCallback(() => iframeDocument ? serializeDocument(iframeDocument) : html, [html, iframeDocument]);

  const markMutation = useCallback((before?: string) => {
    const previous = before ?? currentHtml();
    setHistory((items) => [...items, previous].slice(-MAX_HISTORY));
    setFuture([]);
    setSaveStatus("unsaved");
  }, [currentHtml]);

  const applySnapshot = useCallback((snapshot: string) => {
    setSelected(null);
    setIframeDocument(null);
    setHtml(snapshot);
    setSaveStatus("unsaved");
  }, []);

  const undo = useCallback(() => {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((items) => [currentHtml(), ...items].slice(0, MAX_HISTORY));
    setHistory((items) => items.slice(0, -1));
    applySnapshot(previous);
  }, [applySnapshot, currentHtml, history]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next) return;
    setHistory((items) => [...items, currentHtml()].slice(-MAX_HISTORY));
    setFuture((items) => items.slice(1));
    applySnapshot(next);
  }, [applySnapshot, currentHtml, future]);

  const save = useCallback(async () => {
    if (!backend || !uploadClient || !context || !page) return false;
    const value = currentHtml();
    const file = new File([value], `${page.pageId}.html`, { type: "text/plain" });
    if (file.size > 64 * 1024 * 1024) {
      setError("当前页面 HTML 超过 64 MiB，无法保存。");
      setSaveStatus("error");
      return false;
    }
    setSaveStatus("saving");
    setError("");
    try {
      const hostUpload = await uploadClient.uploadFile(file, {
        purpose: "user_artifact",
        filename: file.name,
        mimeType: "text/plain",
        metadata: { workspace_dir: props.workspaceDir, source: "manual-page-editor" },
      });
      const result = await backend.saveManualPageRevision({
        workspace_dir: props.workspaceDir,
        page_id: page.pageId,
        base_revision: context.revision,
        size_bytes: file.size,
        host_upload: hostUpload,
      });
      setContext({
        ...context,
        revision: result.manifest.revision,
        manually_edited: true,
        manifest: result.manifest,
        screenshot_path: result.manifest.screenshot_path,
        screenshot_upload: result.screenshot_upload,
      });
      setHtml(value);
      setHistory([]);
      setFuture([]);
      setSaveStatus("saved");
      recordDeckRenderRequirement(result.final_deck_render_requires_rebuild);
      props.onPageUpdated(result);
      return true;
    } catch (value) {
      const message = value instanceof Error ? value.message : String(value);
      setError(message);
      setSaveStatus(/revision conflict/i.test(message) ? "conflict" : "error");
      return false;
    }
  }, [backend, context, currentHtml, page, props.onPageUpdated, props.workspaceDir, recordDeckRenderRequirement, uploadClient]);

  const restore = useCallback(async () => {
    if (!backend || !page) return;
    setLoading(true);
    try {
      const result = await backend.restorePageSourceVersion({ workspace_dir: props.workspaceDir, page_id: page.pageId });
      recordDeckRenderRequirement(result.final_deck_render_requires_rebuild);
      props.onPageUpdated(result);
      await loadPage(pageIndex);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setLoading(false);
    }
  }, [backend, loadPage, page, pageIndex, props.onPageUpdated, props.workspaceDir, recordDeckRenderRequirement]);

  const requestSwitch = (index: number) => {
    if (index === pageIndex) return;
    if (dirty) setConfirm({ kind: "switch", target: index });
    else void loadPage(index);
  };

  const requestExit = () => dirty ? setConfirm({ kind: "exit" }) : void props.onExit(deckRenderRequiredRef.current);

  const resolveConfirm = async (action: "save" | "discard" | "cancel" | "restore") => {
    const request = confirm;
    if (!request || action === "cancel") { setConfirm(null); return; }
    if (request.kind === "restore" && action === "restore") {
      setConfirm(null);
      await restore();
      return;
    }
    if (action === "save" && !(await save())) return;
    setConfirm(null);
    if (request.kind === "switch" && request.target !== undefined) await loadPage(request.target);
    if (request.kind === "exit") await props.onExit(deckRenderRequiredRef.current);
  };

  const selectParent = () => {
    const shell = iframeDocument?.querySelector<HTMLElement>('[data-presenton-slide-shell="true"]');
    const parent = selected?.parentElement;
    if (parent && shell && parent !== shell && shell.contains(parent)) {
      setSelected(parent);
      setToolbarPopover(null);
    }
  };

  const patchSelected = (patch: (element: HTMLElement) => void) => {
    if (!selected) return;
    markMutation();
    patch(selected);
    setSelected(selected);
  };

  const applyTextStyle = (property: keyof CSSStyleDeclaration, value: string) => {
    if (!selected) return;
    const range = selectionRangeRef.current;
    if (range && !range.collapsed && selected.contains(range.commonAncestorContainer)) {
      markMutation();
      const span = iframeDocument!.createElement("span");
      (span.style as unknown as Record<string, string>)[property as string] = value;
      span.append(range.extractContents());
      range.insertNode(span);
      selectionRangeRef.current = null;
      return;
    }
    patchSelected((element) => { (element.style as unknown as Record<string, string>)[property as string] = value; });
  };

  const arrange = (action: "front" | "forward" | "backward" | "back") => {
    if (!selected?.parentElement) return;
    const siblings = Array.from(selected.parentElement.children)
      .filter((item): item is HTMLElement => "style" in item && !((item as HTMLElement).dataset.pptEditorPlaceholder) && !((item as HTMLElement).dataset.pptEditorDeleted));
    const ordered = siblings.map((item, index) => ({ item, z: Number.parseInt(item.ownerDocument.defaultView?.getComputedStyle(item).zIndex || String(index), 10) || index }))
      .sort((left, right) => left.z - right.z);
    const current = ordered.findIndex((item) => item.item === selected);
    if (current < 0) return;
    const target = action === "front" ? ordered.length - 1
      : action === "back" ? 0
        : action === "forward" ? Math.min(ordered.length - 1, current + 1)
          : Math.max(0, current - 1);
    const [entry] = ordered.splice(current, 1);
    ordered.splice(target, 0, entry!);
    markMutation();
    ordered.forEach(({ item }, index) => { item.style.zIndex = String(index + 1); });
  };

  const addElement = (kind: "text" | "shape") => {
    const shell = iframeDocument?.querySelector<HTMLElement>('[data-presenton-slide-shell="true"]');
    if (!shell) return;
    markMutation();
    const element = iframeDocument!.createElement("div");
    element.dataset.pptEditorCreated = "true";
    element.dataset.pptEditorId = makeId();
    element.style.position = "absolute";
    element.style.zIndex = "999";
    if (kind === "text") {
      Object.assign(element.style, { left: "430px", top: "328px", width: "420px", height: "64px", fontSize: "24px", fontFamily: "Arial", color: "#111827", overflow: "hidden" });
      element.textContent = "双击输入文字";
    } else {
      Object.assign(element.style, { left: "500px", top: "290px", width: "280px", height: "140px", background: "#ddd6fe", borderRadius: "16px" });
    }
    shell.append(element);
    setSelected(element);
  };

  const handleImage = async (file: File) => {
    if (!/image\/(png|jpeg|webp)/.test(file.type) || file.size > 20 * 1024 * 1024) {
      setError("仅支持不超过 20 MiB 的 PNG、JPEG、WebP 图片。");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    if (imageMode === "replace" && selected?.tagName === "IMG") {
      patchSelected((element) => { (element as HTMLImageElement).src = dataUrl; });
      return;
    }
    const shell = iframeDocument?.querySelector<HTMLElement>('[data-presenton-slide-shell="true"]');
    if (!shell) return;
    markMutation();
    const image = iframeDocument!.createElement("img");
    image.src = dataUrl;
    image.dataset.pptEditorCreated = "true";
    image.dataset.pptEditorId = makeId();
    Object.assign(image.style, { position: "absolute", left: "400px", top: "200px", width: "480px", height: "320px", objectFit: "contain", zIndex: "999" });
    shell.append(image);
    setSelected(image);
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === "s") { event.preventDefault(); void save(); return; }
      if (editableTarget(event.target)) return;
      if (meta && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
      if (meta && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); return; }
      if ((event.key === "Delete" || event.key === "Backspace") && selected) {
        event.preventDefault();
        patchSelected((element) => { element.style.visibility = "hidden"; element.dataset.pptEditorDeleted = "true"; });
        setSelected(null);
        return;
      }
      if (event.key === "Escape") { selected?.blur(); setSelected(null); return; }
      if (event.key === "Enter" && selected && /^(DIV|P|H[1-6])$/.test(selected.tagName)) {
        event.preventDefault(); selected.contentEditable = "true"; selected.focus();
        return;
      }
      if (event.key.startsWith("Arrow") && selected) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        markMutation(); promoteToAbsolute(selected);
        const left = Number.parseFloat(selected.style.left || "0");
        const top = Number.parseFloat(selected.style.top || "0");
        if (event.key === "ArrowLeft") selected.style.left = `${left - step}px`;
        if (event.key === "ArrowRight") selected.style.left = `${left + step}px`;
        if (event.key === "ArrowUp") selected.style.top = `${top - step}px`;
        if (event.key === "ArrowDown") selected.style.top = `${top + step}px`;
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [markMutation, redo, save, selected, undo]);

  const onIframeLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    iframeCleanupRef.current?.();
    setIframeDocument(doc);
    const shell = doc.querySelector<HTMLElement>('[data-presenton-slide-shell="true"]');
    if (!shell) { setError("页面缺少可编辑 slide shell。"); return; }
    const pointerDown = (event: PointerEvent) => {
      if (editableTarget(event.target)) return;
      if (isMoveableEditorTarget(event.target)) return;
      const target = selectionTarget(event.target, shell);
      setSelected(target);
    };
    const doubleClick = (event: MouseEvent) => {
      if (isMoveableEditorTarget(event.target)) return;
      const target = selectionTarget(event.target, shell);
      if (!target || !target.textContent?.trim() || /^(IMG|SVG|CANVAS|TABLE)$/.test(target.tagName)) return;
      textEditBeforeRef.current = serializeDocument(doc);
      target.contentEditable = "true";
      target.focus();
      setSelected(target);
    };
    const focusOut = (event: FocusEvent) => {
      const target = event.target && typeof (event.target as HTMLElement).isContentEditable === "boolean" ? event.target as HTMLElement : null;
      if (!target?.isContentEditable) return;
      target.contentEditable = "false";
      if (textEditBeforeRef.current && textEditBeforeRef.current !== serializeDocument(doc)) markMutation(textEditBeforeRef.current);
      textEditBeforeRef.current = null;
    };
    const paste = (event: ClipboardEvent) => {
      const target = event.target && typeof (event.target as HTMLElement).isContentEditable === "boolean" ? event.target as HTMLElement : null;
      if (!target?.isContentEditable) return;
      event.preventDefault();
      doc.execCommand("insertText", false, event.clipboardData?.getData("text/plain") ?? "");
    };
    const selectionChange = () => {
      const range = doc.getSelection()?.rangeCount ? doc.getSelection()!.getRangeAt(0) : null;
      selectionRangeRef.current = range && shell.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
    };
    doc.addEventListener("pointerdown", pointerDown);
    doc.addEventListener("dblclick", doubleClick);
    doc.addEventListener("focusout", focusOut);
    doc.addEventListener("paste", paste);
    doc.addEventListener("selectionchange", selectionChange);
    iframeCleanupRef.current = () => {
      doc.removeEventListener("pointerdown", pointerDown);
      doc.removeEventListener("dblclick", doubleClick);
      doc.removeEventListener("focusout", focusOut);
      doc.removeEventListener("paste", paste);
      doc.removeEventListener("selectionchange", selectionChange);
      selectionRangeRef.current = null;
    };
  };

  const scale = zoom === "fit" ? fitScale : zoom;
  const selectedStyle = selected && iframeDocument?.defaultView?.getComputedStyle(selected);
  const shell = iframeDocument?.querySelector<HTMLElement>('[data-presenton-slide-shell="true"]');
  const themeFont = shell && iframeDocument?.defaultView?.getComputedStyle(shell).fontFamily;
  const selectedFont = primaryFontFamily(selectedStyle?.fontFamily);
  const fontOptions = Array.from(new Set([
    selectedFont,
    primaryFontFamily(themeFont || undefined),
    ...FONT_FAMILIES,
  ].filter(Boolean)));
  const selectedIsImage = selected?.tagName === "IMG";
  const selectedHasText = Boolean(
    selected && !/^(IMG|SVG|CANVAS)$/.test(selected.tagName) && selected.textContent?.trim(),
  );
  const selectedParent = selected?.parentElement;
  const canSelectParent = Boolean(selectedParent && shell && selectedParent !== shell && shell.contains(selectedParent));
  const currentFontSize = Math.round(Number.parseFloat(selectedStyle?.fontSize ?? "20"));
  const fontSizeOptions = FONT_SIZES.includes(currentFontSize)
    ? FONT_SIZES
    : [currentFontSize, ...FONT_SIZES].sort((left, right) => left - right);
  const textColor = colorInputValue(selectedStyle?.color, "#111827");
  const fillColor = colorInputValue(selectedStyle?.backgroundColor, "#ffffff");
  const borderColor = colorInputValue(selectedStyle?.borderColor, "#111827");
  const borderWidth = Math.round(Number.parseFloat(selectedStyle?.borderWidth ?? "0"));
  const opacity = Math.round(Number(selectedStyle?.opacity ?? 1) * 100);
  const saveStatusLabel = saveStatus === "saved"
    ? "已保存"
    : saveStatus === "saving"
      ? "保存中…"
      : saveStatus === "conflict"
        ? "保存冲突"
        : saveStatus === "error"
          ? "保存失败"
          : "未保存";
  const togglePopover = (popover: Exclude<ToolbarPopover, null>) => {
    setToolbarPopover((current) => current === popover ? null : popover);
  };

  const toolbar = (
    <div ref={toolbarRef} className="manual-editor-toolbar" role="toolbar">
      <button className="manual-editor-btn icon" onClick={undo} disabled={!history.length} title="撤销（Ctrl/Cmd+Z）"><Undo2 size={16} /></button>
      <button className="manual-editor-btn icon" onClick={redo} disabled={!future.length} title="重做（Ctrl/Cmd+Shift+Z）"><Redo2 size={16} /></button>
      <span className="manual-toolbar-divider" />
      {!selected ? (
        <>
          <button className="manual-editor-btn icon" onClick={() => addElement("text")} title="新增文本"><Type size={16} /></button>
          <button className="manual-editor-btn icon" onClick={() => addElement("shape")} title="新增形状"><Shapes size={16} /></button>
          <button className="manual-editor-btn icon" onClick={() => { setImageMode("add"); fileInputRef.current?.click(); }} title="新增图片"><ImagePlus size={16} /></button>
        </>
      ) : null}

      {selectedHasText ? (
        <>
          <select className="manual-toolbar-select font-family" title="字体" value={selectedFont || "Arial"} onChange={(event) => applyTextStyle("fontFamily", event.target.value)}>
            {fontOptions.map((font) => <option key={font}>{font}</option>)}
          </select>
          <select className="manual-toolbar-select font-size" title="字号" value={currentFontSize} onChange={(event) => applyTextStyle("fontSize", `${event.target.value}px`)}>
            {fontSizeOptions.map((size) => <option key={size}>{size}</option>)}
          </select>
          <span className="manual-toolbar-divider" />
          <button className={`manual-editor-btn icon ${Number.parseInt(selectedStyle?.fontWeight ?? "400", 10) >= 600 ? "active" : ""}`} title="加粗" onClick={() => applyTextStyle("fontWeight", Number.parseInt(selectedStyle?.fontWeight ?? "400", 10) >= 600 ? "400" : "700")}><Bold size={15} /></button>
          <button className={`manual-editor-btn icon ${selectedStyle?.fontStyle === "italic" ? "active" : ""}`} title="斜体" onClick={() => applyTextStyle("fontStyle", selectedStyle?.fontStyle === "italic" ? "normal" : "italic")}><Italic size={15} /></button>
          <button className={`manual-editor-btn icon ${selectedStyle?.textDecorationLine.includes("underline") ? "active" : ""}`} title="下划线" onClick={() => applyTextStyle("textDecoration", selectedStyle?.textDecorationLine.includes("underline") ? "none" : "underline")}><Underline size={15} /></button>
          <button className={`manual-editor-btn icon ${selectedStyle?.textDecorationLine.includes("line-through") ? "active" : ""}`} title="删除线" onClick={() => applyTextStyle("textDecoration", selectedStyle?.textDecorationLine.includes("line-through") ? "none" : "line-through")}><Strikethrough size={15} /></button>
          <span className="manual-toolbar-divider" />
          <button className={`manual-editor-btn icon ${selectedStyle?.textAlign === "left" || selectedStyle?.textAlign === "start" ? "active" : ""}`} title="左对齐" onClick={() => patchSelected((element) => { element.style.textAlign = "left"; })}><AlignLeft size={15} /></button>
          <button className={`manual-editor-btn icon ${selectedStyle?.textAlign === "center" ? "active" : ""}`} title="居中" onClick={() => patchSelected((element) => { element.style.textAlign = "center"; })}><AlignCenter size={15} /></button>
          <button className={`manual-editor-btn icon ${selectedStyle?.textAlign === "right" || selectedStyle?.textAlign === "end" ? "active" : ""}`} title="右对齐" onClick={() => patchSelected((element) => { element.style.textAlign = "right"; })}><AlignRight size={15} /></button>
          <div className="manual-toolbar-popover-anchor">
            <button className={`manual-editor-btn icon ${toolbarPopover === "paragraph" ? "active" : ""}`} title="段落设置" onClick={() => togglePopover("paragraph")}><Pilcrow size={15} /></button>
            {toolbarPopover === "paragraph" ? (
              <div className="manual-toolbar-popover paragraph">
                <label><span>行高</span><select value={selected?.style.lineHeight || "1.2"} onChange={(event) => patchSelected((element) => { element.style.lineHeight = event.target.value; })}>{[1, 1.15, 1.25, 1.5, 1.75, 2, 2.5, 3].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                <label><span>段后间距</span><select value={Number.parseInt(selectedStyle?.marginBottom ?? "0", 10) || 0} onChange={(event) => patchSelected((element) => { element.style.marginBottom = `${event.target.value}px`; })}>{[0, 2, 4, 8, 12, 16, 24, 32].map((value) => <option key={value} value={value}>{value}px</option>)}</select></label>
              </div>
            ) : null}
          </div>
          <label className="manual-toolbar-color" title="文字颜色">
            <span className="manual-text-color-sample" style={{ borderBottomColor: textColor }}>A</span>
            <input type="color" value={textColor} onChange={(event) => applyTextStyle("color", event.target.value)} />
          </label>
        </>
      ) : null}

      {selectedIsImage ? (
        <>
          <button className="manual-editor-btn text" onClick={() => { setImageMode("replace"); fileInputRef.current?.click(); }}><ImagePlus size={15} />替换图片</button>
          <select className="manual-toolbar-select image-fit" title="图片适应方式" value={selectedStyle?.objectFit ?? "contain"} onChange={(event) => patchSelected((element) => { element.style.objectFit = event.target.value; })}>
            <option value="cover">填满并裁切</option><option value="contain">完整显示</option><option value="fill">拉伸填满</option>
          </select>
        </>
      ) : null}

      {selected && !selectedIsImage ? (
        <>
          <div className="manual-toolbar-popover-anchor">
            <button className={`manual-editor-btn text ${toolbarPopover === "fill" ? "active" : ""}`} title="填充" onClick={() => togglePopover("fill")}><PaintBucket size={15} /><span className="manual-color-dot" style={{ background: fillColor }} />填充</button>
            {toolbarPopover === "fill" ? (
              <div className="manual-toolbar-popover compact align-right">
                <label className="manual-color-field"><span>填充颜色</span><input type="color" value={fillColor} onChange={(event) => patchSelected((element) => { element.style.backgroundColor = event.target.value; })} /></label>
                <button className="manual-popover-action" onClick={() => { patchSelected((element) => { element.style.background = "transparent"; }); setToolbarPopover(null); }}>无填充</button>
              </div>
            ) : null}
          </div>
          <div className="manual-toolbar-popover-anchor">
            <button className={`manual-editor-btn text ${toolbarPopover === "border" ? "active" : ""}`} title="边框" onClick={() => togglePopover("border")}><Square size={15} style={{ color: borderColor }} />边框</button>
            {toolbarPopover === "border" ? (
              <div className="manual-toolbar-popover compact align-right">
                <label className="manual-color-field"><span>边框颜色</span><input type="color" value={borderColor} onChange={(event) => patchSelected((element) => { element.style.borderColor = event.target.value; element.style.borderStyle = "solid"; })} /></label>
                <label><span>边框宽度</span><select value={borderWidth} onChange={(event) => patchSelected((element) => { element.style.borderWidth = `${event.target.value}px`; element.style.borderStyle = Number(event.target.value) > 0 ? "solid" : "none"; })}>{[0, 1, 2, 3, 4, 6, 8].map((value) => <option key={value} value={value}>{value}px</option>)}</select></label>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {selected ? (
        <>
          <div className="manual-toolbar-popover-anchor">
            <button className={`manual-editor-btn text ${toolbarPopover === "opacity" ? "active" : ""}`} title="透明度" onClick={() => togglePopover("opacity")}><SlidersHorizontal size={15} />{opacity}%</button>
            {toolbarPopover === "opacity" ? (
              <div className="manual-toolbar-popover opacity align-right"><label><span>透明度</span><input type="range" min="0" max="100" value={opacity} onChange={(event) => patchSelected((element) => { element.style.opacity = String(Number(event.target.value) / 100); })} /><strong>{opacity}%</strong></label></div>
            ) : null}
          </div>
          <button className="manual-editor-btn icon danger" title="删除（Delete）" onClick={() => { patchSelected((element) => { element.style.visibility = "hidden"; element.dataset.pptEditorDeleted = "true"; }); setSelected(null); }}><Trash2 size={15} /></button>
        </>
      ) : null}

      <div className="manual-toolbar-popover-anchor manual-toolbar-more">
        <button className={`manual-editor-btn icon ${toolbarPopover === "more" ? "active" : ""}`} title="更多" onClick={() => togglePopover("more")}><MoreHorizontal size={16} /></button>
        {toolbarPopover === "more" ? (
          <div className="manual-toolbar-menu align-right">
            {selected ? <button disabled={!canSelectParent} onClick={selectParent}><Layers size={14} />选择父级</button> : null}
            {selected ? <span className="manual-toolbar-menu-label">图层</span> : null}
            {selected ? <button onClick={() => { arrange("front"); setToolbarPopover(null); }}><ArrowUpToLine size={14} />置于顶层</button> : null}
            {selected ? <button onClick={() => { arrange("forward"); setToolbarPopover(null); }}><ArrowUp size={14} />上移一层</button> : null}
            {selected ? <button onClick={() => { arrange("backward"); setToolbarPopover(null); }}><ArrowDown size={14} />下移一层</button> : null}
            {selected ? <button onClick={() => { arrange("back"); setToolbarPopover(null); }}><ArrowDownToLine size={14} />置于底层</button> : null}
            <button disabled={!context?.manually_edited} onClick={() => { setToolbarPopover(null); setConfirm({ kind: "restore" }); }}><RotateCcw size={14} />恢复 AI 版本</button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <section className="manual-page-editor">
      <aside className={`manual-editor-filmstrip ${filmstripCollapsed ? "collapsed" : ""}`}>
        <div className="manual-filmstrip-header">
          <button className="manual-editor-btn icon" onClick={requestExit} title="返回"><ArrowLeft size={17} /></button>
          {!filmstripCollapsed ? <strong>编辑 PPT</strong> : null}
          <button className="manual-editor-btn icon" onClick={() => setFilmstripCollapsed((value) => !value)} title={filmstripCollapsed ? "展开页面列表" : "收起页面列表"}>{filmstripCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button>
        </div>
        {!filmstripCollapsed ? (
          <div className="manual-filmstrip-scroll">
            {props.pages.map((item, index) => (
              <button key={item.pageId} className={`manual-filmstrip-item ${index === pageIndex ? "active" : ""}`} onClick={() => requestSwitch(index)}>
                <span className="manual-filmstrip-index">{index + 1}</span>
                {item.screenshotUrl ? <img src={item.screenshotUrl} alt="" /> : <div className="manual-thumb-placeholder" />}
                <small>{item.title}</small>
              </button>
            ))}
          </div>
        ) : null}
      </aside>
      <main ref={canvasAreaRef} className="manual-editor-canvas-area">
          {toolbar}
        <div className="manual-editor-canvas-scroll">
          {loading ? (
            <div className="manual-editor-loading" role="status" aria-live="polite">
              <LoaderCircle size={30} aria-hidden="true" />
              <span>正在加载页面…</span>
            </div>
          ) : null}
          {error ? <div className="manual-editor-error">{error}{saveStatus === "conflict" ? <button onClick={() => void loadPage(pageIndex)}>加载后端最新版本</button> : null}</div> : null}
          {!loading && html ? (
            <div className="manual-editor-stage" style={{ width: 1280 * scale, height: 720 * scale }}>
              <iframe
                ref={iframeRef}
                title={page?.title ?? "PPT page editor"}
                sandbox="allow-same-origin"
                srcDoc={html}
                onLoad={onIframeLoad}
                style={{ width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: "top left" }}
              />
            </div>
          ) : null}
          {iframeDocument && selected ? createPortal(
            <Moveable
              className={MOVEABLE_EDITOR_CLASS}
              target={selected}
              draggable
              resizable
              keepRatio={selected.tagName === "IMG"}
              edge
              throttleDrag={1}
              onDragStart={() => {
                dragGestureRef.current = {
                  before: serializeDocument(iframeDocument),
                  startLeft: 0,
                  startTop: 0,
                  moved: false,
                };
              }}
              onDrag={(event) => {
                const gesture = dragGestureRef.current;
                if (!gesture || !exceedsDragThreshold(event.dist, scale)) return;
                if (!gesture.moved) {
                  promoteToAbsolute(event.target as HTMLElement);
                  gesture.startLeft = Number.parseFloat(event.target.style.left || "0") || 0;
                  gesture.startTop = Number.parseFloat(event.target.style.top || "0") || 0;
                  gesture.moved = true;
                }
                const [dx, dy] = canvasDistance(event.dist, scale);
                event.target.style.left = `${gesture.startLeft + dx}px`;
                event.target.style.top = `${gesture.startTop + dy}px`;
              }}
              onDragEnd={() => {
                const gesture = dragGestureRef.current;
                if (gesture?.moved) markMutation(gesture.before);
                dragGestureRef.current = null;
              }}
              onResizeStart={() => {
                resizeGestureRef.current = {
                  before: serializeDocument(iframeDocument),
                  startLeft: 0,
                  startTop: 0,
                  startWidth: 0,
                  startHeight: 0,
                  moved: false,
                };
              }}
              onResize={(event) => {
                const gesture = resizeGestureRef.current;
                if (!gesture) return;
                const resizeDistance: [number, number] = [event.dist[0], event.dist[1]];
                const dragDistance: [number, number] = [event.drag.dist[0], event.drag.dist[1]];
                if (!exceedsDragThreshold(resizeDistance, scale) && !exceedsDragThreshold(dragDistance, scale)) return;
                if (!gesture.moved) {
                  promoteToAbsolute(event.target as HTMLElement);
                  gesture.startLeft = Number.parseFloat(event.target.style.left || "0") || 0;
                  gesture.startTop = Number.parseFloat(event.target.style.top || "0") || 0;
                  gesture.startWidth = event.target.getBoundingClientRect().width;
                  gesture.startHeight = event.target.getBoundingClientRect().height;
                  gesture.moved = true;
                }
                const [dw, dh] = canvasDistance(resizeDistance, scale);
                const [dx, dy] = canvasDistance(dragDistance, scale);
                event.target.style.width = `${Math.max(16, gesture.startWidth + dw)}px`;
                event.target.style.height = `${Math.max(16, gesture.startHeight + dh)}px`;
                event.target.style.left = `${gesture.startLeft + dx}px`;
                event.target.style.top = `${gesture.startTop + dy}px`;
              }}
              onResizeEnd={() => {
                const gesture = resizeGestureRef.current;
                if (gesture?.moved) markMutation(gesture.before);
                resizeGestureRef.current = null;
              }}
            />,
            iframeDocument.body,
          ) : null}
        </div>
          <div className="manual-editor-status-bar">
            <div className="manual-editor-zoom-control">
              <button className={`manual-editor-btn ghost ${zoom === "fit" ? "active" : ""}`} onClick={() => setZoom("fit")}>适应窗口</button>
              <button className="manual-editor-btn icon ghost" onClick={() => setZoom(Math.max(0.25, scale - 0.1))} title="缩小"><ZoomOut size={15} /></button>
              <span>{Math.round(scale * 100)}%</span>
              <button className="manual-editor-btn icon ghost" onClick={() => setZoom(Math.min(2, scale + 0.1))} title="放大"><ZoomIn size={15} /></button>
            </div>
            <div className={`manual-save-status ${saveStatus}`}><span className="manual-save-dot" />{saveStatusLabel}</div>
            <button className="manual-editor-btn primary" onClick={() => void save()} disabled={saveStatus === "saving" || saveStatus === "saved"}><Save size={15} />保存</button>
          </div>
      </main>
      <input ref={fileInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImage(file); event.currentTarget.value = ""; }} />
      {confirm ? (
        <div className="manual-editor-confirm-backdrop">
          <div className="manual-editor-confirm">
            <strong>{confirm.kind === "restore" ? "恢复 AI 生成版本" : "当前页面有未保存修改"}</strong>
            <p>{confirm.kind === "restore" ? "当前人工修改将被删除，并重新渲染现有 TSX。" : "请选择保存、放弃修改或继续编辑。"}</p>
            {confirm.kind === "restore" ? (
              <div><button onClick={() => void resolveConfirm("cancel")}>取消</button><button className="primary" onClick={() => void resolveConfirm("restore")}>确认恢复</button></div>
            ) : (
              <div><button onClick={() => void resolveConfirm("cancel")}>继续编辑</button><button onClick={() => void resolveConfirm("discard")}>放弃</button><button className="primary" onClick={() => void resolveConfirm("save")}>保存</button></div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
