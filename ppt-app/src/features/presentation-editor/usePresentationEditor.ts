import { useCallback, useEffect, useRef, useState } from "react";
import type { PptBackend } from "../../api/pptBackend";
import type {
  AppPresentationResult,
  PresentationDocument,
  PresentationElement,
} from "../../api/types";

export type PresentationEditorSaveStatus =
  | "saved"
  | "saving"
  | "unsaved"
  | "conflict"
  | "error";

interface HistoryState {
  past: PresentationDocument[];
  future: PresentationDocument[];
}

export function usePresentationEditor(
  backend: PptBackend | null,
  workspaceDir: string | null,
) {
  const [result, setResult] = useState<AppPresentationResult | null>(null);
  const [document, setDocument] = useState<PresentationDocument | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "readonly" | "error">("idle");
  const [saveStatus, setSaveStatus] = useState<PresentationEditorSaveStatus>("saved");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });
  const documentRef = useRef<PresentationDocument | null>(null);
  const resultRef = useRef<AppPresentationResult | null>(null);
  const savePromiseRef = useRef<Promise<AppPresentationResult | null> | null>(null);

  useEffect(() => {
    setResult(null);
    setDocument(null);
    setStatus("idle");
    setSaveStatus("saved");
    setError("");
    setHistory({ past: [], future: [] });
    documentRef.current = null;
    resultRef.current = null;
    savePromiseRef.current = null;
  }, [workspaceDir]);

  const acceptResult = useCallback((next: AppPresentationResult) => {
    setResult(next);
    setDocument(next.revision.document);
    resultRef.current = next;
    documentRef.current = next.revision.document;
    setStatus("ready");
    setSaveStatus("saved");
    setError("");
    // Undo/redo only applies to the current unsaved edits: once a revision
    // is persisted (or loaded/restored), the history is discarded.
    setHistory({ past: [], future: [] });
  }, []);

  const load = useCallback(async () => {
    if (!backend || !workspaceDir) return null;
    setStatus("loading");
    setError("");
    try {
      const next = await backend.getPresentation({ workspace_dir: workspaceDir });
      acceptResult(next);
      return next;
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Structured preview is unavailable.";
      setStatus("readonly");
      setError(message);
      return null;
    }
  }, [acceptResult, backend, workspaceDir]);

  const replaceDocument = useCallback((
    update: (current: PresentationDocument) => PresentationDocument,
  ) => {
    const current = documentRef.current;
    if (!current) return;
    const next = update(structuredClone(current));
    setHistory((value) => ({
      past: [...value.past, current].slice(-50),
      future: [],
    }));
    setDocument(next);
    documentRef.current = next;
    setSaveStatus("unsaved");
  }, []);

  const updateElement = useCallback((
    slideId: string,
    elementId: string,
    update: (element: PresentationElement) => void,
  ) => {
    replaceDocument((current) => {
      const slide = current.slides.find((item) => item.id === slideId);
      const element = slide?.elements.find((item) => item.id === elementId);
      if (element) update(element);
      return current;
    });
  }, [replaceDocument]);

  const updateElementTransient = useCallback((
    slideId: string,
    elementId: string,
    update: (element: PresentationElement) => void,
  ) => {
    const current = documentRef.current;
    if (!current) return;
    const next = structuredClone(current);
    const slide = next.slides.find((item) => item.id === slideId);
    const element = slide?.elements.find((item) => item.id === elementId);
    if (element) update(element);
    setDocument(next);
    documentRef.current = next;
    setSaveStatus("unsaved");
  }, []);

  const save = useCallback(async () => {
    if (savePromiseRef.current) return savePromiseRef.current;
    if (!backend || !workspaceDir || !documentRef.current || !resultRef.current) {
      return resultRef.current;
    }
    // Identity check instead of saveStatus state: a commit immediately followed
    // by Ctrl/Cmd+S runs before React re-renders, so the state would be stale.
    if (documentRef.current === resultRef.current.revision.document) {
      return resultRef.current;
    }
    setSaveStatus("saving");
    const operation = (async () => {
    try {
      // Keep saving until the latest local document has been persisted:
      // edits can still land while a request is in flight.
      while (true) {
        const currentDocument = documentRef.current!;
        const next = await backend.savePresentation({
          workspace_dir: workspaceDir,
          base_revision: resultRef.current!.revision.revision,
          document: currentDocument,
        });
        setResult(next);
        resultRef.current = next;
        if (documentRef.current === currentDocument) {
          acceptResult(next);
          return next;
        }
      }
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save presentation.";
      const conflict = /revision conflict/i.test(message);
      setSaveStatus(conflict ? "conflict" : "error");
      setError(message);
      throw saveError;
    }
    })();
    savePromiseRef.current = operation;
    try {
      return await operation;
    } finally {
      if (savePromiseRef.current === operation) savePromiseRef.current = null;
    }
  }, [acceptResult, backend, workspaceDir]);

  const restore = useCallback(async () => {
    if (!backend || !workspaceDir) return null;
    setSaveStatus("saving");
    try {
      const next = await backend.restorePresentation({ workspace_dir: workspaceDir });
      acceptResult(next);
      return next;
    } catch (restoreError) {
      const message = restoreError instanceof Error ? restoreError.message : "Unable to restore presentation.";
      setSaveStatus("error");
      setError(message);
      throw restoreError;
    }
  }, [acceptResult, backend, workspaceDir]);

  const undo = useCallback(() => {
    setHistory((value) => {
      const previous = value.past.at(-1);
      const current = documentRef.current;
      if (!previous || !current) return value;
      documentRef.current = previous;
      setDocument(previous);
      setSaveStatus("unsaved");
      return { past: value.past.slice(0, -1), future: [current, ...value.future].slice(0, 50) };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((value) => {
      const next = value.future[0];
      const current = documentRef.current;
      if (!next || !current) return value;
      documentRef.current = next;
      setDocument(next);
      setSaveStatus("unsaved");
      return { past: [...value.past, current].slice(-50), future: value.future.slice(1) };
    });
  }, []);

  return {
    state: {
      result,
      document,
      status,
      saveStatus,
      error,
      imageAssets: result?.image_assets ?? {},
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    },
    actions: {
      load,
      save,
      restore,
      replaceDocument,
      updateElement,
      updateElementTransient,
      undo,
      redo,
    },
  };
}
