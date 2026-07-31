import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Moveable from "react-moveable";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceAround,
  ArrowLeft,
  Bold,
  Crop,
  ImagePlus,
  Italic,
  Layers,
  LoaderCircle,
  MoreHorizontal,
  PaintBucket,
  PanelLeftClose,
  PanelLeftOpen,
  Redo2,
  RotateCcw,
  Save,
  Shapes,
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
  ManagedFontFamilySummary,
  ManagedFontRuntimeFamily,
  RestorePageSourceVersionResult,
  SaveManualPageRevisionResult,
} from "../../api/types";
import { createAppHostUploadClient, type AppHostUploadClient } from "../../runtime/appHostUploadClient";
import { connectAnnaRuntime } from "../../runtime/annaRuntime";
import { formatMessage, type Messages } from "../../i18n/messages";
import {
  MOVEABLE_EDITOR_CLASS,
  canvasDistance,
  exceedsDragThreshold,
  isMoveableEditorTarget,
  isSelectableBox,
} from "./manualPageEditorInteractions";
import {
  ManualImageCropOverlay,
  type ImageCropSession,
} from "./ManualImageCropOverlay";
import {
  clampSourcePosition,
  cropForBoxes,
  imageDisplaySize,
  imageSourceElement,
  isCroppedImage,
  isEditableImage,
  readImageCrop,
  resetImageCrop,
  sourceBoxForCrop,
  updateImageCrop,
  wrapImageWithCrop,
  type ImageBox,
} from "./manualPageEditorImages";
import { measureLocalScale, promoteToAbsolute } from "./manualPageEditorPromotion";
import {
  FONT_UPLOAD_VALUE,
  MANAGED_FONT_FAMILY_ATTRIBUTE,
  installRuntimeManagedFonts,
  managedFontFileMimeType,
  mergeRuntimeFontFamily,
  verifyRuntimeManagedFonts,
} from "./manualPageEditorFonts";
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
  t: Messages;
  workspaceDir: string;
  pages: ManualPageEditorPage[];
  initialPageIndex: number;
  onPageUpdated: (result: SaveManualPageRevisionResult | RestorePageSourceVersionResult) => void;
  onExit: (requiresDeckRender: boolean) => Promise<void> | void;
}

type SaveStatus = "saved" | "unsaved" | "saving" | "conflict" | "error";
type ToolbarPopover = "fill" | "border" | "more" | null;

function editableTarget(target: EventTarget | null): target is HTMLElement {
  const element = target && typeof (target as HTMLElement).closest === "function" ? target as HTMLElement : null;
  return Boolean(element?.closest("input,textarea,select,[contenteditable='true']"));
}

function selectionTarget(target: EventTarget | null, shell: HTMLElement): HTMLElement | null {
  let element = target && typeof (target as HTMLElement).closest === "function" ? target as HTMLElement : null;
  while (element && element !== shell) {
    if (element.dataset.pptEditorImageSource && isCroppedImage(element.parentElement)) {
      return element.parentElement;
    }
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (isSelectableBox({
      tagName: element.tagName,
      display: style?.display ?? "block",
      visibility: style?.visibility ?? "visible",
      width: rect.width,
      height: rect.height,
      isEditorArtifact: Boolean(element.dataset.pptEditorPlaceholder || element.dataset.pptEditorDeleted),
    })) return element;
    element = element.parentElement;
  }
  return null;
}

interface OutlineBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

function outlineBox(element: HTMLElement): OutlineBox {
  const rect = element.getBoundingClientRect();
  const view = element.ownerDocument.defaultView;
  return {
    left: rect.left + (view?.scrollX ?? 0),
    top: rect.top + (view?.scrollY ?? 0),
    width: rect.width,
    height: rect.height,
  };
}

function serializeDocument(doc: Document): string {
  const root = doc.documentElement.cloneNode(true) as HTMLElement;
  // Moveable draws its control box into the iframe body, and this serialization
  // feeds both the saved revision and the undo snapshots, so the handles would
  // otherwise be baked into the page and its screenshot.
  for (const node of Array.from(root.querySelectorAll(`.${MOVEABLE_EDITOR_CLASS}`))) node.remove();
  return `<!doctype html>\n${root.outerHTML}`;
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

async function imageFileData(file: File): Promise<{
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
}> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const dimensions = await new Promise<{ naturalWidth: number; naturalHeight: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    });
    image.onerror = () => reject(new Error("Unable to decode image"));
    image.src = dataUrl;
  });
  return { dataUrl, ...dimensions };
}

function imageBoxesEqual(left: ImageBox, right: ImageBox): boolean {
  return (
    Math.abs(left.left - right.left) < 0.01 &&
    Math.abs(left.top - right.top) < 0.01 &&
    Math.abs(left.width - right.width) < 0.01 &&
    Math.abs(left.height - right.height) < 0.01
  );
}

export function ManualPageEditorShell(props: Props) {
  const t = props.t.manualEditor;
  const controls = props.t.controls;
  const [backend, setBackend] = useState<PptBackend | null>(null);
  const [uploadClient, setUploadClient] = useState<AppHostUploadClient | null>(null);
  const [pageIndex, setPageIndex] = useState(Math.min(props.initialPageIndex, Math.max(0, props.pages.length - 1)));
  const [context, setContext] = useState<GetPageEditContextResult | null>(null);
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  const [hoverBox, setHoverBox] = useState<OutlineBox | null>(null);
  const [iframeDocument, setIframeDocument] = useState<Document | null>(null);
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const [fitScale, setFitScale] = useState(0.75);
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<null | { kind: "exit" | "switch" | "restore"; target?: number }>(null);
  const [imageMode, setImageMode] = useState<"add" | "replace">("add");
  const [cropSession, setCropSession] = useState<ImageCropSession | null>(null);
  const [managedFontLibrary, setManagedFontLibrary] = useState<ManagedFontFamilySummary[]>([]);
  const [runtimeFonts, setRuntimeFonts] = useState<ManagedFontRuntimeFamily[]>([]);
  const [filmstripCollapsed, setFilmstripCollapsed] = useState(false);
  const [toolbarPopover, setToolbarPopover] = useState<ToolbarPopover>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const textEditBeforeRef = useRef<string | null>(null);
  const selectionRangeRef = useRef<Range | null>(null);
  const hoveredRef = useRef<HTMLElement | null>(null);
  const selectedRef = useRef<HTMLElement | null>(null);
  const cropSessionRef = useRef<ImageCropSession | null>(null);
  const finishCropRef = useRef<() => boolean>(() => false);
  const cancelCropRef = useRef<() => void>(() => undefined);
  const startCropRef = useRef<(target?: HTMLElement | null) => void>(() => undefined);
  const nudgeCropRef = useRef<(key: string, step: number) => void>(() => undefined);
  const editorKeydownRef = useRef<(event: KeyboardEvent) => void>(() => undefined);
  const iframeCleanupRef = useRef<(() => void) | null>(null);
  const deckRenderRequiredRef = useRef(false);
  const dragGestureRef = useRef<{
    before: string;
    startLeft: number;
    startTop: number;
    localScale: { x: number; y: number };
    moved: boolean;
  } | null>(null);
  const resizeGestureRef = useRef<{
    before: string;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
    localScale: { x: number; y: number };
    moved: boolean;
  } | null>(null);

  /** Drops the cached hover so the next pointer move measures the new layout. */
  const forgetHover = useCallback(() => {
    hoveredRef.current = null;
    setHoverBox(null);
  }, []);

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
    cropSessionRef.current = null;
    setCropSession(null);
    iframeCleanupRef.current?.();
    iframeCleanupRef.current = null;
    setIframeDocument(null);
    try {
      const nextContext = await backend.getPageEditContext({ workspace_dir: props.workspaceDir, page_id: target.pageId });
      const response = await fetch(nextContext.html_upload.url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(formatMessage(t.loadFailed, { status: response.status }));
      }
      setContext(nextContext);
      setManagedFontLibrary(nextContext.font_library ?? []);
      setRuntimeFonts(nextContext.workspace_fonts ?? []);
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
  }, [backend, props.pages, props.workspaceDir, t]);

  useEffect(() => { if (backend) void loadPage(pageIndex); }, [backend]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => iframeCleanupRef.current?.(), []);

  // The iframe listeners are registered once per page load, so they read the
  // current selection through a ref instead of a stale closure.
  useEffect(() => {
    selectedRef.current = selected;
    // Moveable already frames the selection; two outlines on one element read as
    // a rendering glitch.
    if (hoveredRef.current === selected) setHoverBox(null);
  }, [selected]);

  useEffect(() => {
    cropSessionRef.current = cropSession;
  }, [cropSession]);

  useEffect(() => {
    if (!iframeDocument) return;
    let cancelled = false;
    installRuntimeManagedFonts(iframeDocument, runtimeFonts);
    void verifyRuntimeManagedFonts(iframeDocument, runtimeFonts).catch((value) => {
      if (!cancelled) {
        setError(formatMessage(t.fontLoadFailed, {
          message: value instanceof Error ? value.message : String(value),
        }));
      }
    });
    return () => { cancelled = true; };
  }, [iframeDocument, runtimeFonts]);

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
    cropSessionRef.current = null;
    setCropSession(null);
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

  const finishCrop = useCallback((): boolean => {
    const session = cropSessionRef.current;
    if (!session) return false;
    session.target.style.visibility = session.previousVisibility;
    cropSessionRef.current = null;
    setCropSession(null);

    if (
      imageBoxesEqual(session.frame, session.initialFrame) &&
      imageBoxesEqual(session.source, sourceBoxForCrop(session.initialFrame, readImageCrop(session.target)))
    ) {
      return false;
    }

    const crop = cropForBoxes(session.frame, session.source);
    let target = session.target;
    promoteToAbsolute(target);
    const localScale = measureLocalScale(target);
    target.style.left = `${target.offsetLeft + (session.frame.left - session.initialFrame.left) / localScale.x}px`;
    target.style.top = `${target.offsetTop + (session.frame.top - session.initialFrame.top) / localScale.y}px`;
    target.style.width = `${Math.max(16, target.offsetWidth + (session.frame.width - session.initialFrame.width) / localScale.x)}px`;
    target.style.height = `${Math.max(16, target.offsetHeight + (session.frame.height - session.initialFrame.height) / localScale.y)}px`;

    if (target.tagName === "IMG") {
      const image = target as HTMLImageElement;
      image.style.objectFit = "fill";
      image.style.objectPosition = "50% 50%";
      target = wrapImageWithCrop(image, crop);
    } else {
      updateImageCrop(target, crop);
    }

    const changed = serializeDocument(target.ownerDocument) !== session.before;
    if (changed) markMutation(session.before);
    setSelected(target);
    return changed;
  }, [markMutation]);

  const cancelCrop = useCallback(() => {
    const session = cropSessionRef.current;
    if (!session) return;
    session.target.style.visibility = session.previousVisibility;
    cropSessionRef.current = null;
    setCropSession(null);
  }, []);

  const startCrop = useCallback((requested?: HTMLElement | null) => {
    if (cropSessionRef.current) {
      finishCropRef.current();
      return;
    }
    const target = requested ?? selectedRef.current;
    if (!target || !isEditableImage(target)) return;
    const source = imageSourceElement(target);
    if (!source) return;
    const frame = outlineBox(target);
    const sourceBox = sourceBoxForCrop(frame, readImageCrop(target));
    const session: ImageCropSession = {
      target,
      sourceUrl: source.currentSrc || source.src,
      before: serializeDocument(target.ownerDocument),
      previousVisibility: target.style.visibility,
      initialFrame: frame,
      frame,
      source: sourceBox,
      sourceAspectRatio: sourceBox.width / sourceBox.height,
    };
    target.style.visibility = "hidden";
    forgetHover();
    cropSessionRef.current = session;
    setCropSession(session);
    setSelected(target);
  }, [forgetHover]);

  const nudgeCrop = useCallback((key: string, step: number) => {
    const session = cropSessionRef.current;
    if (!session) return;
    const source = clampSourcePosition({
      ...session.source,
      left: session.source.left + (key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0),
      top: session.source.top + (key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0),
    }, session.frame);
    const next = { ...session, source };
    cropSessionRef.current = next;
    setCropSession(next);
  }, []);

  finishCropRef.current = finishCrop;
  cancelCropRef.current = cancelCrop;
  startCropRef.current = startCrop;
  nudgeCropRef.current = nudgeCrop;

  const save = useCallback(async () => {
    if (!backend || !uploadClient || !context || !page) return false;
    finishCropRef.current();
    const value = currentHtml();
    const file = new File([value], `${page.pageId}.html`, { type: "text/plain" });
    if (file.size > 64 * 1024 * 1024) {
      setError(t.tooLarge);
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
  }, [backend, context, currentHtml, page, props.onPageUpdated, props.workspaceDir, recordDeckRenderRequirement, t, uploadClient]);

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
    const cropChanged = finishCropRef.current();
    if (dirty || cropChanged) setConfirm({ kind: "switch", target: index });
    else void loadPage(index);
  };

  const requestExit = () => {
    const cropChanged = finishCropRef.current();
    if (dirty || cropChanged) setConfirm({ kind: "exit" });
    else void props.onExit(deckRenderRequiredRef.current);
  };

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

  const applyFontFamily = (family: string, managed: boolean) => {
    if (!selected) return;
    const value = `"${family.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    const range = selectionRangeRef.current;
    if (range && !range.collapsed && selected.contains(range.commonAncestorContainer)) {
      markMutation();
      const span = iframeDocument!.createElement("span");
      span.style.fontFamily = value;
      if (managed) span.setAttribute(MANAGED_FONT_FAMILY_ATTRIBUTE, family);
      span.append(range.extractContents());
      range.insertNode(span);
      selectionRangeRef.current = null;
      return;
    }
    patchSelected((element) => {
      element.style.fontFamily = value;
      if (managed) element.setAttribute(MANAGED_FONT_FAMILY_ATTRIBUTE, family);
      else element.removeAttribute(MANAGED_FONT_FAMILY_ATTRIBUTE);
    });
  };

  const chooseFontFamily = async (family: string) => {
    if (family === FONT_UPLOAD_VALUE) {
      fontInputRef.current?.click();
      return;
    }
    const managed = managedFontLibrary.some((font) => font.family === family);
    if (managed && !runtimeFonts.some((font) => font.family === family)) {
      if (!backend) return;
      try {
        const font = await backend.pinManagedFont({
          workspace_dir: props.workspaceDir,
          family,
        });
        setRuntimeFonts((current) => mergeRuntimeFontFamily(current, font));
      } catch (value) {
        setError(value instanceof Error ? value.message : String(value));
        return;
      }
    }
    applyFontFamily(family, managed);
  };

  const handleFontUpload = async (file: File) => {
    const mimeType = managedFontFileMimeType(file.name);
    if (!mimeType || file.size <= 0 || file.size > 20 * 1024 * 1024) {
      setError(t.fontRejected);
      return;
    }
    if (!backend || !uploadClient) return;
    setError("");
    try {
      const hostUpload = await uploadClient.uploadFile(file, {
        purpose: "user_artifact",
        filename: file.name,
        mimeType,
        metadata: {
          workspace_dir: props.workspaceDir,
          source: "manual-page-editor-font",
        },
      });
      const result = await backend.commitManagedFontUpload({
        workspace_dir: props.workspaceDir,
        filename: file.name,
        size_bytes: file.size,
        host_upload: hostUpload,
      });
      setManagedFontLibrary(result.library.families);
      setRuntimeFonts((current) => mergeRuntimeFontFamily(current, result.font));
      applyFontFamily(result.font.family, true);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    }
  };

  const addElement = (kind: "text" | "shape") => {
    finishCropRef.current();
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
      element.textContent = t.newTextPlaceholder;
    } else {
      Object.assign(element.style, { left: "500px", top: "290px", width: "280px", height: "140px", background: "#ddd6fe", borderRadius: "16px" });
    }
    shell.append(element);
    setSelected(element);
  };

  const resetSelectedCrop = () => {
    if (!selected || !isCroppedImage(selected)) return;
    const before = currentHtml();
    const image = resetImageCrop(selected);
    if (!image) return;
    markMutation(before);
    setSelected(image);
  };

  const handleImage = async (file: File) => {
    if (!/image\/(png|jpeg|webp)/.test(file.type) || file.size > 20 * 1024 * 1024) {
      setError(t.imageRejected);
      return;
    }
    let data: Awaited<ReturnType<typeof imageFileData>>;
    try {
      data = await imageFileData(file);
    } catch {
      setError(t.imageRejected);
      return;
    }
    const size = imageDisplaySize(data.naturalWidth, data.naturalHeight);
    if (imageMode === "replace" && selected && isEditableImage(selected)) {
      const before = currentHtml();
      let image = isCroppedImage(selected) ? resetImageCrop(selected) : selected as HTMLImageElement;
      if (!image) return;
      promoteToAbsolute(image);
      const previousRect = image.getBoundingClientRect();
      const previousCenterX = previousRect.left + previousRect.width / 2;
      const previousCenterY = previousRect.top + previousRect.height / 2;
      Object.assign(image.style, {
        width: `${size.width}px`,
        height: `${size.height}px`,
        objectFit: "fill",
        objectPosition: "50% 50%",
      });
      const nextRect = image.getBoundingClientRect();
      const localScale = measureLocalScale(image);
      image.style.left = `${image.offsetLeft + (previousCenterX - nextRect.left - nextRect.width / 2) / localScale.x}px`;
      image.style.top = `${image.offsetTop + (previousCenterY - nextRect.top - nextRect.height / 2) / localScale.y}px`;
      image.src = data.dataUrl;
      markMutation(before);
      setSelected(image);
      return;
    }
    const shell = iframeDocument?.querySelector<HTMLElement>('[data-presenton-slide-shell="true"]');
    if (!shell) return;
    markMutation();
    const image = iframeDocument!.createElement("img");
    image.src = data.dataUrl;
    image.dataset.pptEditorCreated = "true";
    image.dataset.pptEditorId = makeId();
    Object.assign(image.style, {
      position: "absolute",
      left: `${(1280 - size.width) / 2}px`,
      top: `${(720 - size.height) / 2}px`,
      width: `${size.width}px`,
      height: `${size.height}px`,
      objectFit: "fill",
      objectPosition: "50% 50%",
      zIndex: "999",
    });
    shell.append(image);
    setSelected(image);
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === "s") { event.preventDefault(); void save(); return; }
      if (editableTarget(event.target)) return;
      if (cropSessionRef.current) {
        if (event.key === "Escape") {
          event.preventDefault();
          cancelCropRef.current();
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          finishCropRef.current();
          return;
        }
        if (event.key.startsWith("Arrow")) {
          event.preventDefault();
          nudgeCropRef.current(event.key, event.shiftKey ? 10 : 1);
          return;
        }
        if (meta && ["z", "y"].includes(event.key.toLowerCase())) {
          event.preventDefault();
          cancelCropRef.current();
          return;
        }
        return;
      }
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
    editorKeydownRef.current = keydown;
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("keydown", keydown);
      if (editorKeydownRef.current === keydown) editorKeydownRef.current = () => undefined;
    };
  }, [markMutation, redo, save, selected, undo]);

  const onIframeLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    iframeCleanupRef.current?.();
    setIframeDocument(doc);
    const shell = doc.querySelector<HTMLElement>('[data-presenton-slide-shell="true"]');
    if (!shell) { setError(t.missingShell); return; }
    const pointerDown = (event: PointerEvent) => {
      if (editableTarget(event.target)) return;
      if (isMoveableEditorTarget(event.target)) return;
      if (cropSessionRef.current) {
        finishCropRef.current();
        return;
      }
      const target = selectionTarget(event.target, shell);
      setSelected(target);
    };
    const doubleClick = (event: MouseEvent) => {
      if (isMoveableEditorTarget(event.target)) return;
      const target = selectionTarget(event.target, shell);
      if (target && isEditableImage(target)) {
        startCropRef.current(target);
        return;
      }
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
    // A click lands on a leaf over text and on a container over padding, so the
    // pointer previews what it is about to grab.
    const pointerMove = (event: PointerEvent) => {
      if (cropSessionRef.current) return;
      if (dragGestureRef.current || resizeGestureRef.current) return;
      if (isMoveableEditorTarget(event.target)) return;
      const target = selectionTarget(event.target, shell);
      if (target === hoveredRef.current) return;
      hoveredRef.current = target;
      setHoverBox(target && target !== selectedRef.current ? outlineBox(target) : null);
    };
    const pointerLeave = () => forgetHover();
    const keydown = (event: KeyboardEvent) => editorKeydownRef.current(event);
    doc.addEventListener("pointerdown", pointerDown);
    doc.addEventListener("pointermove", pointerMove);
    doc.addEventListener("pointerleave", pointerLeave);
    doc.addEventListener("dblclick", doubleClick);
    doc.addEventListener("focusout", focusOut);
    doc.addEventListener("paste", paste);
    doc.addEventListener("selectionchange", selectionChange);
    doc.addEventListener("keydown", keydown);
    iframeCleanupRef.current = () => {
      doc.removeEventListener("pointerdown", pointerDown);
      doc.removeEventListener("pointermove", pointerMove);
      doc.removeEventListener("pointerleave", pointerLeave);
      doc.removeEventListener("dblclick", doubleClick);
      doc.removeEventListener("focusout", focusOut);
      doc.removeEventListener("paste", paste);
      doc.removeEventListener("selectionchange", selectionChange);
      doc.removeEventListener("keydown", keydown);
      forgetHover();
      selectionRangeRef.current = null;
    };
  };

  const scale = zoom === "fit" ? fitScale : zoom;
  const selectedStyle = selected && iframeDocument?.defaultView?.getComputedStyle(selected);
  const shell = iframeDocument?.querySelector<HTMLElement>('[data-presenton-slide-shell="true"]');
  const themeFont = shell && iframeDocument?.defaultView?.getComputedStyle(shell).fontFamily;
  const selectedFont = primaryFontFamily(selectedStyle?.fontFamily);
  const managedFontNames = new Set(managedFontLibrary.map((font) => font.family));
  const systemFontOptions = Array.from(new Set([
    selectedFont,
    primaryFontFamily(themeFont || undefined),
    ...FONT_FAMILIES,
  ].filter((font): font is string => Boolean(font) && !managedFontNames.has(font!))));
  const selectedIsImage = isEditableImage(selected);
  const selectedHasText = Boolean(
    selected && !selectedIsImage && !/^(IMG|SVG|CANVAS)$/.test(selected.tagName) && selected.textContent?.trim(),
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
  const saveStatusLabel = saveStatus === "saved"
    ? t.saveStatus.saved
    : saveStatus === "saving"
      ? t.saveStatus.saving
      : saveStatus === "conflict"
        ? t.saveStatus.conflict
        : saveStatus === "error"
          ? t.saveStatus.failed
          : t.saveStatus.unsaved;
  const togglePopover = (popover: Exclude<ToolbarPopover, null>) => {
    setToolbarPopover((current) => current === popover ? null : popover);
  };
  const toolbar = (
    <div ref={toolbarRef} className="manual-editor-toolbar" role="toolbar">
      <button data-performance-id="manual-editor.element.add-text" className="manual-editor-btn icon" onClick={() => addElement("text")} title={t.addText}><Type size={16} /></button>
      <button data-performance-id="manual-editor.element.add-shape" className="manual-editor-btn icon" onClick={() => addElement("shape")} title={t.addShape}><Shapes size={16} /></button>
      <button data-performance-id="manual-editor.element.add-image" className="manual-editor-btn icon" onClick={() => { finishCropRef.current(); setImageMode("add"); fileInputRef.current?.click(); }} title={t.addImage}><ImagePlus size={16} /></button>
      <span className="manual-toolbar-divider" />
      <button data-performance-id="manual-editor.undo" className="manual-editor-btn icon" onClick={undo} disabled={Boolean(cropSession) || !history.length} title={t.undo}><Undo2 size={16} /></button>
      <button data-performance-id="manual-editor.redo" className="manual-editor-btn icon" onClick={redo} disabled={Boolean(cropSession) || !future.length} title={t.redo}><Redo2 size={16} /></button>
      <span className="manual-toolbar-divider" />

      {selectedHasText ? (
        <>
          <select className="manual-toolbar-select font-family" title={t.fontFamily} value={selectedFont || "Arial"} onChange={(event) => void chooseFontFamily(event.target.value)}>
            {managedFontLibrary.map((font) => <option key={font.family} value={font.family}>{font.family}</option>)}
            {systemFontOptions.map((font) => <option key={font} value={font}>{font}</option>)}
            <option value={FONT_UPLOAD_VALUE}>{t.uploadFont}</option>
          </select>
          <select className="manual-toolbar-select font-size" title={t.fontSize} value={currentFontSize} onChange={(event) => applyTextStyle("fontSize", `${event.target.value}px`)}>
            {fontSizeOptions.map((size) => <option key={size}>{size}</option>)}
          </select>
          <span className="manual-toolbar-divider" />
          <button data-performance-id="manual-editor.text.bold" className={`manual-editor-btn icon ${Number.parseInt(selectedStyle?.fontWeight ?? "400", 10) >= 600 ? "active" : ""}`} title={t.bold} onClick={() => applyTextStyle("fontWeight", Number.parseInt(selectedStyle?.fontWeight ?? "400", 10) >= 600 ? "400" : "700")}><Bold size={15} /></button>
          <button data-performance-id="manual-editor.text.italic" className={`manual-editor-btn icon ${selectedStyle?.fontStyle === "italic" ? "active" : ""}`} title={t.italic} onClick={() => applyTextStyle("fontStyle", selectedStyle?.fontStyle === "italic" ? "normal" : "italic")}><Italic size={15} /></button>
          <button data-performance-id="manual-editor.text.underline" className={`manual-editor-btn icon ${selectedStyle?.textDecorationLine.includes("underline") ? "active" : ""}`} title={t.underline} onClick={() => applyTextStyle("textDecoration", selectedStyle?.textDecorationLine.includes("underline") ? "none" : "underline")}><Underline size={15} /></button>
          <button data-performance-id="manual-editor.text.strikethrough" className={`manual-editor-btn icon ${selectedStyle?.textDecorationLine.includes("line-through") ? "active" : ""}`} title={t.strikethrough} onClick={() => applyTextStyle("textDecoration", selectedStyle?.textDecorationLine.includes("line-through") ? "none" : "line-through")}><Strikethrough size={15} /></button>
          <span className="manual-toolbar-divider" />
          <button data-performance-id="manual-editor.text.align-left" className={`manual-editor-btn icon ${selectedStyle?.textAlign === "left" || selectedStyle?.textAlign === "start" ? "active" : ""}`} title={t.alignLeft} onClick={() => patchSelected((element) => { element.style.textAlign = "left"; })}><AlignLeft size={15} /></button>
          <button data-performance-id="manual-editor.text.align-center" className={`manual-editor-btn icon ${selectedStyle?.textAlign === "center" ? "active" : ""}`} title={t.alignCenter} onClick={() => patchSelected((element) => { element.style.textAlign = "center"; })}><AlignCenter size={15} /></button>
          <button data-performance-id="manual-editor.text.align-right" className={`manual-editor-btn icon ${selectedStyle?.textAlign === "right" || selectedStyle?.textAlign === "end" ? "active" : ""}`} title={t.alignRight} onClick={() => patchSelected((element) => { element.style.textAlign = "right"; })}><AlignRight size={15} /></button>
          <span className="manual-toolbar-divider" />
          {/* Line height and space after are one click each, so they sit on the
              toolbar instead of behind a paragraph popover. */}
          <label className="manual-toolbar-field" title={t.lineHeight}>
            <AlignVerticalSpaceAround size={15} aria-hidden="true" />
            <select className="manual-toolbar-select line-height" aria-label={t.lineHeight} value={selected?.style.lineHeight || "1.2"} onChange={(event) => patchSelected((element) => { element.style.lineHeight = event.target.value; })}>{[1, 1.15, 1.25, 1.5, 1.75, 2, 2.5, 3].map((value) => <option key={value} value={value}>{value}</option>)}</select>
          </label>
          <label className="manual-toolbar-field" title={t.spaceAfter}>
            <AlignVerticalJustifyStart size={15} aria-hidden="true" />
            <select className="manual-toolbar-select space-after" aria-label={t.spaceAfter} value={Number.parseInt(selectedStyle?.marginBottom ?? "0", 10) || 0} onChange={(event) => patchSelected((element) => { element.style.marginBottom = `${event.target.value}px`; })}>{[0, 2, 4, 8, 12, 16, 24, 32].map((value) => <option key={value} value={value}>{value}px</option>)}</select>
          </label>
          <span className="manual-toolbar-divider" />
          <label className="manual-toolbar-color" title={t.textColor}>
            <span className="manual-text-color-sample" style={{ borderBottomColor: textColor }}>A</span>
            <input type="color" value={textColor} onChange={(event) => applyTextStyle("color", event.target.value)} />
          </label>
        </>
      ) : null}

      {selectedIsImage ? (
        <>
          <button data-performance-id="manual-editor.image.replace" className="manual-editor-btn text" disabled={Boolean(cropSession)} onClick={() => { setImageMode("replace"); fileInputRef.current?.click(); }}><ImagePlus size={15} />{t.replaceImage}</button>
          <button data-performance-id="manual-editor.image.crop" className={`manual-editor-btn text ${cropSession ? "active" : ""}`} onClick={() => cropSession ? finishCropRef.current() : startCropRef.current()}><Crop size={15} />{t.cropImage}</button>
          {isCroppedImage(selected) && !cropSession ? (
            <button data-performance-id="manual-editor.image.reset-crop" className="manual-editor-btn text" onClick={resetSelectedCrop}><RotateCcw size={15} />{t.resetCrop}</button>
          ) : null}
        </>
      ) : null}

      {selected && !selectedIsImage ? (
        <>
          <div className="manual-toolbar-popover-anchor">
            <button data-performance-id="manual-editor.fill.toggle" className={`manual-editor-btn icon ${toolbarPopover === "fill" ? "active" : ""}`} title={t.fill} onClick={() => togglePopover("fill")}><span className="manual-color-swatch" style={{ borderBottomColor: fillColor }}><PaintBucket size={15} /></span></button>
            {toolbarPopover === "fill" ? (
              <div className="manual-toolbar-popover compact align-right">
                <label className="manual-color-field"><span>{t.fillColor}</span><input type="color" value={fillColor} onChange={(event) => patchSelected((element) => { element.style.backgroundColor = event.target.value; })} /></label>
                <button data-performance-id="manual-editor.fill.clear" className="manual-popover-action" onClick={() => { patchSelected((element) => { element.style.background = "transparent"; }); setToolbarPopover(null); }}>{t.noFill}</button>
              </div>
            ) : null}
          </div>
          <div className="manual-toolbar-popover-anchor">
            <button data-performance-id="manual-editor.border.toggle" className={`manual-editor-btn icon ${toolbarPopover === "border" ? "active" : ""}`} title={t.border} onClick={() => togglePopover("border")}><span className="manual-color-swatch" style={{ borderBottomColor: borderColor }}><Square size={15} /></span></button>
            {toolbarPopover === "border" ? (
              <div className="manual-toolbar-popover compact align-right">
                <label className="manual-color-field"><span>{t.borderColor}</span><input type="color" value={borderColor} onChange={(event) => patchSelected((element) => { element.style.borderColor = event.target.value; element.style.borderStyle = "solid"; })} /></label>
                <label><span>{t.borderWidth}</span><select value={borderWidth} onChange={(event) => patchSelected((element) => { element.style.borderWidth = `${event.target.value}px`; element.style.borderStyle = Number(event.target.value) > 0 ? "solid" : "none"; })}>{[0, 1, 2, 3, 4, 6, 8].map((value) => <option key={value} value={value}>{value}px</option>)}</select></label>
              </div>
            ) : null}
          </div>
          <span className="manual-toolbar-divider" />
        </>
      ) : null}

      {selected && !cropSession ? (
        <button data-performance-id="manual-editor.element.delete" className="manual-editor-btn icon danger" title={t.deleteElement} onClick={() => { patchSelected((element) => { element.style.visibility = "hidden"; element.dataset.pptEditorDeleted = "true"; }); setSelected(null); }}><Trash2 size={15} /></button>
      ) : null}

      <div className="manual-toolbar-popover-anchor manual-toolbar-more">
        <button data-performance-id="manual-editor.more.toggle" className={`manual-editor-btn icon ${toolbarPopover === "more" ? "active" : ""}`} title={t.more} disabled={Boolean(cropSession)} onClick={() => togglePopover("more")}><MoreHorizontal size={16} /></button>
        {toolbarPopover === "more" ? (
          <div className="manual-toolbar-menu align-right">
            {selected ? <button data-performance-id="manual-editor.selection.select-parent" disabled={!canSelectParent} onClick={selectParent}><Layers size={14} />{t.selectParent}</button> : null}
            <button data-performance-id="manual-editor.restore.request" disabled={!context?.manually_edited} onClick={() => { setToolbarPopover(null); setConfirm({ kind: "restore" }); }}><RotateCcw size={14} />{t.restoreAiVersion}</button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <section className="manual-page-editor">
      <aside className={`manual-editor-filmstrip ${filmstripCollapsed ? "collapsed" : ""}`}>
        <div className="manual-filmstrip-header">
          <button data-performance-id="manual-editor.exit.request" className="manual-editor-btn icon" onClick={requestExit} title={controls.back}><ArrowLeft size={17} /></button>
          {!filmstripCollapsed ? <strong>{t.title}</strong> : null}
          <button data-performance-id="manual-editor.filmstrip.toggle" className="manual-editor-btn icon" onClick={() => setFilmstripCollapsed((value) => !value)} title={filmstripCollapsed ? t.expandPages : t.collapsePages}>{filmstripCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button>
        </div>
        {!filmstripCollapsed ? (
          <div className="manual-filmstrip-scroll">
            {props.pages.map((item, index) => (
              <button data-performance-id="manual-editor.page.select" key={item.pageId} className={`manual-filmstrip-item ${index === pageIndex ? "active" : ""}`} onClick={() => requestSwitch(index)}>
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
              <span>{t.loading}</span>
            </div>
          ) : null}
          {error ? <div className="manual-editor-error">{error}{saveStatus === "conflict" ? <button data-performance-id="manual-editor.conflict.reload" onClick={() => void loadPage(pageIndex)}>{t.reloadLatest}</button> : null}</div> : null}
          {!loading && html ? (
            <div className="manual-editor-stage" style={{ width: 1280 * scale, height: 720 * scale }}>
              <iframe
                ref={iframeRef}
                title={page?.title ?? t.title}
                sandbox="allow-same-origin"
                srcDoc={html}
                onLoad={onIframeLoad}
                style={{ width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: "top left" }}
              />
              {hoverBox ? (
                <div
                  className="manual-editor-hover-outline"
                  style={{
                    left: hoverBox.left * scale,
                    top: hoverBox.top * scale,
                    width: hoverBox.width * scale,
                    height: hoverBox.height * scale,
                  }}
                />
              ) : null}
            </div>
          ) : null}
          {iframeDocument && selected && !cropSession ? createPortal(
            <Moveable
              className={MOVEABLE_EDITOR_CLASS}
              target={selected}
              draggable
              resizable
              origin={false}
              keepRatio={false}
              edge
              throttleDrag={1}
              onDragStart={() => {
                forgetHover();
                dragGestureRef.current = {
                  before: serializeDocument(iframeDocument),
                  startLeft: 0,
                  startTop: 0,
                  localScale: { x: 1, y: 1 },
                  moved: false,
                };
              }}
              onDrag={(event) => {
                const gesture = dragGestureRef.current;
                if (!gesture || !exceedsDragThreshold(event.dist, scale)) return;
                if (!gesture.moved) {
                  promoteToAbsolute(event.target as HTMLElement);
                  if ((event.target as HTMLElement).tagName === "IMG") {
                    (event.target as HTMLElement).style.objectFit = "fill";
                    (event.target as HTMLElement).style.objectPosition = "50% 50%";
                  }
                  gesture.startLeft = Number.parseFloat(event.target.style.left || "0") || 0;
                  gesture.startTop = Number.parseFloat(event.target.style.top || "0") || 0;
                  gesture.localScale = measureLocalScale(event.target as HTMLElement);
                  gesture.moved = true;
                }
                const [dx, dy] = canvasDistance(event.dist, scale);
                event.target.style.left = `${gesture.startLeft + dx / gesture.localScale.x}px`;
                event.target.style.top = `${gesture.startTop + dy / gesture.localScale.y}px`;
              }}
              onDragEnd={() => {
                const gesture = dragGestureRef.current;
                if (gesture?.moved) markMutation(gesture.before);
                dragGestureRef.current = null;
                forgetHover();
              }}
              onResizeStart={() => {
                forgetHover();
                resizeGestureRef.current = {
                  before: serializeDocument(iframeDocument),
                  startLeft: 0,
                  startTop: 0,
                  startWidth: 0,
                  startHeight: 0,
                  localScale: { x: 1, y: 1 },
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
                  // Layout size, so an element with its own transform does not
                  // resize from its painted bounding box.
                  const box = event.target as HTMLElement;
                  gesture.startWidth = box.offsetWidth || box.getBoundingClientRect().width;
                  gesture.startHeight = box.offsetHeight || box.getBoundingClientRect().height;
                  gesture.localScale = measureLocalScale(event.target as HTMLElement);
                  gesture.moved = true;
                }
                const [dw, dh] = canvasDistance(resizeDistance, scale);
                const [dx, dy] = canvasDistance(dragDistance, scale);
                let nextWidth = Math.max(16, gesture.startWidth + dw / gesture.localScale.x);
                let nextHeight = Math.max(16, gesture.startHeight + dh / gesture.localScale.y);
                let nextLeft = gesture.startLeft + dx / gesture.localScale.x;
                let nextTop = gesture.startTop + dy / gesture.localScale.y;
                const direction = event.direction ?? [0, 0];
                const lockRatio = isEditableImage(event.target as HTMLElement) &&
                  Boolean(event.inputEvent?.shiftKey) &&
                  direction[0] !== 0 &&
                  direction[1] !== 0;
                if (lockRatio) {
                  const ratio = gesture.startWidth / gesture.startHeight;
                  const widthChange = Math.abs((nextWidth - gesture.startWidth) / gesture.startWidth);
                  const heightChange = Math.abs((nextHeight - gesture.startHeight) / gesture.startHeight);
                  if (widthChange >= heightChange) nextHeight = Math.max(16, nextWidth / ratio);
                  else nextWidth = Math.max(16, nextHeight * ratio);
                  nextLeft = direction[0] < 0
                    ? gesture.startLeft + gesture.startWidth - nextWidth
                    : gesture.startLeft;
                  nextTop = direction[1] < 0
                    ? gesture.startTop + gesture.startHeight - nextHeight
                    : gesture.startTop;
                }
                event.target.style.width = `${nextWidth}px`;
                event.target.style.height = `${nextHeight}px`;
                event.target.style.left = `${nextLeft}px`;
                event.target.style.top = `${nextTop}px`;
              }}
              onResizeEnd={() => {
                const gesture = resizeGestureRef.current;
                if (gesture?.moved) markMutation(gesture.before);
                resizeGestureRef.current = null;
                forgetHover();
              }}
            />,
            iframeDocument.body,
          ) : null}
          {iframeDocument && cropSession ? createPortal(
            <ManualImageCropOverlay
              session={cropSession}
              canvasScale={scale}
              onChange={(frame, source) => {
                const current = cropSessionRef.current;
                if (!current) return;
                const next = { ...current, frame, source };
                cropSessionRef.current = next;
                setCropSession(next);
              }}
            />,
            iframeDocument.body,
          ) : null}
        </div>
        <div className="manual-editor-status-bar">
          <div className="manual-editor-zoom-control">
            <button data-performance-id="manual-editor.zoom.fit" className={`manual-editor-btn ghost ${zoom === "fit" ? "active" : ""}`} onClick={() => setZoom("fit")}>{t.fitWindow}</button>
            <button data-performance-id="manual-editor.zoom.out" className="manual-editor-btn icon ghost" onClick={() => setZoom(Math.max(0.25, scale - 0.1))} title={t.zoomOut}><ZoomOut size={15} /></button>
            <span>{Math.round(scale * 100)}%</span>
            <button data-performance-id="manual-editor.zoom.in" className="manual-editor-btn icon ghost" onClick={() => setZoom(Math.min(2, scale + 0.1))} title={t.zoomIn}><ZoomIn size={15} /></button>
          </div>
          <div className={`manual-save-status ${saveStatus}`}><span className="manual-save-dot" />{saveStatusLabel}</div>
          <button data-performance-id="manual-editor.save" className="manual-editor-btn primary" onClick={() => void save()} disabled={saveStatus === "saving" || saveStatus === "saved"}><Save size={15} />{controls.save}</button>
        </div>
      </main>
      <input ref={fileInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImage(file); event.currentTarget.value = ""; }} />
      <input ref={fontInputRef} hidden type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFontUpload(file); event.currentTarget.value = ""; }} />
      {confirm ? (
        <div className="manual-editor-confirm-backdrop">
          <div className="manual-editor-confirm">
            <strong>{confirm.kind === "restore" ? t.restoreConfirm.title : t.unsavedConfirm.title}</strong>
            <p>{confirm.kind === "restore" ? t.restoreConfirm.body : t.unsavedConfirm.body}</p>
            {confirm.kind === "restore" ? (
              <div><button data-performance-id="manual-editor.confirm.cancel" onClick={() => void resolveConfirm("cancel")}>{controls.cancel}</button><button data-performance-id="manual-editor.restore.confirm" className="primary" onClick={() => void resolveConfirm("restore")}>{t.restoreConfirm.confirm}</button></div>
            ) : (
              <div><button data-performance-id="manual-editor.exit.cancel" onClick={() => void resolveConfirm("cancel")}>{t.unsavedConfirm.keepEditing}</button><button data-performance-id="manual-editor.exit.discard" onClick={() => void resolveConfirm("discard")}>{t.unsavedConfirm.discard}</button><button data-performance-id="manual-editor.exit.save" className="primary" onClick={() => void resolveConfirm("save")}>{controls.save}</button></div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
