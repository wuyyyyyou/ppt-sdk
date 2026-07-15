import { useMemo } from "react";
import type { PresentationDocument } from "../../api/types";
import { PresentationRenderer } from "./PresentationRenderer";

interface BasicPresentationStageProps {
  document: PresentationDocument;
  currentSlide: number;
  imageAssets?: Record<string, string>;
}

/**
 * Read-only structured preview stage used by the main deck page. All manual
 * editing lives exclusively in the full-screen advanced editor.
 */
export function BasicPresentationStage(props: BasicPresentationStageProps) {
  const slides = useMemo(
    () => [...props.document.slides].sort((left, right) => left.order - right.order),
    [props.document.slides],
  );
  const slide = slides[props.currentSlide] ?? slides[0];

  if (!slide) return null;

  return (
    <div className="basic-presentation-stage mode-preview">
      <div className="deck-stage-html-frame structured">
        <PresentationRenderer
          slide={slide}
          width={props.document.width}
          height={props.document.height}
          mode="preview"
          imageAssets={props.imageAssets}
        />
      </div>
    </div>
  );
}
