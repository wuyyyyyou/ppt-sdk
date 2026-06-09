interface SlidePreviewLoadingProps {
  compact?: boolean;
}

export function SlidePreviewLoading({ compact = false }: SlidePreviewLoadingProps) {
  return (
    <div className={`slide-preview-loading ${compact ? "compact" : ""}`} aria-label="Loading slide preview">
      <span className={`spinner ${compact ? "tiny" : ""}`} />
    </div>
  );
}
