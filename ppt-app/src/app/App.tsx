import { useMemo, useState } from "react";
import { PanelTop } from "lucide-react";
import { BriefPage } from "../features/deck-workspace/components/BriefPage";
import { DeckPage } from "../features/deck-workspace/components/DeckPage";
import { ExportPage } from "../features/deck-workspace/components/ExportPage";
import { GeneratingPage } from "../features/deck-workspace/components/GeneratingPage";
import { LibraryPage } from "../features/deck-workspace/components/LibraryPage";
import { OutlinePage } from "../features/deck-workspace/components/OutlinePage";
import { PanelHeader } from "../features/deck-workspace/components/PanelHeader";
import { ProgressLine } from "../features/deck-workspace/components/ProgressLine";
import { ReviewPage } from "../features/deck-workspace/components/ReviewPage";
import { RefinePage } from "../features/deck-workspace/components/RefinePage";
import {
  confirmedRequirementsAllowOutline,
  PresentationRequirementsPage,
} from "../features/requirements";
import { WorkspaceDialog } from "../features/deck-workspace/components/WorkspaceDialog";
import { useDeckWorkspace } from "../features/deck-workspace/hooks/useDeckWorkspace";
import { useI18n } from "../i18n/useI18n";
import { ManualPageEditorShell } from "../features/manual-page-editor/ManualPageEditorShell";

export function App() {
  const { locale, setLocale, t } = useI18n();
  const { state, actions } = useDeckWorkspace(t, locale);
  const [manualEditorOpen, setManualEditorOpen] = useState(false);
  const manualEditorPages = useMemo(() => {
    const rendered = state.reviewRender.result?.slides ?? [];
    const progressPages = state.pageProgress?.pages ?? [];
    return progressPages.map((item, index) => ({
      pageId: item.page_id,
      title: state.deck[index]?.title ?? state.outline[index]?.title ?? item.page_id,
      screenshotUrl: rendered[index]?.screenshot_upload?.url,
    }));
  }, [state.deck, state.outline, state.pageProgress, state.reviewRender.result]);
  const refineSlideIndex = state.deck.length > 0
    ? Math.min(Math.max(state.currentSlide, 0), state.deck.length - 1)
    : 0;
  const refineSlide = state.deck[refineSlideIndex] ?? (
    state.outline[refineSlideIndex]
      ? { title: state.outline[refineSlideIndex].title, subtitle: "" }
      : null
  );

  if (manualEditorOpen && state.currentWorkspace?.workspace_dir && manualEditorPages.length > 0) {
    return (
      <ManualPageEditorShell
        workspaceDir={state.currentWorkspace.workspace_dir}
        pages={manualEditorPages}
        initialPageIndex={state.currentSlide}
        onPageUpdated={actions.applyManualPageUpdate}
        onExit={async (requiresDeckRender) => {
          setManualEditorOpen(false);
          if (requiresDeckRender) await actions.renderDeckHtml();
        }}
      />
    );
  }

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
          navigationDisabled={state.stage === "generating" && state.generationViewState.isActive}
          onHome={() => void actions.showWorkspacePicker()}
        />

        {state.page === "main" ? (
          <ProgressLine
            stage={state.stage}
            t={t}
            outlineEnabled={confirmedRequirementsAllowOutline(state.currentWorkspace?.requirements)}
            onNavigate={actions.navigateMain}
          />
        ) : null}

        <div className="view-container">
          {state.page === "main" && state.stage === "brief" ? (
            <BriefPage
              t={t}
              prompt={state.prompt}
              setPrompt={actions.setPrompt}
              loading={state.loading}
              pageReviewSettings={state.pageReviewSettings}
              setStrictReviewMode={actions.setStrictReviewMode}
              workspaceSettingsSaving={state.workspaceSettingsSaving}
              generateDeck={actions.generatePresentationRequirements}
              selectedVisualStylePresetId={state.selectedVisualStylePresetId}
              onSelectVisualStylePreset={actions.selectVisualStylePreset}
            />
          ) : null}

          {state.page === "main" && state.stage === "requirements" ? (
            <PresentationRequirementsPage
              t={t}
              brief={state.presentationRequirements.source?.brief ?? state.prompt}
              requirements={state.presentationRequirements}
              status={state.requirementsStatus}
              error={state.requirementsError}
              saving={state.requirementsSaving}
              confirming={state.requirementsConfirming}
              dirty={state.requirementsDirty}
              hasSavedDraft={state.requirementsHasSavedDraft}
              onSelect={actions.selectPresentationRequirement}
              onRetry={() => void actions.generatePresentationRequirements()}
              onManual={() => void actions.useManualPresentationRequirements()}
              onBack={actions.returnToBriefFromRequirements}
              onSave={() => void actions.savePresentationRequirements()}
              onConfirm={() => void actions.confirmPresentationRequirements()}
            />
          ) : null}

          {state.page === "main" && state.stage === "outline" ? (
            <OutlinePage
              t={t}
              title={state.outlineDraftTitle}
              outline={state.outlineDraft}
              dirty={state.outlineDirty}
              saving={state.outlineSaving}
              error={state.outlineError}
              setTitle={actions.setOutlineDraftTitle}
              updateItem={actions.updateOutlineDraftItem}
              addItem={actions.addOutlineDraftItem}
              insertItem={actions.insertOutlineDraftItem}
              deleteItem={actions.deleteOutlineDraftItem}
              moveItem={actions.moveOutlineDraftItem}
              save={actions.saveOutlineDraft}
              retry={actions.retryOutlineCreation}
              backToRequirements={actions.returnToRequirementsFromOutline}
              feedback={state.outlineFeedback}
              setFeedback={actions.setOutlineFeedback}
              applyFeedback={actions.applyOutlineFeedback}
              confirm={actions.createDeckFromOutline}
              loading={state.loading}
            />
          ) : null}

          {state.page === "main" && state.stage === "generating" ? (
            <GeneratingPage
              t={t}
              viewState={state.generationViewState}
              progress={state.createDeckProgress}
              history={state.generationHistory}
              onCancel={actions.cancelGenerateDeck}
              onBackToOutline={actions.returnToOutlineFromGeneration}
              onResume={actions.resumeDeckGeneration}
              canBackToOutline={state.outline.length > 0}
            />
          ) : null}

          {state.page === "main" && state.stage === "deck" ? (
            <DeckPage
              t={t}
              deck={state.deck}
              currentSlide={state.currentSlide}
              setCurrentSlide={actions.setCurrentSlide}
              reviewRender={state.reviewRender}
              loading={state.loading}
              onRefreshPreview={() => {
                void actions.renderDeckHtml();
              }}
              onPreview={() => actions.navigate("review")}
              onRefineSlide={actions.openRefineSlide}
              onRefineDeck={actions.openRefineDeck}
              onExport={() => actions.navigate("export")}
              onEdit={() => setManualEditorOpen(true)}
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
              pageReviewSettings={state.pageReviewSettings}
              onBack={actions.goBack}
              onOpen={actions.openWorkspace}
              onCreateWorkspace={actions.createWorkspace}
              onSaveSettings={actions.saveWorkspaceSettings}
              onSaveTitle={actions.saveWorkspaceTitle}
              workspaceDiagnosticBundle={state.workspaceDiagnosticBundle}
              onPrepareWorkspaceDiagnosticBundle={actions.prepareWorkspaceDiagnosticBundle}
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
              onEdit={() => setManualEditorOpen(true)}
            />
          ) : null}

          {state.page === "refine" && refineSlide ? (
            <RefinePage
              t={t}
              deck={state.deck}
              slide={refineSlide}
              slideIndex={refineSlideIndex}
              slideNumber={String(refineSlideIndex + 1)}
              refineScope={state.refineScope}
              reviewRender={state.reviewRender}
              loading={state.loading}
              onBack={actions.goBack}
              onRefineDeck={(instruction) => void actions.refineDeck(instruction)}
              onRefineSlide={(instruction) => void actions.refineSlide(instruction)}
            />
          ) : null}

          {state.page === "export" ? (
            <ExportPage
              t={t}
              progress={state.exportProgress}
              artifact={state.exportArtifact}
              download={state.exportDownload}
              loading={state.loading}
              onBack={actions.goBack}
              onExport={actions.exportFile}
              onDownload={actions.downloadExportArtifact}
            />
          ) : null}

        </div>
      </section>
    </main>
  );
}
