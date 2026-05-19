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
    createDeck: string;
    updateDeck: string;
    updateOutline: string;
    createOutline: string;
    createDeckFromOutline: string;
    reviseOutline: string;
    refineDeck: string;
    refineSlide: string;
    preview: string;
    export: string;
    applyToDeck: string;
    applyToSlide: string;
    revealInFinder: string;
    chooseFile: string;
    addLook: string;
    changeLook: string;
    addSlide: string;
    duplicate: string;
    delete: string;
    pptx: string;
    pdf: string;
    useTemplate: string;
  };
  stages: {
    template: string;
    brief: string;
    outline: string;
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
    chips: Record<"audience" | "goal" | "style" | "content" | "attachment" | "more", string>;
    contextLabels: Record<
      | "audience"
      | "goal"
      | "styleNotes"
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
    feedbackPlaceholder: string;
    fallbackSummary: string;
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
  looks: Array<{
    id: string;
    name: string;
    hint: string;
    description: string;
  }>;
  toasts: {
    localFolder: string;
    attachmentAdded: string;
    outlineUpdated: string;
    outlineSkipped: string;
    createOutlineFirst: string;
    createDeckFirst: string;
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
      createDeck: "Create deck",
      updateDeck: "Update deck",
      updateOutline: "Update outline",
      createOutline: "Create outline",
      createDeckFromOutline: "Create deck",
      reviseOutline: "Revise outline",
      refineDeck: "Refine deck",
      refineSlide: "Refine slide",
      preview: "Preview",
      export: "Export",
      applyToDeck: "Apply to deck",
      applyToSlide: "Apply to current slide",
      revealInFinder: "Reveal in Finder",
      chooseFile: "Choose file",
      addLook: "Add look",
      changeLook: "Change look",
      addSlide: "Add slide",
      duplicate: "Duplicate",
      delete: "Delete",
      pptx: "PPTX",
      pdf: "PDF",
      useTemplate: "Use template"
    },
    stages: {
      template: "Template",
      brief: "Brief",
      outline: "Outline",
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
        content: "Content",
        attachment: "Attachment",
        more: "More options"
      },
      contextLabels: {
        audience: "Audience",
        goal: "Goal",
        styleNotes: "Style notes",
        contentSource: "Content source",
        attachment: "Attachment",
        slides: "Slides",
        textPerSlide: "Text per slide",
        outputLanguage: "Output language",
        aspectRatio: "Aspect ratio",
        look: "Look"
      },
      contextDefaults: {
        audience: "enterprise executives",
        goal: "explain the product and drive demo requests",
        styleNotes: "visual, concise, premium",
        contentSource: "Draft from scratch",
        attachmentPlaceholder: "logo, brand style, source notes...",
        outputLanguage: "English"
      }
    },
    template: {
      title: "Choose a template",
      helper: "Pick the visual system Anna should fork into this workspace.",
      loading: "Loading templates...",
      empty: "No templates found.",
      layouts: "layouts",
      selected: "Template selected",
      viewAll: "View all pages",
      previewTitle: "Template preview",
      pageCounter: "{current} / {total}",
      previous: "Previous",
      next: "Next",
      close: "Close"
    },
    outline: {
      title: "Review outline",
      helper: "Adjust the structure before Anna designs the deck.",
      feedbackPlaceholder:
        "Add a security slide, make it more executive-facing, or reduce to 5 slides...",
      fallbackSummary: "Add supporting points and details for this slide."
    },
    deck: {
      title: "AI Agent Workflows",
      subtitle: "Local project data",
      slideCounter: "{current} / {total}"
    },
    library: {
      title: "Local decks",
      workspace: "Workspace",
      workspacePath: "Anna Workspace / Presentations",
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
      htmlGate: "HTML review is required before PPTX export."
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
    looks: [
      {
        id: "saas",
        name: "Minimal SaaS",
        hint: "Clean · Airy",
        description: "clean layout · soft neutrals"
      },
      {
        id: "pitch",
        name: "Investor Pitch",
        hint: "Bold · Metrics",
        description: "bold claims · metrics"
      },
      {
        id: "workshop",
        name: "Workshop",
        hint: "Step-by-step",
        description: "step-by-step · instructional"
      },
      {
        id: "tech",
        name: "Technical",
        hint: "Diagrams",
        description: "diagrams · structured"
      },
      {
        id: "editorial",
        name: "Editorial",
        hint: "Premium",
        description: "narrative · premium"
      },
      {
        id: "dark",
        name: "Dark Mode",
        hint: "Cinematic",
        description: "dark canvas · cinematic"
      }
    ],
    toasts: {
      localFolder: "Opening local folder...",
      attachmentAdded: "Attachment added",
      outlineUpdated: "Outline revised",
      outlineSkipped: "Outline was skipped for this deck",
      createOutlineFirst: "Create the outline first",
      createDeckFirst: "Create the deck first",
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
      createDeck: "创建演示文稿",
      updateDeck: "更新演示文稿",
      updateOutline: "更新大纲",
      createOutline: "创建大纲",
      createDeckFromOutline: "创建演示文稿",
      reviseOutline: "调整大纲",
      refineDeck: "优化整套",
      refineSlide: "优化当前页",
      preview: "预览",
      export: "导出",
      applyToDeck: "应用到整套",
      applyToSlide: "应用到当前页",
      revealInFinder: "在 Finder 中显示",
      chooseFile: "选择文件",
      addLook: "添加风格",
      changeLook: "更换风格",
      addSlide: "添加页面",
      duplicate: "复制",
      delete: "删除",
      pptx: "PPTX",
      pdf: "PDF",
      useTemplate: "使用模板"
    },
    stages: {
      template: "模板",
      brief: "需求",
      outline: "大纲",
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
        content: "内容",
        attachment: "附件",
        more: "更多选项"
      },
      contextLabels: {
        audience: "受众",
        goal: "目标",
        styleNotes: "风格说明",
        contentSource: "内容来源",
        attachment: "附件",
        slides: "页数",
        textPerSlide: "单页文字量",
        outputLanguage: "输出语言",
        aspectRatio: "画幅比例",
        look: "视觉方向"
      },
      contextDefaults: {
        audience: "企业高管",
        goal: "说明产品并推动预约演示",
        styleNotes: "视觉化、简洁、高级",
        contentSource: "从零起草",
        attachmentPlaceholder: "logo、品牌风格、来源资料...",
        outputLanguage: "中文"
      }
    },
    template: {
      title: "选择模板",
      helper: "选择要 fork 到当前工作区的视觉模板。",
      loading: "正在加载模板...",
      empty: "没有发现可用模板。",
      layouts: "个版式",
      selected: "已选择模板",
      viewAll: "查看全部页面",
      previewTitle: "模板预览",
      pageCounter: "{current} / {total}",
      previous: "上一页",
      next: "下一页",
      close: "关闭"
    },
    outline: {
      title: "审阅大纲",
      helper: "在 Anna 设计页面前调整结构。",
      feedbackPlaceholder: "增加安全页、改成更面向高管、或缩减到 5 页...",
      fallbackSummary: "为这一页补充要点和细节。"
    },
    deck: {
      title: "AI Agent 工作流",
      subtitle: "本地项目数据",
      slideCounter: "{current} / {total}"
    },
    library: {
      title: "本地演示文稿",
      workspace: "工作区",
      workspacePath: "Anna 工作区 / Presentations",
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
      htmlGate: "导出 PPTX 前需要先完成 HTML 审阅。"
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
    looks: [
      {
        id: "saas",
        name: "极简 SaaS",
        hint: "干净 · 留白",
        description: "清爽版式 · 柔和中性色"
      },
      {
        id: "pitch",
        name: "投资人路演",
        hint: "有力 · 指标",
        description: "强主张 · 数据指标"
      },
      {
        id: "workshop",
        name: "工作坊",
        hint: "步骤化",
        description: "步骤清晰 · 教学说明"
      },
      {
        id: "tech",
        name: "技术说明",
        hint: "图解",
        description: "图表结构 · 层次清楚"
      },
      {
        id: "editorial",
        name: "编辑叙事",
        hint: "高级感",
        description: "叙事化 · 高级质感"
      },
      {
        id: "dark",
        name: "深色模式",
        hint: "电影感",
        description: "深色画布 · 电影感"
      }
    ],
    toasts: {
      localFolder: "正在打开本地文件夹...",
      attachmentAdded: "已添加附件",
      outlineUpdated: "大纲已调整",
      outlineSkipped: "这份演示跳过了大纲审阅",
      createOutlineFirst: "请先创建大纲",
      createDeckFirst: "请先创建演示文稿",
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
