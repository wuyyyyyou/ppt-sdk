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
    preview: string;
    export: string;
    applyToDeck: string;
    applyToSlide: string;
    revealInFinder: string;
    chooseFile: string;
    addSlide: string;
    duplicate: string;
    delete: string;
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
    waitingForStep: string;
    noStream: string;
    streamHint: string;
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
      preview: "Preview",
      export: "Export",
      applyToDeck: "Apply to deck",
      applyToSlide: "Apply to current slide",
      revealInFinder: "Reveal in Finder",
      chooseFile: "Choose file",
      addSlide: "Add slide",
      duplicate: "Duplicate",
      delete: "Delete",
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
      waitingForStep: "Waiting for step output",
      noStream: "No stream output yet",
      streamHint: "Live output appears after the step starts.",
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
      typography: "Typography"
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
      ready: "{type} ready"
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
      preview: "预览",
      export: "导出",
      applyToDeck: "应用到整套",
      applyToSlide: "应用到当前页",
      revealInFinder: "在 Finder 中显示",
      chooseFile: "选择文件",
      addSlide: "添加页面",
      duplicate: "复制",
      delete: "删除",
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
      waitingForStep: "等待步骤输出",
      noStream: "暂无流式输出",
      streamHint: "步骤开始后会显示实时输出。",
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
      typography: "字体风格"
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
      ready: "{type} 已就绪"
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
