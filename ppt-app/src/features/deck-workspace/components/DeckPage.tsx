import { ArrowLeft, Download, Edit3, Eye } from "lucide-react";
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
  onPreview: () => void;
  onBack: () => void;
  onRefineSlide: () => void;
  onRefineDeck: () => void;
  onExport: () => void;
  onEdit: () => void;
}

export type SlideLayoutMode = "simpler" | "visual" | "comparison" | "process" | "report";

export function DeckPage(props: DeckPageProps) {
  return (
    <section className="page active deck-page">
      <div className="deck-top-actions">
        <button className="secondary-btn deck-back-btn" type="button" onClick={() => props.onBack()}>
          <ArrowLeft size={16} aria-hidden="true" />{props.t.controls.back}
        </button>
        <button className="secondary-btn compact" onClick={() => props.onRefineSlide()}>
          {props.t.controls.refineSlide}
        </button>
        <button className="secondary-btn compact" onClick={() => props.onRefineDeck()}>
          {props.t.controls.refineDeck}
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
        <button
          className="secondary-btn"
          onClick={props.onEdit}
          title={props.t.controls.edit}
          aria-label={props.t.controls.edit}
        >
          <Edit3 size={14} aria-hidden="true" />
          {props.t.controls.edit}
        </button>
        <button className="secondary-btn" onClick={props.onPreview}>
          <Eye size={14} aria-hidden="true" />
          {props.t.controls.preview}
        </button>
        <button className="secondary-btn" onClick={props.onExport}>
          <Download size={14} aria-hidden="true" />
          {props.t.controls.export}
        </button>
      </div>
    </section>
  );
}
