import { PanelTop } from "lucide-react";
import { BriefPage } from "../features/deck-workspace/components/BriefPage";
import { DeckPage } from "../features/deck-workspace/components/DeckPage";
import { ExportPage } from "../features/deck-workspace/components/ExportPage";
import { GeneratingPage } from "../features/deck-workspace/components/GeneratingPage";
import { LibraryPage } from "../features/deck-workspace/components/LibraryPage";
import { OutlinePage } from "../features/deck-workspace/components/OutlinePage";
import { PanelHeader } from "../features/deck-workspace/components/PanelHeader";
import { ProgressLine } from "../features/deck-workspace/components/ProgressLine";
import { RefinePage } from "../features/deck-workspace/components/RefinePage";
import { ReviewPage } from "../features/deck-workspace/components/ReviewPage";
import { WorkspaceDialog } from "../features/deck-workspace/components/WorkspaceDialog";
import { useDeckWorkspace } from "../features/deck-workspace/hooks/useDeckWorkspace";
import { useI18n } from "../i18n/useI18n";
import { formatSlideNumber } from "../features/deck-workspace/utils";

export function App() {
  const { locale, setLocale, t } = useI18n();
  const { state, actions } = useDeckWorkspace(t, locale);
  const selectedSlide = state.deck[state.currentSlide] ?? state.deck[0];

  return (
    <main className="anna-stage">
      <button
        className={`launcher-btn ${state.panelMode === "closed" ? "visible" : ""}`}
        onClick={() => actions.setPanelMode("visible")}
        aria-label={t.appName}
      >
        <PanelTop size={24} />
      </button>

      <button
        className={`minimized-pill ${state.panelMode === "minimized" ? "visible" : ""}`}
        onClick={() => actions.setPanelMode("visible")}
      >
        <PanelTop size={20} />
        <span>
          {t.appName}
          {state.currentStatus ? <small> · {state.currentStatus}</small> : null}
        </span>
      </button>

      <section className={`deck-panel ${state.panelMode === "visible" ? "visible" : ""}`}>
        <div className={`toast ${state.toast ? "visible" : ""}`}>{state.toast}</div>

        <WorkspaceDialog
          locale={locale}
          scan={state.workspaceScan}
          task={state.currentWorkspace}
          loading={state.workspaceLoading}
          error={state.workspaceError}
          onUseLatest={actions.useLatestWorkspace}
          onCreate={actions.createWorkspace}
          onOpen={actions.openWorkspace}
        />

        <PanelHeader
          t={t}
          locale={locale}
          setLocale={setLocale}
          status={state.currentStatus}
          onLibrary={() => actions.navigate("library")}
          onMinimize={() => actions.setPanelMode("minimized")}
          onClose={() => actions.setPanelMode("closed")}
        />

        {state.page === "main" ? (
          <ProgressLine stage={state.stage} t={t} onNavigate={actions.navigateMain} />
        ) : null}

        <div className="view-container">
          {state.page === "main" && state.stage === "brief" ? (
            <BriefPage
              t={t}
              prompt={state.prompt}
              setPrompt={actions.setPrompt}
              templates={state.templateGroups}
              selectedTemplateGroupId={state.selectedTemplateGroupId}
              loading={state.loading}
              selectTemplate={actions.selectTemplate}
              reviewOutlineFirst={state.reviewOutlineFirst}
              setReviewOutlineFirst={actions.setReviewOutlineFirst}
              contextRows={state.contextRows}
              addContextRow={actions.addContextRow}
              updateContextRow={actions.updateContextRow}
              removeContextRow={actions.removeContextRow}
              addStyleRow={actions.addStyleRow}
              generateDeck={actions.generateDeck}
              cancelGenerateDeck={actions.cancelGenerateDeck}
              createDeckProgress={state.createDeckProgress}
              showToast={actions.showToast}
            />
          ) : null}

          {state.page === "main" && state.stage === "outline" ? (
            <OutlinePage
              t={t}
              outline={state.outline}
              outlineDraft={state.outlineDraft}
              outlineEditMode={state.outlineEditMode}
              beginOutlineEdit={actions.beginOutlineEdit}
              cancelOutlineEdit={actions.cancelOutlineEdit}
              saveOutlineEdit={actions.saveOutlineEdit}
              updateOutlineDraftItem={actions.updateOutlineDraftItem}
              feedback={state.outlineFeedback}
              setFeedback={actions.setOutlineFeedback}
              applyFeedback={actions.applyOutlineFeedback}
              createDeck={actions.createDeckFromOutline}
              cancelGenerateDeck={actions.cancelGenerateDeck}
              createDeckProgress={state.createDeckProgress}
              loading={state.loading}
            />
          ) : null}

          {state.page === "main" && state.stage === "generating" ? (
            <GeneratingPage
              t={t}
              loading={state.loading}
              progress={state.createDeckProgress}
              history={state.generationHistory}
              onCancel={actions.cancelGenerateDeck}
              onBackToOutline={actions.returnToOutlineFromGeneration}
              onRegenerate={actions.regenerateDeck}
              canBackToOutline={state.outline.length > 0}
            />
          ) : null}

          {state.page === "main" && state.stage === "deck" ? (
            <DeckPage
              t={t}
              deckTitle={state.deckTitle}
              setDeckTitle={actions.setDeckTitle}
              deck={state.deck}
              currentSlide={state.currentSlide}
              setCurrentSlide={actions.setCurrentSlide}
              reviewRender={state.reviewRender}
              onRefineDeck={() => {
                actions.setRefineScope("deck");
                actions.navigate("refine");
              }}
              onRefineSlide={() => {
                actions.setRefineScope("slide");
                actions.navigate("refine");
              }}
              onPreview={() => actions.navigate("review")}
              onExport={() => actions.navigate("export")}
            />
          ) : null}

          {state.page === "library" ? (
            <LibraryPage
              t={t}
              locale={locale}
              workspaceScan={state.workspaceScan}
              currentWorkspace={state.currentWorkspace}
              loading={state.workspaceLoading}
              savingSettings={state.workspaceSettingsSaving}
              onBack={actions.goBack}
              onOpen={actions.openWorkspace}
              onCreateWorkspace={actions.createWorkspace}
              onSaveSettings={actions.saveWorkspaceSettings}
              onSaveTitle={actions.saveWorkspaceTitle}
            />
          ) : null}

          {state.page === "review" ? (
            <ReviewPage
              t={t}
              deck={state.deck}
              currentSlide={state.currentSlide}
              setCurrentSlide={actions.setCurrentSlide}
              previewMode={state.previewMode}
              setPreviewMode={actions.setPreviewMode}
              reviewRender={state.reviewRender}
              renderDeckHtml={actions.renderDeckHtml}
              onBack={actions.goBack}
              updateDeckTitle={actions.updateDeckTitle}
              moveSlide={actions.moveSlide}
              duplicateSlide={actions.duplicateSlide}
              deleteSlide={actions.deleteSlide}
              addSlide={actions.addSlide}
              onRefineSlide={(index) => {
                actions.setCurrentSlide(index);
                actions.setRefineScope("slide");
                actions.navigate("refine");
              }}
            />
          ) : null}

          {state.page === "refine" ? (
            <RefinePage
              t={t}
              scope={state.refineScope}
              setScope={actions.setRefineScope}
              slide={selectedSlide}
              slideNumber={formatSlideNumber(state.currentSlide)}
              deckCount={state.deck.length}
              loading={state.loading}
              onBack={actions.goBack}
              onRefineDeck={actions.refineDeck}
              onRefineSlide={actions.refineSlide}
            />
          ) : null}

          {state.page === "export" ? (
            <ExportPage
              t={t}
              status={state.exportStatus}
              artifact={state.exportArtifact}
              loading={state.loading}
              onBack={actions.goBack}
              onExport={actions.exportFile}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
