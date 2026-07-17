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
import { StyleProfileCreationPage } from "../features/deck-workspace/components/StyleProfilePage";
import { UploadedSourceAnalysisPage } from "../features/deck-workspace/components/UploadedSourceAnalysisPage";
import {
  confirmedRequirementsAllowOutline,
  PresentationRequirementsPage,
} from "../features/requirements";
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

        {state.page !== "style-profile-creation" ? (
          <WorkspaceDialog
            locale={locale}
            scan={state.workspaceScan}
            task={state.currentWorkspace}
            loading={state.workspaceLoading}
            error={state.workspaceError}
            onUseLatest={actions.useLatestWorkspace}
            onCreate={actions.createWorkspace}
            onCreateStyleProfile={actions.openStyleProfileCreation}
            onOpen={actions.openWorkspace}
          />
        ) : null}

        <PanelHeader
          t={t}
          locale={locale}
          setLocale={setLocale}
          status={state.currentStatus}
          onLibrary={() => actions.navigate("library")}
          navigationDisabled={
            (state.stage === "generating" && state.generationViewState.isActive) ||
            (
              state.stage === "uploaded-source-analysis" &&
              state.uploadedSourceAnalysisProgress.status === "running"
            )
          }
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
              templates={state.templateGroups}
              selectedTemplateGroupId={state.selectedTemplateGroupId}
              styleProfiles={state.styleProfiles}
              styleProfilePreviews={state.styleProfilePreviews}
              selectedStyleProfile={state.selectedStyleProfile}
              styleProfileLibraryLoading={state.styleProfileLibraryLoading}
              styleProfileLibraryError={state.styleProfileLibraryError}
              styleProfileDetail={state.styleProfileDetail}
              loading={state.loading}
              selectTemplate={actions.selectTemplate}
              refreshStyleProfiles={actions.refreshStyleProfiles}
              loadStyleProfilePreview={actions.loadStyleProfilePreview}
              openStyleProfileDetail={actions.openStyleProfileDetail}
              closeStyleProfileDetail={actions.closeStyleProfileDetail}
              selectStyleProfile={actions.selectStyleProfile}
              clearStyleProfile={actions.clearStyleProfile}
              pageReviewSettings={state.pageReviewSettings}
              setStrictReviewMode={actions.setStrictReviewMode}
              researchSearchControlSettings={state.researchSearchControlSettings}
              workspaceSettingsSaving={state.workspaceSettingsSaving}
              setResearchSearchControlSettings={actions.setResearchSearchControlSettings}
              uploadedSources={state.uploadedSources}
              uploadUploadedSource={actions.uploadUploadedSource}
              removeUploadedSource={actions.removeUploadedSource}
              generateDeck={actions.generatePresentationRequirements}
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

          {state.page === "main" && state.stage === "uploaded-source-analysis" ? (
            <UploadedSourceAnalysisPage
              t={t}
              progress={state.uploadedSourceAnalysisProgress}
              viewState={state.uploadedSourceAnalysisState}
              onReturnToBrief={actions.returnToBriefFromUploadedSourceAnalysis}
              onRetry={actions.retryUploadedSourceAnalysis}
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
              onRefineDeck={() => {
                void actions.openRefineDeck();
              }}
              onRefineSlide={() => {
                void actions.openRefineSlide();
              }}
              onRewriteSlide={actions.rewriteCurrentSlide}
              onChangeSlideLayout={actions.changeCurrentSlideLayout}
              onRefreshPreview={() => {
                void actions.renderDeckHtml();
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
              pageReviewSettings={state.pageReviewSettings}
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
                void actions.openRefineSlide(index);
              }}
            />
          ) : null}

          {state.page === "refine" ? (
            <RefinePage
              t={t}
              deck={state.deck}
              slide={selectedSlide}
              slideIndex={state.currentSlide}
              slideNumber={formatSlideNumber(state.currentSlide)}
              refineScope={state.refineScope}
              reviewRender={state.reviewRender}
              loading={state.loading}
              researchSearchControlSettings={state.researchSearchControlSettings}
              workspaceSettingsSaving={state.workspaceSettingsSaving}
              onBack={actions.goBack}
              setResearchSearchControlSettings={actions.setResearchSearchControlSettings}
              onRefineDeck={actions.refineDeck}
              onRefineSlide={actions.refineSlide}
            />
          ) : null}

          {state.page === "export" ? (
            <ExportPage
              t={t}
              progress={state.exportProgress}
              artifact={state.exportArtifact}
              loading={state.loading}
              onBack={actions.goBack}
              onExport={actions.exportFile}
            />
          ) : null}

          {state.page === "style-profile-creation" ? (
            <StyleProfileCreationPage
              creation={state.styleProfileCreation}
              profiles={state.styleProfiles}
              previews={state.styleProfilePreviews}
              libraryLoading={state.styleProfileLibraryLoading}
              libraryError={state.styleProfileLibraryError}
              detail={state.styleProfileDetail}
              onBack={actions.showWorkspacePicker}
              onNameChange={actions.setStyleProfileCreationName}
              onFilesChange={actions.setStyleProfileCreationFiles}
              onStart={actions.startStyleProfileCreation}
              onRetry={actions.retryStyleProfileAnalysis}
              onStop={actions.stopStyleProfileCreation}
              onReset={actions.resetStyleProfileCreation}
              onRefreshLibrary={actions.refreshStyleProfiles}
              onLoadPreview={actions.loadStyleProfilePreview}
              onOpenDetail={actions.openStyleProfileDetail}
              onCloseDetail={actions.closeStyleProfileDetail}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
