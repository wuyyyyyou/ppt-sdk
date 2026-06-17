export type Locale = "en" | "zh";

export interface Messages {
  appName: string;
  languageName: string;
  controls: {
    library: string;
    minimize: string;
    close: string;
    back: string;
    open: string;
    edit: string;
    cancel: string;
    save: string;
    suggestContext: string;
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
    pptx: string;
    pdf: string;
    useTemplate: string;
    stop: string;
  };
  stages: {
    template: string;
    brief: string;
    outline: string;
    generating: string;
    deck: string;
  };
  status: {
    draftReady: string;
    outlineReady: string;
    creatingOutline: string;
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
    reviewOutlineFirst: string;
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
      | "aspectRatio"
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
  };
  template: {
    title: string;
    helper: string;
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
    editOutline: string;
    saveChanges: string;
    cancelChanges: string;
    readOnlyHint: string;
    feedbackPlaceholder: string;
    fallbackSummary: string;
  };
  generating: {
    progressTitle: string;
    generationComplete: string;
    interruptedTitle: string;
    unresumableTitle: string;
    stoppingTitle: string;
    stayOnPageHint: string;
    pagesPassed: string;
    pageLabel: string;
    steps: {
      outline: string;
      pagePlan: string;
      prepare: string;
      pages: string;
      finalRender: string;
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
        | "contentReview"
        | "contentReviewFixing"
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
        | "researchCollection"
        | "researchCuration"
        | "prepare"
        | "authoring"
        | "contentReview"
        | "contentReviewFix"
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
    lastEditedToday: string;
    lastEditedYesterday: string;
    lastEditedDate: string;
  };
  preferences: {
    aspectRatio: string;
    defaultLanguage: string;
    textDensity: string;
    visualTone: string;
    typography: string;
    contentReviewEnabled: string;
    contentReviewFailureLimit: string;
    visualReviewEnabled: string;
    visualReviewFailureLimit: string;
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
  exportPage: {
    title: string;
    pptxDescription: string;
    pdfDescription: string;
    preparing: string;
    ready: string;
    noFile: string;
    download: string;
    pptxPreparingModel: string;
    pptxModelReady: string;
    pptxGenerating: string;
    pptxFailed: string;
    pdfGenerating: string;
  };
  toasts: {
    localFolder: string;
    attachmentAdded: string;
    outlineUpdated: string;
    outlineSkipped: string;
    promptRequired: string;
    contextSuggested: string;
    contextSuggestionEmpty: string;
    createOutlineFirst: string;
    createDeckFirst: string;
    workspaceOpened: string;
    workspaceCreated: string;
    pptxExported: string;
    pdfExported: string;
  };
}

export const messages: Record<Locale, Messages> = {
  en: {
    appName: "AnnaDeck",
    languageName: "English",
    controls: {
      library: "Library",
      minimize: "Minimize",
      close: "Close",
      back: "Back",
      open: "Open",
      edit: "Edit",
      cancel: "Cancel",
      save: "Save",
      suggestContext: "Suggest context",
      suggestions: "Suggestions",
      createDeck: "Create deck",
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
      pptx: "PPTX",
      pdf: "PDF",
      useTemplate: "Use style",
      stop: "Stop"
    },
    stages: {
      template: "Template",
      brief: "Brief",
      outline: "Outline",
      generating: "Generating",
      deck: "Deck"
    },
    status: {
      draftReady: "Draft ready",
      outlineReady: "Outline ready",
      creatingOutline: "Creating outline...",
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
      reviewOutlineFirst: "Review outline first",
      strictReviewMode: "Strict review mode",
      strictReviewModeHelp:
        "Strict review mode runs extra content and visual checks after each page is generated. It may substantially increase generation time and token usage.",
      strictReviewConfirmTitle: "Enable strict review mode?",
      strictReviewConfirmBody:
        "When enabled, Anna will call the model again after each page is generated to check page content and visual quality. This may substantially increase PPT generation time and token usage, and the review quality depends on the default model's capabilities. Are you sure you want to enable it?",
      strictReviewConfirmAction: "Enable strict review",
      optionalContext: "Optional context",
      chips: {
        audience: "Audience",
        goal: "Goal",
        style: "Style",
        theme: "Theme",
        content: "Content",
        attachment: "Attachment",
        template: "Template"
      },
      contextLabels: {
        audience: "Audience",
        goal: "Goal",
        styleNotes: "Style notes",
        theme: "Theme color",
        contentSource: "Content source",
        attachment: "Attachment",
        slides: "Slides",
        textPerSlide: "Text per slide",
        outputLanguage: "Output language",
        aspectRatio: "Aspect ratio",
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
      }
    },
    template: {
      title: "Choose a style",
      helper: "Pick the visual style Anna should use for this deck.",
      loading: "Loading templates...",
      empty: "No templates found.",
      layouts: "layouts",
      selected: "Style selected",
      viewAll: "View all pages",
      previewTitle: "Style preview",
      pageCounter: "{current} / {total}",
      previous: "Previous",
      next: "Next",
      close: "Close"
    },
    outline: {
      title: "Review outline",
      helper: "Adjust the structure before Anna designs the deck.",
      cardTitle: "Outline",
      editOutline: "Modify outline",
      saveChanges: "Save changes",
      cancelChanges: "Cancel editing",
      readOnlyHint: "Read-only until you choose to modify the outline.",
      feedbackPlaceholder:
        "Enter a rewrite request, such as adding a security slide, making it more executive-facing, or reducing to 5 slides...",
      fallbackSummary: "Add supporting points and details for this slide."
    },
    generating: {
      progressTitle: "Generation progress",
      generationComplete: "Generation complete",
      interruptedTitle: "Generation interrupted",
      unresumableTitle: "Unable to resume generation",
      stoppingTitle: "Stopping generation",
      stayOnPageHint: "Please do not leave this page.",
      pagesPassed: "{completed}/{total} pages passed",
      pageLabel: "Page {page}",
      steps: {
        outline: "Outline",
        pagePlan: "Page plan",
        prepare: "Prepare files",
        pages: "Pages",
        finalRender: "Final preview"
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
          contentReview: "Checking page content",
          contentReviewFixing: "Adjusting content after review",
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
          researchCollection: "Collecting sources",
          researchCuration: "Curating evidence",
          prepare: "File preparation",
          authoring: "Page expression",
          contentReview: "Page content review",
          contentReviewFix: "Content review adjustment",
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
      slideCounter: "{current} / {total}"
    },
    library: {
      title: "Local decks",
      workspace: "Workspace",
      workspacePath: "Anna Workspace / PPT",
      currentWorkspace: "Current task",
      noWorkspaceSelected: "No task selected",
      empty: "No tasks yet",
      createWorkspace: "New task",
      defaultWorkspaceTitle: "New Task-{date}",
      preferences: "Preferences",
      lastEditedToday: "Last edited today",
      lastEditedYesterday: "Last edited yesterday",
      lastEditedDate: "Last edited {date}"
    },
    preferences: {
      aspectRatio: "Aspect ratio",
      defaultLanguage: "Default language",
      textDensity: "Text density",
      visualTone: "Visual tone",
      typography: "Typography",
      contentReviewEnabled: "Content fact check",
      contentReviewFailureLimit: "Content check failure limit",
      visualReviewEnabled: "Visual check",
      visualReviewFailureLimit: "Visual check failure limit",
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
    exportPage: {
      title: "Export",
      pptxDescription: "Editable PowerPoint file",
      pdfDescription: "Share-ready document",
      preparing: "Preparing...",
      ready: "{type} ready",
      noFile: "No export file ready",
      download: "Download",
      pptxPreparingModel: "Preparing PPTX model",
      pptxModelReady: "PPTX model ready",
      pptxGenerating: "Generating PPTX file",
      pptxFailed: "PPTX export failed",
      pdfGenerating: "Generating PDF file"
    },
    toasts: {
      localFolder: "Opening local folder...",
      attachmentAdded: "Attachment added",
      outlineUpdated: "Outline revised",
      outlineSkipped: "Outline was skipped for this deck",
      promptRequired: "Enter a prompt first",
      contextSuggested: "Optional context updated",
      contextSuggestionEmpty: "No context suggestions found",
      createOutlineFirst: "Create the outline first",
      createDeckFirst: "Create the deck first",
      workspaceOpened: "Opened task {id}",
      workspaceCreated: "Created task {id}",
      pptxExported: "PPTX exported",
      pdfExported: "PDF exported"
    }
  },
  zh: {
    appName: "AnnaDeck",
    languageName: "中文",
    controls: {
      library: "资料库",
      minimize: "最小化",
      close: "关闭",
      back: "返回",
      open: "打开",
      edit: "编辑",
      cancel: "取消",
      save: "保存",
      suggestContext: "补全上下文",
      suggestions: "建议",
      createDeck: "创建演示文稿",
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
      pptx: "PPTX",
      pdf: "PDF",
      useTemplate: "使用风格",
      stop: "停止"
    },
    stages: {
      template: "模板",
      brief: "需求",
      outline: "大纲",
      generating: "生成中",
      deck: "成稿"
    },
    status: {
      draftReady: "草稿已就绪",
      outlineReady: "大纲已就绪",
      creatingOutline: "正在创建大纲...",
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
      reviewOutlineFirst: "先审阅大纲",
      strictReviewMode: "严格审查模式",
      strictReviewModeHelp:
        "开启后会在每页生成后额外进行内容和视觉检查，可能显著增加生成时间和 token 消耗。",
      strictReviewConfirmTitle: "开启严格审查模式？",
      strictReviewConfirmBody:
        "开启后，Anna 会在每页生成后再次调用大模型检查页面内容和视觉效果。这可能显著延长 PPT 生成时间，并消耗更多 token；检查质量也会受默认模型能力影响。确定要开启吗？",
      strictReviewConfirmAction: "开启严格审查",
      optionalContext: "可选上下文",
      chips: {
        audience: "受众",
        goal: "目标",
        style: "风格",
        theme: "主题色",
        content: "内容",
        attachment: "附件",
        template: "模板选择"
      },
      contextLabels: {
        audience: "受众",
        goal: "目标",
        styleNotes: "风格说明",
        theme: "主题色",
        contentSource: "内容来源",
        attachment: "附件",
        slides: "页数",
        textPerSlide: "单页文字量",
        outputLanguage: "输出语言",
        aspectRatio: "画幅比例",
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
      }
    },
    template: {
      title: "选择风格",
      helper: "选择 Anna 生成这份演示时使用的视觉风格。",
      loading: "正在加载模板...",
      empty: "没有发现可用模板。",
      layouts: "个版式",
      selected: "已选择风格",
      viewAll: "查看全部页面",
      previewTitle: "风格预览",
      pageCounter: "{current} / {total}",
      previous: "上一页",
      next: "下一页",
      close: "关闭"
    },
    outline: {
      title: "审阅大纲",
      helper: "先改结构，再确认后继续生成。",
      cardTitle: "大纲",
      editOutline: "修改大纲",
      saveChanges: "保存修改",
      cancelChanges: "取消修改",
      readOnlyHint: "默认只读，点击修改后才能编辑大纲。",
      feedbackPlaceholder: "输入重构需求，例如增加安全页、改成更面向高管，或缩减到 5 页...",
      fallbackSummary: "为这一页补充要点和细节。"
    },
    generating: {
      progressTitle: "生成进度",
      generationComplete: "生成完成",
      interruptedTitle: "生成中断",
      unresumableTitle: "无法继续生成",
      stoppingTitle: "正在停止",
      stayOnPageHint: "请勿离开此页面",
      pagesPassed: "{completed}/{total} 页通过",
      pageLabel: "第 {page} 页",
      steps: {
        outline: "大纲",
        pagePlan: "页面规划",
        prepare: "准备文件",
        pages: "逐页生成",
        finalRender: "最终预览"
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
          researchCurating: "正在筛选事实和图片",
          authoring: "正在思考这一页",
          contentReview: "正在检查页面内容",
          contentReviewFixing: "正在根据内容检查调整",
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
          researchCollection: "搜索并抓取资料",
          researchCuration: "筛选事实和图片",
          prepare: "文件准备",
          authoring: "页面表达",
          contentReview: "页面内容检查",
          contentReviewFix: "内容检查后调整",
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
      slideCounter: "{current} / {total}"
    },
    library: {
      title: "本地演示文稿",
      workspace: "工作区",
      workspacePath: "Anna 工作区 / PPT",
      currentWorkspace: "当前任务",
      noWorkspaceSelected: "未选择任务",
      empty: "暂无任务",
      createWorkspace: "新建任务",
      defaultWorkspaceTitle: "新建任务-{date}",
      preferences: "偏好设置",
      lastEditedToday: "今天编辑",
      lastEditedYesterday: "昨天编辑",
      lastEditedDate: "{date} 编辑"
    },
    preferences: {
      aspectRatio: "画幅比例",
      defaultLanguage: "默认语言",
      textDensity: "文字密度",
      visualTone: "视觉语气",
      typography: "字体风格",
      contentReviewEnabled: "内容事实检查",
      contentReviewFailureLimit: "内容检查失败次数上限",
      visualReviewEnabled: "视觉检查",
      visualReviewFailureLimit: "视觉检查失败次数上限",
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
    exportPage: {
      title: "导出",
      pptxDescription: "可编辑 PowerPoint 文件",
      pdfDescription: "适合分享的文档",
      preparing: "正在准备...",
      ready: "{type} 已就绪",
      noFile: "暂无可下载文件",
      download: "下载",
      pptxPreparingModel: "正在准备 PPTX 模型",
      pptxModelReady: "PPTX 模型已准备",
      pptxGenerating: "正在生成 PPTX 文件",
      pptxFailed: "PPTX 导出失败",
      pdfGenerating: "正在生成 PDF 文件"
    },
    toasts: {
      localFolder: "正在打开本地文件夹...",
      attachmentAdded: "已添加附件",
      outlineUpdated: "大纲已调整",
      outlineSkipped: "这份演示跳过了大纲审阅",
      promptRequired: "请先输入 prompt",
      contextSuggested: "可选上下文已更新",
      contextSuggestionEmpty: "没有生成可用的上下文建议",
      createOutlineFirst: "请先创建大纲",
      createDeckFirst: "请先创建演示文稿",
      workspaceOpened: "已打开任务 {id}",
      workspaceCreated: "已创建任务 {id}",
      pptxExported: "PPTX 已导出",
      pdfExported: "PDF 已导出"
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
