export type Locale = "en" | "zh";

export interface Messages {
  appName: string;
  languageName: string;
  controls: {
    library: string;
    collapseSidebar: string;
    expandSidebar: string;
    minimize: string;
    close: string;
    back: string;
    forward: string;
    backToLastVersion: string;
    open: string;
    edit: string;
    cancel: string;
    save: string;
    suggestions: string;
    createDeck: string;
    updateDeck: string;
    updateOutline: string;
    createOutline: string;
    createDeckFromOutline: string;
    confirmOutline: string;
    reviseOutline: string;
    refineDeck: string;
    refineSlide: string;
    rewriteSlide: string;
    changeLayout: string;
    layoutSimpler: string;
    layoutVisual: string;
    layoutComparison: string;
    layoutProcess: string;
    layoutReport: string;
    preview: string;
    export: string;
    applyToDeck: string;
    applyToSlide: string;
    revealInFinder: string;
    chooseFile: string;
    addSlide: string;
    duplicate: string;
    delete: string;
    retryPage: string;
    resumeGeneration: string;
    resumeRefinement: string;
    pptx: string;
    pdf: string;
    useTemplate: string;
    disableWebResearch: string;
    disableImageResearch: string;
    stop: string;
  };
  stages: {
    template: string;
    brief: string;
    requirements: string;
    uploadedSourceAnalysis: string;
    outline: string;
    generating: string;
    deck: string;
  };
  progressStages: {
    brief: string;
    requirements: string;
    outline: string;
    generating: string;
    deck: string;
  };
  status: {
    draftReady: string;
    outlineReady: string;
    creatingOutline: string;
    analyzingUploadedSource: string;
    creatingDeck: string;
    refiningDeck: string;
    refiningSlide: string;
    deckRefined: string;
    slideRefined: string;
    exporting: string;
    settingsSaved: string;
  };
  brief: {
    title: string;
    placeholder: string;
    strictReviewMode: string;
    strictReviewModeHelp: string;
    strictReviewConfirmTitle: string;
    strictReviewConfirmBody: string;
    strictReviewConfirmAction: string;
    optionalContext: string;
    chips: Record<"audience" | "goal" | "style" | "theme" | "content" | "attachment" | "template", string>;
    contextLabels: Record<
      | "audience"
      | "goal"
      | "styleNotes"
      | "theme"
      | "contentSource"
      | "attachment"
      | "slides"
      | "textPerSlide"
      | "outputLanguage"
      | "look",
      string
    >;
    contextDefaults: {
      audience: string;
      goal: string;
      styleNotes: string;
      contentSource: string;
      attachmentPlaceholder: string;
      outputLanguage: string;
    };
    contextPlaceholders: {
      audience: string;
      goal: string;
      styleNotes: string;
      contentSource: string;
    };
    uploadedSourceStatus: {
      pending: string;
      stale: string;
      analyzing: string;
      ready: string;
      readyWithCounts: string;
      gap: string;
      gapWithCount: string;
      blocked: string;
      error: string;
      duplicate: string;
    };
  };
  requirements: {
    title: string;
    helper: string;
    briefLabel: string;
    loadingTitle: string;
    loadingBody: string;
    errorTitle: string;
    errorBody: string;
    retry: string;
    manual: string;
    back: string;
    confirm: string;
    confirming: string;
    saving: string;
    saved: string;
    unsaved: string;
    recommended: string;
    other: string;
    templateLocked: string;
    groups: Record<"content" | "specifications" | "visual", string>;
    fields: Record<"audience" | "purpose" | "desired_outcome" | "slide_count" | "output_language" | "visual_tone", string>;
    customPlaceholders: Record<"audience" | "purpose" | "desired_outcome" | "slide_count" | "output_language" | "visual_tone", string>;
  };
  template: {
    title: string;
    helper: string;
    none: string;
    noneSelected: string;
    loading: string;
    empty: string;
    layouts: string;
    selected: string;
    viewAll: string;
    previewTitle: string;
    pageCounter: string;
    previous: string;
    next: string;
    close: string;
  };
  outline: {
    title: string;
    helper: string;
    cardTitle: string;
    saveChanges: string;
    feedbackTitle: string;
    feedbackPlaceholder: string;
    presentationTitle: string;
    pageTitle: string;
    coreMessage: string;
    requiredContent: string;
    requiredContentHint: string;
    requiredContentCount: string;
    expandAll: string;
    collapseAll: string;
    addPage: string;
    deletePage: string;
    moveUp: string;
    moveDown: string;
    undo: string;
    deleted: string;
    saving: string;
    unsaved: string;
    saved: string;
    loadingTitle: string;
    loadingBody: string;
    errorTitle: string;
    retry: string;
    backToRequirements: string;
  };
  uploadedSourceAnalysis: {
    title: string;
    running: string;
    completed: string;
    skipped: string;
    failed: string;
    blocked: string;
    noSources: string;
    stale: string;
    sourceCount: string;
    resultSummary: string;
    retry: string;
    returnToBrief: string;
    records: Record<"prepare" | "factual" | "visual" | "merge", string>;
    messages: Record<
      | "idle"
      | "prepare"
      | "factual"
      | "visual"
      | "merge"
      | "completed"
      | "skipped"
      | "failed"
      | "blocked",
      string
    >;
    summaryLabels: Record<"facts" | "visualAssets" | "gaps" | "rejected" | "reason", string>;
  };
  generating: {
    progressTitle: string;
    preparingTitle: string;
    confirmingOutline: string;
    generationComplete: string;
    interruptedTitle: string;
    unresumableTitle: string;
    stoppingTitle: string;
    stoppingDescription: string;
    stayOnPageHint: string;
    pagesPassed: string;
    pageLabel: string;
    pageSummary: {
      label: string;
      accepted: string;
      running: string;
      pending: string;
      failed: string;
      total: string;
    };
    abandon: {
      generationTitle: string;
      refinementTitle: string;
      generationBody: string;
      refinementBody: string;
      generationCancel: string;
      refinementCancel: string;
      confirm: string;
      generationStopped: string;
      refinementStopped: string;
      failed: string;
      home: {
        generationTitle: string;
        refinementTitle: string;
        generationBody: string;
        refinementBody: string;
        preparationTitle: string;
        preparationBody: string;
        preparationCancel: string;
        confirm: string;
      };
    };
    commitFailed: {
      title: string;
      body: string;
      restored: string;
      confirm: string;
    };
    steps: {
      outline: string;
      pagePlan: string;
      researchDiscovery: string;
      prepare: string;
      pages: string;
      finalRender: string;
    };
    preview: {
      title: string;
      waiting: string;
      thumbnails: string;
      loading: string;
      failed: string;
      untitledPage: string;
      selectPage: string;
      latest: string;
      followingLatest: string;
      backToLatest: string;
    };
    persistentElements: {
      title: string;
      session: string;
    };
    researchDiscovery: {
      title: string;
      empty: string;
      warning: string;
      statuses: Record<"waiting" | "running" | "completed" | "skipped" | "warning", string>;
      queries: string;
      sources: string;
      visualAssets: string;
      gaps: string;
      rejected: string;
      summary: string;
      untitledSource: string;
      resultCount: string;
      fetchCount: string;
      downloadCount: string;
      visualEvidenceNote: string;
      queryStatuses: Record<"running" | "collected" | "gap" | "error" | "skipped_duplicate", string>;
      activities: Record<
        | "webDecision"
        | "webSearch"
        | "webFetchSelection"
        | "webFetch"
        | "webSynthesis"
        | "webPublish"
        | "webComplete"
        | "webSkipped"
        | "imageDecision"
        | "imageSearch"
        | "imageDeduplication"
        | "imageDownload"
        | "imagePrepare"
        | "imageAnalysis"
        | "imageImport"
        | "imagePublish"
        | "imageComplete"
        | "imageSkipped",
        string
      >;
      counts: Record<"facts" | "derivedInsights" | "visualAssets" | "gaps" | "rejectedMaterial", string>;
      phases: Record<
        | "web-decision"
        | "web-collection"
        | "visual-decision"
        | "visual-collection",
        string
      >;
    };
    currentSessionStream: string;
    sessionHistory: string;
    waitingForStep: string;
    noStream: string;
    streamHint: string;
    stageRecords: {
      expand: string;
      collapse: string;
      noOutput: string;
      activities: string;
      stream: string;
      running: string;
      completed: string;
      failed: string;
      pending: string;
      pageStatuses: Record<
        | "pending"
        | "researchCollecting"
        | "researchCurating"
        | "authoring"
        | "rendering"
        | "renderFixing"
        | "visualReview"
        | "visualReviewFixing"
        | "accepted"
        | "renderFailed"
        | "agentFailed"
        | "needsUserReview"
        | "agentInfrastructureFailed"
        | "interrupted"
        | "cancelled"
        | "unknown",
        string
      >;
      stages: Record<
        | "pagePlan"
        | "researchPlanning"
        | "researchDiscovery"
        | "researchCollection"
        | "researchCuration"
        | "evidencePagePlanning"
        | "webResearchCuration"
        | "visualResearchCuration"
        | "prepare"
        | "persistentElements"
        | "authoring"
        | "deckRefinement"
        | "rendering"
        | "renderFix"
        | "visualReview"
        | "visualReviewFix"
        | "finalRender"
        | "accepted"
        | "failed"
        | "pending"
        | "unknown",
        string
      >;
    };
    cancelled: string;
    cancelling: string;
  };
  deck: {
    title: string;
    subtitle: string;
    slideCounter: string;
    previousSlide: string;
    nextSlide: string;
  };
  library: {
    title: string;
    workspace: string;
    workspacePath: string;
    currentWorkspace: string;
    noWorkspaceSelected: string;
    empty: string;
    createWorkspace: string;
    defaultWorkspaceTitle: string;
    preferences: string;
    runtimeInfoTitle: string;
    annaDeckVersion: string;
    pptEngineVersion: string;
    runtimeInfoUnavailable: string;
    agentResourceInfoTitle: string;
    agentResourceInfoDescription: string;
    agentResourceInfoRefresh: string;
    agentResourceInfoRefreshing: string;
    agentResourceInfoUnavailable: string;
    agentResourceInfoSystem: string;
    agentResourceInfoProcess: string;
    agentResourceInfoCpuUsage: string;
    agentResourceInfoProcessCpuUsage: string;
    agentResourceInfoConfiguredCores: string;
    agentResourceInfoVisibleCores: string;
    agentResourceInfoMemoryUsage: string;
    agentResourceInfoProcessMemory: string;
    agentResourceInfoPlatform: string;
    agentResourceInfoNode: string;
    agentResourceInfoLoadAverage: string;
    agentResourceInfoSampledAt: string;
    agentResourceInfoCgroupLimit: string;
    agentResourceInfoSystemVisible: string;
    agentResourceInfoUnknown: string;
    lastEditedToday: string;
    lastEditedYesterday: string;
    lastEditedDate: string;
    diagnosticBundleTitle: string;
    diagnosticBundleDescription: string;
    diagnosticBundleSensitiveHint: string;
    diagnosticBundleNoWorkspace: string;
    diagnosticBundleDownload: string;
    diagnosticBundleDownloadStarted: string;
    diagnosticBundleDownloadStartedWithLink: string;
    diagnosticBundleDownloadFallbackHint: string;
    diagnosticBundlePreparing: string;
    diagnosticBundleRefresh: string;
    diagnosticBundleRetry: string;
    diagnosticBundleReady: string;
    diagnosticBundleExpired: string;
    diagnosticBundleFailed: string;
    diagnosticBundleFailedPrefix: string;
    diagnosticBundleLinkLabel: string;
    diagnosticBundleCopyLink: string;
    diagnosticBundleLinkCopied: string;
  };
  performance: {
    title: string;
    description: string;
    unavailable: string;
    loading: string;
    active: string;
    inactive: string;
    start: string;
    finish: string;
    abandon: string;
    history: string;
    empty: string;
    viewReport: string;
    regenerateReport: string;
    deleteRun: string;
    refresh: string;
    events: string;
    integrity: string;
    startedAt: string;
    completed: string;
    abandoned: string;
    finalizationFailed: string;
    recording: string;
    reportTitle: string;
    reportLoading: string;
    started: string;
    reportGenerated: string;
    reportRegenerated: string;
    activeOperationsTitle: string;
    activeOperationsBody: string;
    keepRecording: string;
    forceFinish: string;
    abandonTitle: string;
    abandonBody: string;
    abandonConfirm: string;
    deleteTitle: string;
    deleteBody: string;
    deleteConfirm: string;
    startFailed: string;
    finalizeFailed: string;
    abandonFailed: string;
    deleteFailed: string;
    reportFailed: string;
    regenerateFailed: string;
  };
  myWork: {
    title: string;
    home: string;
    presentations: string;
    inProgress: string;
    newPresentation: string;
    emptyPresentations: string;
    emptyInProgress: string;
    loading: string;
    loadFailed: string;
    retry: string;
    menu: string;
    rename: string;
    renameTitle: string;
    renamePlaceholder: string;
    delete: string;
    deleteTitle: string;
    deleteBody: string;
    deleteConfirm: string;
    coverLoading: string;
    coverUnavailable: string;
    opening: string;
    openFailed: string;
    openRetry: string;
    duplicate: string;
    duplicateTitle: string;
    duplicating: string;
    duplicateFailed: string;
    duplicated: string;
  };
  preferences: {
    defaultLanguage: string;
    textDensity: string;
    visualTone: string;
    pageGenerationConcurrency: string;
    researchImageSessionConcurrency: string;
    visualReviewEnabled: string;
    visualReviewFailureLimit: string;
    disableWebResearch: string;
    disableImageResearch: string;
    enabled: string;
    disabled: string;
  };
  review: {
    title: string;
    grid: string;
    organize: string;
    present: string;
    htmlGate: string;
    rendering: string;
    renderAgain: string;
    renderFailed: string;
    openHtml: string;
  };
  refine: {
    title: string;
    deckScope: string;
    slideScope: string;
    deckPrompt: string;
    deckPlaceholder: string;
    slidePrompt: string;
    slidePlaceholder: string;
    slideHelper: string;
    deckSteps: string[];
    slideSteps: string[];
  };
  manualEditor: {
    title: string;
    loading: string;
    loadFailed: string;
    tooLarge: string;
    imageRejected: string;
    fontRejected: string;
    fontLoadFailed: string;
    missingShell: string;
    reloadLatest: string;
    newTextPlaceholder: string;
    expandPages: string;
    collapsePages: string;
    saveStatus: {
      saved: string;
      saving: string;
      conflict: string;
      failed: string;
      unsaved: string;
    };
    undo: string;
    redo: string;
    addText: string;
    addShape: string;
    addImage: string;
    fontFamily: string;
    uploadFont: string;
    fontSize: string;
    bold: string;
    italic: string;
    underline: string;
    strikethrough: string;
    alignLeft: string;
    alignCenter: string;
    alignRight: string;
    lineHeight: string;
    spaceAfter: string;
    textColor: string;
    replaceImage: string;
    cropImage: string;
    resetCrop: string;
    fill: string;
    fillColor: string;
    noFill: string;
    border: string;
    borderColor: string;
    borderWidth: string;
    deleteElement: string;
    more: string;
    selectParent: string;
    restoreAiVersion: string;
    fitWindow: string;
    zoomOut: string;
    zoomIn: string;
    restoreConfirm: {
      title: string;
      body: string;
      confirm: string;
    };
    unsavedConfirm: {
      title: string;
      body: string;
      keepEditing: string;
      discard: string;
    };
  };
  exportPage: {
    title: string;
    pptxDescription: string;
    pdfDescription: string;
    preparing: string;
    ready: string;
    noFile: string;
    download: string;
    downloadPreparing: string;
    retryDownload: string;
    downloadNotPrepared: string;
    downloadReady: string;
    downloadStarted: string;
    downloadStartedWithLink: string;
    downloadLinkLabel: string;
    copyDownloadLink: string;
    downloadLinkCopied: string;
    downloadFallbackHint: string;
    pptxPreparingModel: string;
    pptxModelReady: string;
    pptxGenerating: string;
    pptxFailed: string;
    pdfGenerating: string;
    pptxQueued: string;
    checkingStatus: string;
    resumedJob: string;
    exportFailedSummary: string;
    retryExport: string;
    pptxTimedOut: string;
    fontVariantWarning: string;
  };
  toasts: {
    localFolder: string;
    attachmentAdded: string;
    attachmentRemoved: string;
    outlineUpdated: string;
    outlineSkipped: string;
    promptRequired: string;
    confirmRequirementsFirst: string;
    createOutlineFirst: string;
    createDeckFirst: string;
    workspaceOpened: string;
    workspaceCreated: string;
    workspaceDuplicated: string;
    pptxExported: string;
    pdfExported: string;
  };
  errors: {
    uploadedSourceAnalysisUnavailable: string;
    uploadedSourceAnalysisBlocked: string;
    summaryTimeout: string;
    summaryTransport: string;
    summaryNotFound: string;
    summaryNetwork: string;
    summaryUnknown: string;
    showDetails: string;
    hideDetails: string;
    detailsLabel: string;
  };
}

export const messages: Record<Locale, Messages> = {
  en: {
    appName: "AnnaDeck",
    languageName: "English",
    controls: {
      library: "Settings",
      collapseSidebar: "Collapse sidebar",
      expandSidebar: "Expand sidebar",
      minimize: "Minimize",
      close: "Close",
      back: "Back",
      forward: "Forward",
      backToLastVersion: "Back to last version",
      open: "Open",
      edit: "Edit",
      cancel: "Cancel",
      save: "Save",
      suggestions: "Suggestions",
      createDeck: "Generate presentation",
      updateDeck: "Update deck",
      updateOutline: "Update outline",
      createOutline: "Create outline",
      createDeckFromOutline: "Create deck",
      confirmOutline: "Confirm and generate",
      reviseOutline: "Revise outline",
      refineDeck: "Refine deck",
      refineSlide: "Refine slide",
      rewriteSlide: "Rewrite slide",
      changeLayout: "Change layout",
      layoutSimpler: "Simpler",
      layoutVisual: "More visual",
      layoutComparison: "Comparison",
      layoutProcess: "Process",
      layoutReport: "Report",
      preview: "Preview",
      export: "Export",
      applyToDeck: "Apply to deck",
      applyToSlide: "Apply to current slide",
      revealInFinder: "Reveal in Finder",
      chooseFile: "Choose file",
      addSlide: "Add slide",
      duplicate: "Duplicate",
      delete: "Delete",
      retryPage: "Retry page",
      resumeGeneration: "Resume generation",
      resumeRefinement: "Resume refinement",
      pptx: "PPTX",
      pdf: "PDF",
      useTemplate: "Use style",
      disableWebResearch: "Disable web research",
      disableImageResearch: "Disable image search",
      stop: "Stop"
    },
    stages: {
      template: "Template",
      brief: "Brief",
      requirements: "Requirements",
      uploadedSourceAnalysis: "Source analysis",
      outline: "Outline",
      generating: "Generating",
      deck: "Deck"
    },
    progressStages: {
      brief: "Create",
      requirements: "Requirements",
      outline: "Outline",
      generating: "Generate",
      deck: "Result"
    },
    status: {
      draftReady: "Draft ready",
      outlineReady: "Outline ready",
      creatingOutline: "Creating outline...",
      analyzingUploadedSource: "Analyzing source material...",
      creatingDeck: "Creating deck...",
      refiningDeck: "Refining deck",
      refiningSlide: "Refining slide",
      deckRefined: "Deck refined",
      slideRefined: "Slide refined",
      exporting: "Exporting",
      settingsSaved: "Settings saved"
    },
    brief: {
      title: "What deck should Anna create?",
      placeholder:
        "Create a 7-slide investor deck about AI agent workflows. Keep it visual, concise, and premium.",
      strictReviewMode: "Visual check",
      strictReviewModeHelp:
        "Visual check calls the model again after each page is generated to inspect screenshot usability, layout fit, overlap, cutoff, and readability. It may increase generation time and token usage.",
      strictReviewConfirmTitle: "Enable visual check?",
      strictReviewConfirmBody:
        "When enabled, Anna will call the model again after each page is generated to check visual quality from the page screenshot. This may increase PPT generation time and token usage, and the review quality depends on the default model's capabilities. Are you sure you want to enable it?",
      strictReviewConfirmAction: "Enable visual check",
      optionalContext: "Sources and visual setup",
      chips: {
        audience: "Audience",
        goal: "Goal",
        style: "Style",
        theme: "Theme",
        content: "Content",
        attachment: "Source material",
        template: "Template"
      },
      contextLabels: {
        audience: "Audience",
        goal: "Goal",
        styleNotes: "Style notes",
        theme: "Theme color",
        contentSource: "Content source",
        attachment: "Source material",
        slides: "Slides",
        textPerSlide: "Text per slide",
        outputLanguage: "Output language",
        look: "Look"
      },
      contextDefaults: {
        audience: "",
        goal: "",
        styleNotes: "",
        contentSource: "",
        attachmentPlaceholder: "logo, brand style, source notes...",
        outputLanguage: "English"
      },
      contextPlaceholders: {
        audience: "Who is this deck for? e.g. enterprise executives, investors, customers",
        goal: "What should the deck achieve? e.g. explain the product, drive demo requests",
        styleNotes: "Describe the desired style, tone, or visual direction",
        contentSource: "Describe source material or say whether Anna should draft from scratch"
      },
      uploadedSourceStatus: {
        pending: "Will analyze before outline creation",
        stale: "Source material changed; analysis will refresh before continuing",
        analyzing: "Analyzing source material",
        ready: "Source material analyzed",
        readyWithCounts: "Analyzed: {facts} facts, {visualAssets} visual assets",
        gap: "Analyzed with gaps",
        gapWithCount: "Analyzed with {gaps} gaps",
        blocked: "Source material cannot be used to continue",
        error: "Source material analysis failed",
        duplicate: "duplicate"
      }
    },
    requirements: {
      title: "Confirm presentation requirements",
      helper: "Review the recommended choices and adjust anything before generation continues.",
      briefLabel: "User request",
      loadingTitle: "Shaping your presentation requirements...",
      loadingBody: "Anna is reading the Brief and identifying the decisions that will guide the deck.",
      errorTitle: "Requirements could not be generated",
      errorBody: "Try again, or fill in the six requirements manually.",
      retry: "Generate again",
      manual: "Fill manually",
      back: "Back",
      confirm: "Confirm and continue",
      confirming: "Confirming...",
      saving: "Saving draft...",
      saved: "Draft saved",
      unsaved: "Unsaved changes",
      recommended: "Recommended",
      other: "Other",
      groups: { content: "Content goals", specifications: "Generation specifications", visual: "Visual direction" },
      fields: { audience: "Audience", purpose: "Purpose", desired_outcome: "Desired outcome", slide_count: "Slide count", output_language: "Language", visual_tone: "Visual tone" },
      templateLocked: "Locked by the selected style preset. Change it from the Brief page.",
      customPlaceholders: { audience: "Describe another audience", purpose: "Describe another purpose", desired_outcome: "Describe another outcome", slide_count: "Enter a positive integer", output_language: "Enter a language", visual_tone: "Describe another visual tone" },
    },
    template: {
      title: "Choose a style",
      helper: "Pick the visual style Anna should use for this deck.",
      none: "No preset",
      noneSelected: "No preset selected",
      loading: "Loading templates...",
      empty: "No templates found.",
      layouts: "layouts",
      selected: "Style selected",
      viewAll: "View all pages",
      previewTitle: "Style preview",
      pageCounter: "{current} / {total}",
      previous: "Previous",
      next: "Next",
      close: "Close",
    },
    outline: {
      title: "Review outline",
      helper: "Adjust the structure before Anna designs the deck.",
      cardTitle: "Outline",
      saveChanges: "Save",
      feedbackTitle: "Tell Anna how you want to adjust the outline",
      feedbackPlaceholder:
        "Enter a rewrite request, such as adding a security slide, making it more executive-facing, or reducing to 5 slides...",
      presentationTitle: "Presentation title",
      pageTitle: "Page title",
      coreMessage: "Core message",
      requiredContent: "Required content",
      requiredContentHint: "Write one item per line; saving will format it as a Markdown list",
      requiredContentCount: "{count} items",
      expandAll: "Expand all",
      collapseAll: "Collapse all",
      addPage: "Add page",
      deletePage: "Delete page",
      moveUp: "Move up",
      moveDown: "Move down",
      undo: "Undo",
      deleted: "Page removed",
      saving: "Saving draft...",
      unsaved: "Unsaved changes",
      saved: "Draft saved",
      loadingTitle: "Creating an outline from your presentation requirements...",
      loadingBody: "Anna is turning the confirmed presentation requirements into a concrete page-by-page storyline.",
      errorTitle: "Outline creation failed",
      retry: "Retry outline creation",
      backToRequirements: "Back"
    },
    uploadedSourceAnalysis: {
      title: "Source material analysis",
      running: "Analyzing source material",
      completed: "Source material analysis complete",
      skipped: "No source material to analyze",
      failed: "Source material analysis failed",
      blocked: "Source material analysis blocked continuation",
      noSources: "No source material, no analysis needed.",
      stale: "Source material changed; continuing will rerun analysis.",
      sourceCount: "{count} source files",
      resultSummary: "Analysis result",
      retry: "Retry analysis",
      returnToBrief: "Return to brief",
      records: {
        prepare: "Prepare source material",
        factual: "Factual analysis",
        visual: "Visual analysis",
        merge: "Compile analysis result"
      },
      messages: {
        idle: "Waiting to analyze source material.",
        prepare: "Preparing uploaded source material...",
        factual: "Running factual source analysis...",
        visual: "Running visual source analysis...",
        merge: "Compiling analysis result...",
        completed: "Analysis is ready; continuing the previous action.",
        skipped: "No source material, no analysis needed.",
        failed: "Analysis failed. Retry or return to the brief.",
        blocked: "Analysis blocked continuation. Retry or return to the brief."
      },
      summaryLabels: {
        facts: "Facts",
        visualAssets: "Visual assets",
        gaps: "Gaps",
        rejected: "Rejected",
        reason: "Reason"
      }
    },
    generating: {
      progressTitle: "Generation progress",
      preparingTitle: "Preparing generation",
      confirmingOutline: "Confirming the Outline and preparing generation",
      generationComplete: "Generation complete",
      interruptedTitle: "Generation interrupted",
      unresumableTitle: "Unable to resume generation",
      stoppingTitle: "Stopping",
      stoppingDescription: "Safely stopping the current task...",
      stayOnPageHint: "Please do not leave this page.",
      pagesPassed: "{completed}/{total} pages passed",
      pageLabel: "Page {page}",
      abandon: {
        generationTitle: "Stop generation?",
        refinementTitle: "Stop refinement?",
        generationBody:
          "All content from this run will be discarded, and the Outline from before generation will be restored.",
        refinementBody:
          "All changes from this refinement will be discarded, and the presentation from before refinement will be restored.",
        generationCancel: "Continue generation",
        refinementCancel: "Continue refinement",
        confirm: "Stop and discard",
        generationStopped: "Stopped. This run was not kept.",
        refinementStopped: "Stopped. This refinement was not kept.",
        failed: "Could not stop the run. Please try again.",
        home: {
          generationTitle: "Leave and discard this run?",
          refinementTitle: "Leave and discard this refinement?",
          generationBody:
            "Generation is still running. Leaving discards this run and restores the Outline from before it started, then takes you to My Works.",
          refinementBody:
            "Refinement is still running. Leaving discards these changes and restores the presentation from before it started, then takes you to My Works.",
          preparationTitle: "Leave and discard this step?",
          preparationBody:
            "Anna is still working on this step. Leaving discards the result, and the step has to be run again.",
          preparationCancel: "Keep waiting",
          confirm: "Discard and leave"
        }
      },
      pageSummary: {
        label: "Page progress",
        accepted: "{accepted}/{total} passed",
        failed: "{count} failed",
        running: "{count} in progress",
        pending: "{count} waiting",
        total: "{count} pages in total"
      },
      commitFailed: {
        title: "Could not save this run",
        body: "The generated presentation could not be saved.",
        restored: "Your previous presentation is unchanged.",
        confirm: "Got it"
      },
      steps: {
        outline: "Outline",
        pagePlan: "Authoring setup",
        researchDiscovery: "Facts collection",
        prepare: "Prepare files",
        pages: "Pages",
        finalRender: "Final preview"
      },
      preview: {
        title: "Page preview",
        waiting: "Each page shows up here as soon as it renders.",
        thumbnails: "Rendered pages",
        loading: "Preparing preview\u2026",
        failed: "Preview is unavailable for now.",
        untitledPage: "Untitled page",
        selectPage: "Show page {page}",
        latest: "Latest",
        followingLatest: "Following the newest page",
        backToLatest: "Follow the newest page"
      },
      persistentElements: {
        title: "Cross-slide decoration generation",
        session: "Generating shared decorations"
      },
      researchDiscovery: {
        title: "Facts collection",
        empty: "No details for this step yet.",
        warning: "Partial",
        statuses: {
          waiting: "Waiting",
          running: "Running",
          completed: "Completed",
          skipped: "Skipped",
          warning: "Completed"
        },
        queries: "Queries",
        sources: "Sources",
        visualAssets: "Selected visual assets",
        gaps: "Evidence gaps",
        rejected: "Rejected material",
        summary: "Summary",
        untitledSource: "Untitled source",
        resultCount: "{count} results",
        fetchCount: "{count} fetched",
        downloadCount: "{count} downloaded",
        visualEvidenceNote: "Selected images are visual evidence only; text or charts inside an image are not factual grounding by themselves.",
        queryStatuses: {
          running: "Running",
          collected: "Collected",
          gap: "Completed",
          error: "Error",
          skipped_duplicate: "Skipped duplicate"
        },
        activities: {
          webDecision: "Deciding whether new web research is needed",
          webSearch: "Searching web sources: {completed}/{total} queries completed",
          webFetchSelection: "Selecting sources to read in full",
          webFetch: "Fetching web pages: {completed}/{total} completed",
          webSynthesis: "Organizing the collected web material",
          webPublish: "Saving the web research result",
          webComplete: "Web research complete: {count} results, {completed} sources fetched",
          webSkipped: "Existing material is sufficient; no new web search is needed",
          imageDecision: "Deciding whether new image material is needed",
          imageSearch: "Searching image candidates: {completed}/{total} queries completed",
          imageDeduplication: "Merging duplicate image candidates: {count} found",
          imageDownload: "Downloading image candidates: {completed}/{total} completed, {failed} failed",
          imagePrepare: "Preparing downloaded images for assessment: {completed}/{total} completed, {failed} failed",
          imageAnalysis: "Assessing image candidates: {completed}/{total} batches completed, {selected} selected",
          imageImport: "Saving selected images: {completed}/{total} completed, {failed} failed",
          imagePublish: "Saving the selected image catalog",
          imageComplete: "Image research complete: {selected} selected, {completed} saved",
          imageSkipped: "No new image material is needed for this run"
        },
        counts: {
          facts: "Facts",
          derivedInsights: "Insights",
          visualAssets: "Images",
          gaps: "Gaps",
          rejectedMaterial: "Rejected"
        },
        phases: {
          "web-decision": "Decide whether web research is needed",
          "web-collection": "Search and organize web research",
          "visual-decision": "Decide whether image research is needed",
          "visual-collection": "Search and select image material"
        }
      },
      currentSessionStream: "Current session stream",
      sessionHistory: "Session history",
      waitingForStep: "Waiting for step output",
      noStream: "No stream output yet",
      streamHint: "Live output appears after the step starts.",
      stageRecords: {
        expand: "Expand stage",
        collapse: "Collapse stage",
        noOutput: "No output for this stage.",
        activities: "Activity",
        stream: "Live output",
        running: "Running",
        completed: "Completed",
        failed: "Failed",
        pending: "Waiting",
        pageStatuses: {
          pending: "Waiting to start",
          researchCollecting: "Collecting sources",
          researchCurating: "Curating evidence",
          authoring: "Thinking through this page",
          rendering: "Rendering page",
          renderFixing: "Fixing render issue",
          visualReview: "Checking page visuals",
          visualReviewFixing: "Adjusting visuals after review",
          accepted: "Passed",
          renderFailed: "Render failed",
          agentFailed: "Generation failed",
          needsUserReview: "Needs review",
          agentInfrastructureFailed: "Agent session failed",
          interrupted: "Interrupted",
          cancelled: "Stopped",
          unknown: "Working"
        },
        stages: {
          pagePlan: "Page planning",
          researchPlanning: "Research planning",
          researchDiscovery: "Research discovery",
          researchCollection: "Collecting sources",
          researchCuration: "Curating evidence",
          evidencePagePlanning: "Evidence-aware page planning",
          webResearchCuration: "Curating facts",
          visualResearchCuration: "Curating images",
          prepare: "File preparation",
          persistentElements: "Generating shared decorations",
          authoring: "Designing page content and layout",
          deckRefinement: "Deck refinement",
          rendering: "Page rendering",
          renderFix: "Render issue fix",
          visualReview: "Page visual review",
          visualReviewFix: "Visual review adjustment",
          finalRender: "Final preview",
          accepted: "Page passed",
          failed: "Stage failed",
          pending: "Waiting to start",
          unknown: "Working"
        }
      },
      cancelled: "Generation stopped",
      cancelling: "Stopping current generation..."
    },
    deck: {
      title: "AI Agent Workflows",
      subtitle: "Local project data",
      slideCounter: "{current} / {total}",
      previousSlide: "Previous page",
      nextSlide: "Next page"
    },
    library: {
      title: "Settings",
      workspace: "Workspace",
      workspacePath: "Anna Workspace / PPT",
      currentWorkspace: "Current task",
      noWorkspaceSelected: "No task selected",
      empty: "No tasks yet",
      createWorkspace: "New task",
      defaultWorkspaceTitle: "New Task-{date}",
      preferences: "Preferences",
      runtimeInfoTitle: "Runtime information",
      annaDeckVersion: "Anna Deck version",
      pptEngineVersion: "ppt-engine version",
      runtimeInfoUnavailable: "The runtime version is temporarily unavailable.",
      agentResourceInfoTitle: "Agent configuration",
      agentResourceInfoDescription: "Internal troubleshooting snapshot of the Agent host and ppt-engine process.",
      agentResourceInfoRefresh: "Refresh Agent configuration",
      agentResourceInfoRefreshing: "Refreshing...",
      agentResourceInfoUnavailable: "Agent resource information is temporarily unavailable.",
      agentResourceInfoSystem: "System resources",
      agentResourceInfoProcess: "ppt-engine process",
      agentResourceInfoCpuUsage: "System CPU usage",
      agentResourceInfoProcessCpuUsage: "Process CPU usage",
      agentResourceInfoConfiguredCores: "Configured CPU",
      agentResourceInfoVisibleCores: "Visible CPU cores",
      agentResourceInfoMemoryUsage: "System memory usage",
      agentResourceInfoProcessMemory: "Process RSS memory",
      agentResourceInfoPlatform: "Platform",
      agentResourceInfoNode: "Node.js",
      agentResourceInfoLoadAverage: "Load average",
      agentResourceInfoSampledAt: "Last refreshed",
      agentResourceInfoCgroupLimit: "cgroup limit",
      agentResourceInfoSystemVisible: "system visible",
      agentResourceInfoUnknown: "Unavailable",
      lastEditedToday: "Last edited today",
      lastEditedYesterday: "Last edited yesterday",
      lastEditedDate: "Last edited {date}",
      diagnosticBundleTitle: "Troubleshooting bundle",
      diagnosticBundleDescription: "Create a fresh ZIP of the complete current Workspace for troubleshooting. An active task may continue changing while the bundle is collected.",
      diagnosticBundleSensitiveHint: "Includes logs, uploaded sources, page source files, research records, and generated artifacts.",
      diagnosticBundleNoWorkspace: "Select a task first",
      diagnosticBundleDownload: "Download troubleshooting bundle",
      diagnosticBundleDownloadStarted: "Download started. Check your browser downloads.",
      diagnosticBundleDownloadStartedWithLink:
        "Download started. If your browser blocked it, copy the link below instead.",
      diagnosticBundleDownloadFallbackHint:
        "If the download did not start, copy the link into a normal browser address bar. Do not share it with unrelated people.",
      diagnosticBundlePreparing: "Packaging and uploading...",
      diagnosticBundleRefresh: "Regenerate troubleshooting bundle",
      diagnosticBundleRetry: "Retry generating download link",
      diagnosticBundleReady: "Troubleshooting bundle download link is ready.",
      diagnosticBundleExpired: "The download link has expired. Generate a fresh troubleshooting bundle.",
      diagnosticBundleFailed: "Failed to generate the troubleshooting bundle.",
      diagnosticBundleFailedPrefix: "Failed to generate the troubleshooting bundle: ",
      diagnosticBundleLinkLabel: "Troubleshooting bundle download link",
      diagnosticBundleCopyLink: "Copy troubleshooting bundle link",
      diagnosticBundleLinkCopied: "Link copied. Paste it into your browser address bar to download, and do not share it with unrelated people."
    },
    performance: {
      title: "Performance Testing",
      description: "Record internal button interactions, backend round trips, and workflow timings. Data stays in the global PPT performance-runs directory.",
      unavailable: "This ppt-engine does not support Performance Testing.",
      loading: "Loading Performance Runs...",
      active: "Recording",
      inactive: "Not recording",
      start: "Start recording",
      finish: "Finish and generate report",
      abandon: "Abandon recording",
      history: "Run history",
      empty: "No Performance Runs yet.",
      viewReport: "View report",
      regenerateReport: "Regenerate report",
      deleteRun: "Delete run",
      refresh: "Refresh runs",
      events: "events",
      integrity: "Data integrity",
      startedAt: "Started",
      completed: "Completed",
      abandoned: "Abandoned",
      finalizationFailed: "Report generation failed",
      recording: "Recording",
      reportTitle: "Performance Report",
      reportLoading: "Loading report...",
      started: "Performance recording started.",
      reportGenerated: "Performance report generated.",
      reportRegenerated: "Performance report regenerated.",
      activeOperationsTitle: "Operations are still active",
      activeOperationsBody: "{count} operations are unfinished. Force finish marks their measurements as interrupted but does not stop product tasks.",
      keepRecording: "Keep recording",
      forceFinish: "Force finish",
      abandonTitle: "Abandon this Performance Run?",
      abandonBody: "Raw events are retained, but no report will be generated.",
      abandonConfirm: "Abandon run",
      deleteTitle: "Delete Performance Run?",
      deleteBody: "This permanently deletes raw events and the report for {runId}.",
      deleteConfirm: "Delete permanently",
      startFailed: "Failed to start Performance Run.",
      finalizeFailed: "Failed to finalize Performance Run.",
      abandonFailed: "Failed to abandon Performance Run.",
      deleteFailed: "Failed to delete Performance Run.",
      reportFailed: "Failed to open Performance Report.",
      regenerateFailed: "Failed to regenerate Performance Report."
    },
    myWork: {
      title: "My Works",
      home: "Home",
      presentations: "Presentations",
      inProgress: "In Progress",
      newPresentation: "New Presentation",
      emptyPresentations: "No generated presentations yet.",
      emptyInProgress: "No unfinished projects.",
      loading: "Loading projects...",
      loadFailed: "Failed to load projects.",
      retry: "Retry",
      menu: "Project actions",
      rename: "Rename",
      renameTitle: "Rename project",
      renamePlaceholder: "Project name",
      delete: "Delete",
      deleteTitle: "Delete project?",
      deleteBody: "This permanently deletes “{title}” and all of its files. This action cannot be undone.",
      deleteConfirm: "Delete permanently",
      coverLoading: "Loading cover",
      coverUnavailable: "Cover unavailable",
      opening: "Opening...",
      openFailed: "This project could not be opened.",
      openRetry: "Try opening again",
      duplicate: "Duplicate",
      duplicateTitle: "{title} (Copy)",
      duplicating: "Duplicating...",
      duplicateFailed: "This project could not be duplicated.",
      duplicated: "Project duplicated"
    },
    preferences: {
      defaultLanguage: "Default language",
      textDensity: "Text density",
      visualTone: "Visual tone",
      pageGenerationConcurrency: "Page generation concurrency",
      researchImageSessionConcurrency: "Image research Session concurrency",
      visualReviewEnabled: "Visual check",
      visualReviewFailureLimit: "Visual check failure limit",
      disableWebResearch: "Disable web research",
      disableImageResearch: "Disable image search",
      enabled: "On",
      disabled: "Off"
    },
    review: {
      title: "Preview deck",
      grid: "Grid",
      organize: "Organize",
      present: "Present",
      htmlGate: "HTML review is required before PPTX export.",
      rendering: "Rendering HTML preview",
      renderAgain: "Render again",
      renderFailed: "Render failed",
      openHtml: "Open HTML"
    },
    refine: {
      title: "Refine",
      deckScope: "Deck",
      slideScope: "Slide",
      deckPrompt: "Tell Anna how to improve the deck...",
      deckPlaceholder:
        "Make it more executive-facing, reduce text, add more workflow diagrams, and sharpen the story.",
      slidePrompt: "Tell Anna what to change on this slide...",
      slidePlaceholder:
        "Make this slide more visual, reduce the subtitle, and add a workflow diagram.",
      slideHelper: "Changes will apply only to slide {number}.",
      deckSteps: [
        "Reading current deck",
        "Applying your direction",
        "Tightening slide copy",
        "Improving visual consistency",
        "Keeping outline intact"
      ],
      slideSteps: ["Rewriting selected slide", "Updating slide visual"]
    },
    manualEditor: {
      title: "Edit deck",
      loading: "Loading page...",
      loadFailed: "Could not load the page HTML: HTTP {status}",
      tooLarge: "This page is larger than 64 MiB and cannot be saved.",
      imageRejected: "Only PNG, JPEG or WebP images up to 20 MiB are supported.",
      fontRejected: "Only valid TTF, OTF, WOFF or WOFF2 fonts up to 20 MiB are supported.",
      fontLoadFailed: "A managed font could not be loaded: {message}",
      missingShell: "This page has no editable slide shell.",
      reloadLatest: "Load the latest saved version",
      newTextPlaceholder: "Double-click to edit",
      expandPages: "Expand page list",
      collapsePages: "Collapse page list",
      saveStatus: {
        saved: "Saved",
        saving: "Saving...",
        conflict: "Save conflict",
        failed: "Save failed",
        unsaved: "Unsaved"
      },
      undo: "Undo (Ctrl/Cmd+Z)",
      redo: "Redo (Ctrl/Cmd+Shift+Z)",
      addText: "Add text",
      addShape: "Add shape",
      addImage: "Add image",
      fontFamily: "Font",
      uploadFont: "Upload font…",
      fontSize: "Font size",
      bold: "Bold",
      italic: "Italic",
      underline: "Underline",
      strikethrough: "Strikethrough",
      alignLeft: "Align left",
      alignCenter: "Center",
      alignRight: "Align right",
      lineHeight: "Line height",
      spaceAfter: "Space after",
      textColor: "Text color",
      replaceImage: "Replace image",
      cropImage: "Crop",
      resetCrop: "Reset crop",
      fill: "Fill",
      fillColor: "Fill color",
      noFill: "No fill",
      border: "Border",
      borderColor: "Border color",
      borderWidth: "Border width",
      deleteElement: "Delete (Del)",
      more: "More",
      selectParent: "Select parent",
      restoreAiVersion: "Restore AI version",
      fitWindow: "Fit to window",
      zoomOut: "Zoom out",
      zoomIn: "Zoom in",
      restoreConfirm: {
        title: "Restore the AI version",
        body: "Your manual edits will be dropped and the current TSX will be rendered again.",
        confirm: "Restore"
      },
      unsavedConfirm: {
        title: "This page has unsaved changes",
        body: "Save them, discard them, or keep editing.",
        keepEditing: "Keep editing",
        discard: "Discard"
      }
    },
    exportPage: {
      title: "Export",
      pptxDescription: "Editable PowerPoint file",
      pdfDescription: "Share-ready document",
      preparing: "Preparing...",
      ready: "{type} ready",
      noFile: "No export file ready",
      download: "Download",
      downloadPreparing: "Preparing download...",
      retryDownload: "Retry download",
      downloadNotPrepared: "Ready to download.",
      downloadReady: "Download link ready.",
      downloadStarted: "The download has started.",
      downloadStartedWithLink: "Download requested. If your browser did not save the file, use the link below.",
      downloadLinkLabel: "Download link",
      copyDownloadLink: "Copy download link",
      downloadLinkCopied: "Download link copied. Paste it into your browser address bar to download.",
      downloadFallbackHint: "Copy the link, then paste it into your browser address bar.",
      pptxPreparingModel: "Preparing PPTX model",
      pptxModelReady: "PPTX model ready",
      pptxGenerating: "Generating PPTX file",
      pptxFailed: "PPTX export failed",
      pdfGenerating: "Generating PDF file",
      pptxQueued: "PPTX export queued",
      checkingStatus: "Checking export status...",
      resumedJob: "Reconnected to the export already running for this deck.",
      exportFailedSummary: "The export could not be completed.",
      retryExport: "Try exporting again",
      pptxTimedOut: "Timed out waiting for the PPTX export.",
      fontVariantWarning: "Missing managed font variants will be simulated if used: {warnings}"
    },
    toasts: {
      localFolder: "Opening local folder...",
      attachmentAdded: "Source material added",
      attachmentRemoved: "Source material removed",
      outlineUpdated: "Outline revised",
      outlineSkipped: "Outline was skipped for this deck",
      promptRequired: "Enter a prompt first",
      confirmRequirementsFirst: "Confirm the presentation requirements before editing the outline",
      createOutlineFirst: "Create the outline first",
      createDeckFirst: "Create the deck first",
      workspaceOpened: "Opened task {id}",
      workspaceCreated: "Created task {id}",
      workspaceDuplicated: "Duplicated task {id}",
      pptxExported: "PPTX exported",
      pdfExported: "PDF exported"
    },
    errors: {
      uploadedSourceAnalysisUnavailable: "Source material analysis is unavailable because the agent session is not ready.",
      uploadedSourceAnalysisBlocked: "Source material analysis blocked outline creation",
      summaryTimeout: "This is taking longer than expected and the request timed out.",
      summaryTransport: "The file could not be transferred between Anna and this app.",
      summaryNotFound: "The requested content is no longer available.",
      summaryNetwork: "Anna could not be reached. Check your connection and try again.",
      summaryUnknown: "Something went wrong. Please try again.",
      showDetails: "Show technical details",
      hideDetails: "Hide technical details",
      detailsLabel: "Technical details"
    }
  },
  zh: {
    appName: "AnnaDeck",
    languageName: "中文",
    controls: {
      library: "设置",
      collapseSidebar: "收起侧边栏",
      expandSidebar: "展开侧边栏",
      minimize: "最小化",
      close: "关闭",
      back: "返回",
      forward: "前进",
      backToLastVersion: "返回上一版",
      open: "打开",
      edit: "编辑",
      cancel: "取消",
      save: "保存",
      suggestions: "建议",
      createDeck: "生成演示文稿",
      updateDeck: "更新演示文稿",
      updateOutline: "更新大纲",
      createOutline: "创建大纲",
      createDeckFromOutline: "创建演示文稿",
      confirmOutline: "确认并生成",
      reviseOutline: "调整大纲",
      refineDeck: "优化整套",
      refineSlide: "优化当前页",
      rewriteSlide: "重写本页",
      changeLayout: "换 Layout",
      layoutSimpler: "更简洁",
      layoutVisual: "更视觉化",
      layoutComparison: "适合对比",
      layoutProcess: "适合流程",
      layoutReport: "适合汇报",
      preview: "预览",
      export: "导出",
      applyToDeck: "应用到整套",
      applyToSlide: "应用到当前页",
      revealInFinder: "在 Finder 中显示",
      chooseFile: "选择文件",
      addSlide: "添加页面",
      duplicate: "复制",
      delete: "删除",
      retryPage: "重跑本页",
      resumeGeneration: "继续生成",
      resumeRefinement: "继续修改",
      pptx: "PPTX",
      pdf: "PDF",
      useTemplate: "使用风格",
      disableWebResearch: "禁止网络资料搜索",
      disableImageResearch: "禁止图片搜索",
      stop: "停止"
    },
    stages: {
      template: "模板",
      brief: "需求",
      requirements: "演示需求",
      uploadedSourceAnalysis: "上传资料分析",
      outline: "大纲",
      generating: "生成中",
      deck: "成稿"
    },
    progressStages: {
      brief: "创建",
      requirements: "需求",
      outline: "大纲",
      generating: "生成",
      deck: "结果"
    },
    status: {
      draftReady: "草稿已就绪",
      outlineReady: "大纲已就绪",
      creatingOutline: "正在创建大纲...",
      analyzingUploadedSource: "正在分析上传资料...",
      creatingDeck: "正在创建演示文稿...",
      refiningDeck: "正在优化整套",
      refiningSlide: "正在优化当前页",
      deckRefined: "整套已优化",
      slideRefined: "当前页已优化",
      exporting: "正在导出",
      settingsSaved: "设置已保存"
    },
    brief: {
      title: "Anna 要创建什么演示文稿？",
      placeholder:
        "创建一份 7 页的 AI Agent 工作流投资人演示，要求视觉化、简洁、有高级感。",
      strictReviewMode: "视觉检查",
      strictReviewModeHelp:
        "开启后会在每页生成后额外调用模型检查截图可用性、布局适配、元素覆盖、裁切和可读性，可能增加生成时间和 token 消耗。",
      strictReviewConfirmTitle: "开启视觉检查？",
      strictReviewConfirmBody:
        "开启后，Anna 会在每页生成后再次调用大模型，根据页面截图检查视觉质量。这可能延长 PPT 生成时间，并消耗更多 token；检查质量也会受默认模型能力影响。确定要开启吗？",
      strictReviewConfirmAction: "开启视觉检查",
      optionalContext: "资料与视觉设置",
      chips: {
        audience: "受众",
        goal: "目标",
        style: "风格",
        theme: "主题色",
        content: "内容",
        attachment: "上传资料",
        template: "模板选择"
      },
      contextLabels: {
        audience: "受众",
        goal: "目标",
        styleNotes: "风格说明",
        theme: "主题色",
        contentSource: "内容来源",
        attachment: "上传资料",
        slides: "页数",
        textPerSlide: "单页文字量",
        outputLanguage: "输出语言",
        look: "视觉方向"
      },
      contextDefaults: {
        audience: "",
        goal: "",
        styleNotes: "",
        contentSource: "",
        attachmentPlaceholder: "logo、品牌风格、来源资料...",
        outputLanguage: "中文"
      },
      contextPlaceholders: {
        audience: "这份演示面向谁？例如企业高管、投资人、客户",
        goal: "这份演示要达成什么目标？例如说明产品、推动预约演示",
        styleNotes: "描述希望的风格、语气或视觉方向",
        contentSource: "描述参考材料，或说明是否由 Anna 从零起草"
      },
      uploadedSourceStatus: {
        pending: "将在创建大纲前分析",
        stale: "上传资料已变更，继续前会重新分析",
        analyzing: "正在分析上传资料",
        ready: "上传资料已分析",
        readyWithCounts: "已分析：{facts} 条事实，{visualAssets} 个视觉素材",
        gap: "已分析，但存在缺口",
        gapWithCount: "已分析，但有 {gaps} 个缺口",
        blocked: "上传资料无法用于继续生成",
        error: "上传资料分析失败",
        duplicate: "重复"
      }
    },
    requirements: {
      title: "确认演示需求",
      helper: "请审阅推荐选项，并在继续生成前确认这份演示文稿的关键要求。",
      briefLabel: "用户需求",
      loadingTitle: "正在梳理演示需求...",
      loadingBody: "Anna 正在阅读需求描述，提炼会影响后续生成的关键决策。",
      errorTitle: "未能生成演示需求",
      errorBody: "你可以重新生成，或直接手动填写六项需求。",
      retry: "重新生成",
      manual: "手动填写",
      back: "返回",
      confirm: "确认并继续",
      confirming: "正在确认...",
      saving: "正在保存草稿...",
      saved: "草稿已保存",
      unsaved: "有未保存的修改",
      recommended: "推荐",
      other: "其他",
      groups: { content: "内容目标", specifications: "生成规格", visual: "视觉方向" },
      fields: { audience: "受众", purpose: "用途", desired_outcome: "预期效果", slide_count: "页数", output_language: "语言", visual_tone: "视觉气质" },
      templateLocked: "已由所选模板锁定。如需更换，请返回需求描述页面。",
      customPlaceholders: { audience: "描述其他受众", purpose: "描述其他用途", desired_outcome: "描述其他预期效果", slide_count: "输入正整数", output_language: "输入具体语言", visual_tone: "描述其他视觉气质" },
    },
    template: {
      title: "选择风格",
      helper: "选择 Anna 生成这份演示时使用的视觉风格。",
      none: "不使用模板",
      noneSelected: "未选择模板",
      loading: "正在加载模板...",
      empty: "没有发现可用模板。",
      layouts: "个版式",
      selected: "已选择风格",
      viewAll: "查看全部页面",
      previewTitle: "风格预览",
      pageCounter: "{current} / {total}",
      previous: "上一页",
      next: "下一页",
      close: "关闭",
    },
    outline: {
      title: "审阅大纲",
      helper: "先改结构，再确认后继续生成。",
      cardTitle: "大纲",
      saveChanges: "保存",
      feedbackTitle: "告诉Anna你想如何调整大纲",
      feedbackPlaceholder: "输入重构需求，例如增加安全页、改成更面向高管，或缩减到 5 页...",
      presentationTitle: "演示文稿标题",
      pageTitle: "页面标题",
      coreMessage: "核心信息",
      requiredContent: "必要内容",
      requiredContentHint: "每行填写一项，保存时会自动整理为 Markdown 列表",
      requiredContentCount: "{count} 项",
      expandAll: "全部展开",
      collapseAll: "全部收起",
      addPage: "新增页面",
      deletePage: "删除页面",
      moveUp: "上移",
      moveDown: "下移",
      undo: "撤销",
      deleted: "已删除页面",
      saving: "正在保存草稿...",
      unsaved: "有未保存的修改",
      saved: "草稿已保存",
      loadingTitle: "正在根据演示需求创建大纲...",
      loadingBody: "Anna 正在把已确认演示需求整理成具体的逐页叙事结构。",
      errorTitle: "大纲创建失败",
      retry: "重试创建大纲",
      backToRequirements: "返回"
    },
    uploadedSourceAnalysis: {
      title: "上传资料分析",
      running: "正在分析上传资料",
      completed: "上传资料分析完成",
      skipped: "无上传资料可分析",
      failed: "上传资料分析失败",
      blocked: "上传资料分析阻止继续",
      noSources: "无上传资料，不需要分析。",
      stale: "上传资料已变更，继续创建时会重新分析。",
      sourceCount: "{count} 个上传资料",
      resultSummary: "分析结果",
      retry: "重试分析",
      returnToBrief: "返回需求",
      records: {
        prepare: "准备上传资料",
        factual: "事实分析",
        visual: "视觉分析",
        merge: "整理分析结果"
      },
      messages: {
        idle: "等待分析上传资料。",
        prepare: "正在准备上传资料...",
        factual: "正在运行事实分析...",
        visual: "正在运行视觉分析...",
        merge: "正在整理分析结果...",
        completed: "分析已完成，将继续之前的操作。",
        skipped: "无上传资料，不需要分析。",
        failed: "分析失败。可重试分析或返回需求。",
        blocked: "分析阻止继续。可重试分析或返回需求。"
      },
      summaryLabels: {
        facts: "事实",
        visualAssets: "视觉素材",
        gaps: "缺口",
        rejected: "拒绝",
        reason: "原因"
      }
    },
    generating: {
      progressTitle: "生成进度",
      preparingTitle: "生成准备中",
      confirmingOutline: "正在确认大纲并准备生成",
      generationComplete: "生成完成",
      interruptedTitle: "生成中断",
      unresumableTitle: "无法继续生成",
      stoppingTitle: "正在停止",
      stoppingDescription: "正在安全停止当前任务...",
      stayOnPageHint: "请勿离开此页面",
      pagesPassed: "{completed}/{total} 页通过",
      pageLabel: "第 {page} 页",
      abandon: {
        generationTitle: "停止生成？",
        refinementTitle: "停止优化？",
        generationBody: "停止后，本次生成的所有内容都不会保留，并返回生成前的大纲。",
        refinementBody: "停止后，本次优化的所有内容都不会保留，并恢复优化前的演示文稿。",
        generationCancel: "继续生成",
        refinementCancel: "继续优化",
        confirm: "停止并放弃",
        generationStopped: "已停止，本次生成未保留。",
        refinementStopped: "已停止，本次优化未保留。",
        failed: "停止失败，请重试。",
        home: {
          generationTitle: "离开会放弃这次生成？",
          refinementTitle: "离开会放弃这次优化？",
          generationBody: "生成还没完成。离开后本次生成的内容都不会保留，会恢复到生成前的大纲，并回到「我的作品」。",
          refinementBody: "优化还没完成。离开后本次优化的内容都不会保留，会恢复到优化前的演示文稿，并回到「我的作品」。",
          preparationTitle: "离开会放弃这一步？",
          preparationBody: "Anna 还在处理这一步。离开后这次的结果不会保留，需要重新跑一次。",
          preparationCancel: "继续等待",
          confirm: "放弃并离开"
        }
      },
      pageSummary: {
        label: "页面进度",
        accepted: "{accepted}/{total} 页已通过",
        failed: "{count} 页失败",
        running: "{count} 页进行中",
        pending: "{count} 页等待中",
        total: "共 {count} 页"
      },
      commitFailed: {
        title: "本次生成未能保存",
        body: "生成好的演示文稿没能保存成功。",
        restored: "你之前的演示文稿没有被改动。",
        confirm: "知道了"
      },
      steps: {
        outline: "大纲",
        pagePlan: "创作准备",
        researchDiscovery: "事实收集",
        prepare: "准备文件",
        pages: "逐页生成",
        finalRender: "最终预览"
      },
      preview: {
        title: "页面预览",
        waiting: "每生成好一页，就会在这里显示整页预览。",
        thumbnails: "已生成的页面",
        loading: "正在准备预览\u2026",
        failed: "预览暂时不可用。",
        untitledPage: "未命名页面",
        selectPage: "查看第 {page} 页",
        latest: "最新",
        followingLatest: "正在跟随最新一页",
        backToLatest: "跟随最新一页"
      },
      persistentElements: {
        title: "跨页装饰生成",
        session: "正在生成跨页装饰"
      },
      researchDiscovery: {
        title: "事实收集",
        empty: "这个步骤暂无详细输出。",
        warning: "部分完成",
        statuses: {
          waiting: "等待中",
          running: "进行中",
          completed: "已完成",
          skipped: "已跳过",
          warning: "已完成"
        },
        queries: "查询",
        sources: "来源",
        visualAssets: "入选图片素材",
        gaps: "证据缺口",
        rejected: "被拒绝材料",
        summary: "汇总",
        untitledSource: "未命名来源",
        resultCount: "{count} 条结果",
        fetchCount: "抓取 {count} 条",
        downloadCount: "下载 {count} 张",
        visualEvidenceNote: "入选图片只作为视觉素材；图片里的文字、图表或结论本身不构成事实依据。",
        queryStatuses: {
          running: "进行中",
          collected: "已收集",
          gap: "已完成",
          error: "出错",
          skipped_duplicate: "跳过重复"
        },
        activities: {
          webDecision: "正在判断是否需要补充网页资料",
          webSearch: "正在搜索网页资料：已完成 {completed}/{total} 个搜索词",
          webFetchSelection: "正在选择需要阅读全文的来源",
          webFetch: "正在抓取网页正文：已完成 {completed}/{total}",
          webSynthesis: "正在整理已收集的网页资料",
          webPublish: "正在保存网页研究结果",
          webComplete: "网页研究完成：获得 {count} 条结果，抓取 {completed} 个来源",
          webSkipped: "现有资料已足够，本轮无需新增网页搜索",
          imageDecision: "正在判断是否需要补充图片素材",
          imageSearch: "正在搜索图片候选：已完成 {completed}/{total} 个搜索词",
          imageDeduplication: "正在合并重复图片：已找到 {count} 个候选",
          imageDownload: "正在下载图片候选：已完成 {completed}/{total}，失败 {failed}",
          imagePrepare: "正在准备图片分析附件：已完成 {completed}/{total}，失败 {failed}",
          imageAnalysis: "正在判断图片可用性：已完成 {completed}/{total} 批，入选 {selected} 张",
          imageImport: "正在保存入选图片：已完成 {completed}/{total}，失败 {failed}",
          imagePublish: "正在保存入选图片目录",
          imageComplete: "图片研究完成：入选 {selected} 张，已保存 {completed} 张",
          imageSkipped: "本轮无需新增图片素材"
        },
        counts: {
          facts: "事实",
          derivedInsights: "洞察",
          visualAssets: "图片",
          gaps: "缺口",
          rejectedMaterial: "拒绝"
        },
        phases: {
          "web-decision": "判断是否需要网页资料",
          "web-collection": "搜索并整理网页资料",
          "visual-decision": "判断是否需要图片素材",
          "visual-collection": "搜索并筛选图片素材"
        }
      },
      currentSessionStream: "当前会话流",
      sessionHistory: "会话历史",
      waitingForStep: "等待步骤输出",
      noStream: "暂无流式输出",
      streamHint: "步骤开始后会显示实时输出。",
      stageRecords: {
        expand: "展开阶段",
        collapse: "收起阶段",
        noOutput: "这个阶段没有流式输出。",
        activities: "活动",
        stream: "实时输出",
        running: "运行中",
        completed: "已完成",
        failed: "失败",
        pending: "等待中",
        pageStatuses: {
          pending: "等待开始",
          researchCollecting: "正在搜索并抓取资料",
          researchCurating: "正在筛选证据",
          authoring: "正在思考这一页",
          rendering: "正在渲染页面",
          renderFixing: "正在修复渲染问题",
          visualReview: "正在检查页面视觉",
          visualReviewFixing: "正在根据视觉检查调整",
          accepted: "已通过",
          renderFailed: "渲染失败",
          agentFailed: "生成失败",
          needsUserReview: "需要人工检查",
          agentInfrastructureFailed: "Agent 会话失败",
          interrupted: "已中断",
          cancelled: "已停止",
          unknown: "处理中"
        },
        stages: {
          pagePlan: "页面规划",
          researchPlanning: "检索需求规划",
          researchDiscovery: "资料发现",
          researchCollection: "搜索并抓取资料",
          researchCuration: "筛选证据",
          evidencePagePlanning: "证据感知页面规划",
          webResearchCuration: "筛选事实证据",
          visualResearchCuration: "筛选图片素材",
          prepare: "文件准备",
          persistentElements: "生成跨页装饰",
          authoring: "设计页面内容和布局",
          deckRefinement: "整套优化",
          rendering: "页面渲染",
          renderFix: "渲染问题修复",
          visualReview: "页面视觉检查",
          visualReviewFix: "视觉检查后调整",
          finalRender: "最终预览",
          accepted: "页面已通过",
          failed: "阶段失败",
          pending: "等待开始",
          unknown: "处理中"
        }
      },
      cancelled: "已停止生成",
      cancelling: "正在停止当前生成..."
    },
    deck: {
      title: "AI Agent 工作流",
      subtitle: "本地项目数据",
      slideCounter: "{current} / {total}",
      previousSlide: "上一页",
      nextSlide: "下一页"
    },
    library: {
      title: "设置",
      workspace: "工作区",
      workspacePath: "Anna 工作区 / PPT",
      currentWorkspace: "当前任务",
      noWorkspaceSelected: "未选择任务",
      empty: "暂无任务",
      createWorkspace: "新建任务",
      defaultWorkspaceTitle: "新建任务-{date}",
      preferences: "偏好设置",
      runtimeInfoTitle: "运行信息",
      annaDeckVersion: "Anna Deck 版本",
      pptEngineVersion: "ppt-engine 版本",
      runtimeInfoUnavailable: "暂时无法获取运行版本。",
      agentResourceInfoTitle: "Agent 配置信息",
      agentResourceInfoDescription: "用于问题排查的 Agent 环境与 ppt-engine 进程资源快照。",
      agentResourceInfoRefresh: "刷新 Agent 配置信息",
      agentResourceInfoRefreshing: "正在刷新……",
      agentResourceInfoUnavailable: "暂时无法获取 Agent 资源信息。",
      agentResourceInfoSystem: "系统资源",
      agentResourceInfoProcess: "ppt-engine 进程",
      agentResourceInfoCpuUsage: "系统 CPU 占用",
      agentResourceInfoProcessCpuUsage: "进程 CPU 占用",
      agentResourceInfoConfiguredCores: "CPU 配额",
      agentResourceInfoVisibleCores: "可见 CPU 核数",
      agentResourceInfoMemoryUsage: "系统内存占用",
      agentResourceInfoProcessMemory: "进程 RSS 内存",
      agentResourceInfoPlatform: "平台",
      agentResourceInfoNode: "Node.js",
      agentResourceInfoLoadAverage: "Load average",
      agentResourceInfoSampledAt: "最近刷新",
      agentResourceInfoCgroupLimit: "cgroup 配额",
      agentResourceInfoSystemVisible: "系统可见值",
      agentResourceInfoUnknown: "不可用",
      lastEditedToday: "今天编辑",
      lastEditedYesterday: "昨天编辑",
      lastEditedDate: "{date} 编辑",
      diagnosticBundleTitle: "问题排查包",
      diagnosticBundleDescription: "将当前任务的完整工作区重新打包为 ZIP，供问题排查使用。任务仍在运行时，打包过程中内容可能继续变化。",
      diagnosticBundleSensitiveHint: "包含日志、上传资料、页面源码、研究记录和生成产物等完整任务内容。",
      diagnosticBundleNoWorkspace: "请先选择一个任务",
      diagnosticBundleDownload: "下载问题排查包",
      diagnosticBundleDownloadStarted: "已开始下载，请在浏览器下载列表中查看。",
      diagnosticBundleDownloadStartedWithLink: "已开始下载。如果浏览器拦截了，可以复制下面的链接。",
      diagnosticBundleDownloadFallbackHint: "如果没有自动开始下载，请复制链接并粘贴到普通浏览器地址栏中下载，不要将链接分享给无关人员。",
      diagnosticBundlePreparing: "正在打包并上传，请稍候……",
      diagnosticBundleRefresh: "重新生成问题排查包",
      diagnosticBundleRetry: "重试生成下载链接",
      diagnosticBundleReady: "问题排查包下载链接已准备。",
      diagnosticBundleExpired: "下载链接已过期，请重新生成问题排查包。",
      diagnosticBundleFailed: "问题排查包生成失败。",
      diagnosticBundleFailedPrefix: "问题排查包生成失败：",
      diagnosticBundleLinkLabel: "问题排查包下载链接",
      diagnosticBundleCopyLink: "复制问题排查包链接",
      diagnosticBundleLinkCopied: "链接已复制，请粘贴到浏览器地址栏中下载，并且不要分享给无关人员。"
    },
    performance: {
      title: "性能测试",
      description: "记录内部测试中的按钮交互、后端往返和工作流耗时。数据保存在 PPT 全局 performance-runs 目录中。",
      unavailable: "当前 ppt-engine 不支持性能测试。",
      loading: "正在加载性能测试记录……",
      active: "正在记录",
      inactive: "未开始记录",
      start: "开始记录",
      finish: "结束并生成报告",
      abandon: "放弃本次记录",
      history: "历史记录",
      empty: "暂无性能测试记录。",
      viewReport: "查看报告",
      regenerateReport: "重新生成报告",
      deleteRun: "删除记录",
      refresh: "刷新记录",
      events: "条事件",
      integrity: "数据完整性",
      startedAt: "开始时间",
      completed: "已完成",
      abandoned: "已放弃",
      finalizationFailed: "报告生成失败",
      recording: "记录中",
      reportTitle: "性能测试报告",
      reportLoading: "正在加载报告……",
      started: "性能记录已开始。",
      reportGenerated: "性能报告已生成。",
      reportRegenerated: "性能报告已重新生成。",
      activeOperationsTitle: "仍有操作正在记录",
      activeOperationsBody: "仍有 {count} 个操作未完成。强制结束会将这些测量标记为中断，但不会停止正在执行的产品任务。",
      keepRecording: "继续记录",
      forceFinish: "强制结束",
      abandonTitle: "放弃本次性能记录？",
      abandonBody: "本次原始事件会保留，但不会生成报告。",
      abandonConfirm: "放弃记录",
      deleteTitle: "删除性能记录？",
      deleteBody: "将永久删除 {runId} 的原始事件和报告。",
      deleteConfirm: "永久删除",
      startFailed: "性能记录启动失败。",
      finalizeFailed: "性能记录结束失败。",
      abandonFailed: "放弃性能记录失败。",
      deleteFailed: "删除性能记录失败。",
      reportFailed: "打开性能报告失败。",
      regenerateFailed: "重新生成性能报告失败。"
    },
    myWork: {
      title: "我的作品",
      home: "首页",
      presentations: "演示文稿",
      inProgress: "未完成项目",
      newPresentation: "新建演示文稿",
      emptyPresentations: "还没有已生成的演示文稿。",
      emptyInProgress: "没有未完成项目。",
      loading: "正在加载项目……",
      loadFailed: "项目加载失败。",
      retry: "重试",
      menu: "项目操作",
      rename: "重命名",
      renameTitle: "重命名项目",
      renamePlaceholder: "项目名称",
      delete: "删除",
      deleteTitle: "删除项目？",
      deleteBody: "将永久删除“{title}”及其中的全部文件，此操作无法撤销。",
      deleteConfirm: "永久删除",
      coverLoading: "封面加载中",
      coverUnavailable: "暂无封面",
      opening: "正在打开……",
      openFailed: "这个项目暂时无法打开。",
      openRetry: "重新打开",
      duplicate: "创建副本",
      duplicateTitle: "{title} 副本",
      duplicating: "正在复制……",
      duplicateFailed: "这个项目暂时无法复制。",
      duplicated: "已复制项目"
    },
    preferences: {
      defaultLanguage: "默认语言",
      textDensity: "文字密度",
      visualTone: "视觉语气",
      pageGenerationConcurrency: "页面生成并发数",
      researchImageSessionConcurrency: "图片研究 Session 并发数",
      visualReviewEnabled: "视觉检查",
      visualReviewFailureLimit: "视觉检查失败次数上限",
      disableWebResearch: "禁止网络资料搜索",
      disableImageResearch: "禁止图片搜索",
      enabled: "开启",
      disabled: "关闭"
    },
    review: {
      title: "预览演示文稿",
      grid: "网格",
      organize: "整理",
      present: "放映",
      htmlGate: "导出 PPTX 前需要先完成 HTML 审阅。",
      rendering: "正在渲染 HTML 预览",
      renderAgain: "重新渲染",
      renderFailed: "渲染失败",
      openHtml: "打开 HTML"
    },
    refine: {
      title: "优化",
      deckScope: "整套",
      slideScope: "当前页",
      deckPrompt: "告诉 Anna 如何优化整套演示...",
      deckPlaceholder: "让它更面向高管、减少文字、增加工作流图，并强化叙事。",
      slidePrompt: "告诉 Anna 当前页需要怎么改...",
      slidePlaceholder: "让这一页更视觉化，缩短副标题，并增加一个工作流图。",
      slideHelper: "改动只会应用到第 {number} 页。",
      deckSteps: [
        "读取当前演示文稿",
        "应用你的修改方向",
        "压缩页面文案",
        "提升视觉一致性",
        "保持大纲结构"
      ],
      slideSteps: ["重写选中页面", "更新页面视觉"]
    },
    manualEditor: {
      title: "编辑 PPT",
      loading: "正在加载页面…",
      loadFailed: "加载页面 HTML 失败：HTTP {status}",
      tooLarge: "当前页面 HTML 超过 64 MiB，无法保存。",
      imageRejected: "仅支持不超过 20 MiB 的 PNG、JPEG、WebP 图片。",
      fontRejected: "仅支持不超过 20 MiB 的有效 TTF、OTF、WOFF、WOFF2 字体。",
      fontLoadFailed: "受管字体加载失败：{message}",
      missingShell: "页面缺少可编辑 slide shell。",
      reloadLatest: "加载后端最新版本",
      newTextPlaceholder: "双击输入文字",
      expandPages: "展开页面列表",
      collapsePages: "收起页面列表",
      saveStatus: {
        saved: "已保存",
        saving: "保存中…",
        conflict: "保存冲突",
        failed: "保存失败",
        unsaved: "未保存"
      },
      undo: "撤销（Ctrl/Cmd+Z）",
      redo: "重做（Ctrl/Cmd+Shift+Z）",
      addText: "新增文本",
      addShape: "新增形状",
      addImage: "新增图片",
      fontFamily: "字体",
      uploadFont: "上传字体…",
      fontSize: "字号",
      bold: "加粗",
      italic: "斜体",
      underline: "下划线",
      strikethrough: "删除线",
      alignLeft: "左对齐",
      alignCenter: "居中",
      alignRight: "右对齐",
      lineHeight: "行高",
      spaceAfter: "段后间距",
      textColor: "文字颜色",
      replaceImage: "替换图片",
      cropImage: "裁剪",
      resetCrop: "重置裁剪",
      fill: "填充",
      fillColor: "填充颜色",
      noFill: "无填充",
      border: "边框",
      borderColor: "边框颜色",
      borderWidth: "边框宽度",
      deleteElement: "删除（Delete）",
      more: "更多",
      selectParent: "选择父级",
      restoreAiVersion: "恢复 AI 版本",
      fitWindow: "适应窗口",
      zoomOut: "缩小",
      zoomIn: "放大",
      restoreConfirm: {
        title: "恢复 AI 生成版本",
        body: "当前人工修改将被删除，并重新渲染现有 TSX。",
        confirm: "确认恢复"
      },
      unsavedConfirm: {
        title: "当前页面有未保存修改",
        body: "请选择保存、放弃修改或继续编辑。",
        keepEditing: "继续编辑",
        discard: "放弃"
      }
    },
    exportPage: {
      title: "导出",
      pptxDescription: "可编辑 PowerPoint 文件",
      pdfDescription: "适合分享的文档",
      preparing: "正在准备...",
      ready: "{type} 已就绪",
      noFile: "暂无可下载文件",
      download: "下载",
      downloadPreparing: "准备下载...",
      retryDownload: "重试下载",
      downloadNotPrepared: "可以下载了。",
      downloadReady: "下载链接已准备。",
      downloadStarted: "已开始下载。",
      downloadStartedWithLink: "已开始下载。如果浏览器没有保存文件，请用下方链接。",
      downloadLinkLabel: "下载链接",
      copyDownloadLink: "复制下载链接",
      downloadLinkCopied: "下载链接已复制，请粘贴到浏览器地址栏中下载。",
      downloadFallbackHint: "复制链接后粘贴到浏览器地址栏打开。",
      pptxPreparingModel: "正在准备 PPTX 模型",
      pptxModelReady: "PPTX 模型已准备",
      pptxGenerating: "正在生成 PPTX 文件",
      pptxFailed: "PPTX 导出失败",
      pdfGenerating: "正在生成 PDF 文件",
      pptxQueued: "PPTX 导出已排队",
      checkingStatus: "正在查询导出状态……",
      resumedJob: "已重新连接到这份演示文稿正在进行的导出任务。",
      exportFailedSummary: "导出未能完成。",
      retryExport: "重新导出",
      pptxTimedOut: "PPTX 导出等待超时。",
      fontVariantWarning: "以下托管字体缺少字形，使用时将模拟粗体或斜体：{warnings}"
    },
    toasts: {
      localFolder: "正在打开本地文件夹...",
      attachmentAdded: "已添加上传资料",
      attachmentRemoved: "已移除上传资料",
      outlineUpdated: "大纲已调整",
      outlineSkipped: "这份演示跳过了大纲审阅",
      promptRequired: "请先输入 prompt",
      confirmRequirementsFirst: "演示需求已修改，请先重新确认演示需求",
      createOutlineFirst: "请先创建大纲",
      createDeckFirst: "请先创建演示文稿",
      workspaceOpened: "已打开任务 {id}",
      workspaceCreated: "已创建任务 {id}",
      workspaceDuplicated: "已复制任务 {id}",
      pptxExported: "PPTX 已导出",
      pdfExported: "PDF 已导出"
    },
    errors: {
      uploadedSourceAnalysisUnavailable: "Agent 会话尚未就绪，无法分析上传资料。",
      uploadedSourceAnalysisBlocked: "上传资料分析阻止了大纲创建",
      summaryTimeout: "这次请求等待超时，处理时间比预期更长。",
      summaryTransport: "文件在 Anna 和本应用之间传输失败。",
      summaryNotFound: "需要的内容已经不存在。",
      summaryNetwork: "无法连接 Anna，请检查网络后重试。",
      summaryUnknown: "出了点问题，请重试。",
      showDetails: "查看技术详情",
      hideDetails: "收起技术详情",
      detailsLabel: "技术详情"
    }
  }
};

export function formatMessage(
  template: string,
  values: Record<string, string | number>
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template
  );
}
