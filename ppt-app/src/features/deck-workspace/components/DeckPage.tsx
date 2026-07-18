import { RefreshCw } from "lucide-react";
import type { Slide } from "../../../data/mockDeck";
import type { Messages } from "../../../i18n/messages";
import type { DeckReviewRenderState } from "../types";
import { SlidePreviewNavigator } from "./SlidePreviewNavigator";

interface DeckPageProps {
  t: Messages;
  deck: Slide[];
  currentSlide: number;
  setCurrentSlide: (index: number) => void;
  reviewRender: DeckReviewRenderState;
  loading: string;
  onRefreshPreview: () => void;
  onPreview: () => void;
  onExport: () => void;
}

export type SlideLayoutMode = "simpler" | "visual" | "comparison" | "process" | "report";

export function DeckPage(props: DeckPageProps) {
  const refreshDisabled = props.reviewRender.status === "loading" || props.loading === "review";
  return (
    <section className="page active deck-page">
      <div className="deck-top-actions">
        <button
          className="secondary-btn compact"
          onClick={props.onRefreshPreview}
          disabled={refreshDisabled}
          title={props.t.review.renderAgain}
        >
          <RefreshCw size={14} />
          {props.t.review.renderAgain}
        </button>
      </div>
      <SlidePreviewNavigator
        t={props.t}
        deck={props.deck}
        currentSlide={props.currentSlide}
        setCurrentSlide={props.setCurrentSlide}
        reviewRender={props.reviewRender}
      />
      <div className="action-bar">
        <button className="secondary-btn" onClick={props.onPreview}>{props.t.controls.preview}</button>
        <button className="secondary-btn" onClick={props.onExport}>{props.t.controls.export}</button>
      </div>
    </section>
  );
}
