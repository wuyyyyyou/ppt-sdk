export interface TemplateRenderThemeInput {
  logo_url?: string | null;
  company_name?: string | null;
  colors?: Record<string, string> | null;
  fonts?: {
    body?: {
      name?: string | null;
      url?: string | null;
    } | null;
  } | null;
  data?: {
    colors?: Record<string, string> | null;
    fonts?: {
      textFont?: {
        name?: string | null;
        url?: string | null;
      } | null;
    } | null;
  } | null;
}

export interface RenderSlideHtmlInput {
  template_group: string;
  layout_id: string;
  slide_data: Record<string, unknown>;
  theme?: TemplateRenderThemeInput | null;
  speaker_note?: string | null;
  title?: string | null;
}

export interface BuildDeckHtmlSlideInput {
  html: string;
  speaker_note?: string | null;
}

export interface BuildDeckHtmlInput {
  slides: BuildDeckHtmlSlideInput[];
  title?: string | null;
}

export interface BuildStandaloneDeckHtmlSlideInput {
  html: string;
  speaker_note?: string | null;
}

export interface BuildStandaloneDeckHtmlInput {
  slides: BuildStandaloneDeckHtmlSlideInput[];
  title?: string | null;
}

export interface BuiltinDeckManifestSlideSource {
  type: "builtin";
  template_group: string;
  layout_id: string;
}

export interface LocalDeckManifestSlideSource {
  type: "local";
  path: string;
}

export type DeckManifestSlideSource =
  | BuiltinDeckManifestSlideSource
  | LocalDeckManifestSlideSource;

export interface DeckManifestSlideInput {
  id: string;
  source: DeckManifestSlideSource;
  data?: Record<string, unknown> | null;
  data_path?: string | null;
  title?: string | null;
  speaker_note?: string | null;
  theme?: TemplateRenderThemeInput | null;
}

export interface DeckManifestInput {
  title?: string | null;
  theme?: TemplateRenderThemeInput | null;
  slides: DeckManifestSlideInput[];
}

export interface BuildDeckHtmlFromManifestInput {
  manifestPath: string;
  outputDir: string;
  name?: string | null;
  singlePage?: boolean | null;
  page?: number | null;
  cwd?: string | null;
}

export interface BuildDeckHtmlFromManifestFileOutput {
  fileName: string;
  outputPath: string;
  slideId?: string;
  layoutId?: string;
}

export interface BuildDeckHtmlFromManifestResult {
  deckHtml: string;
  deckFileName: string;
  deckOutputPath: string;
  outputDir: string;
  deckGenerated: boolean;
  singlePage: boolean;
  page: number | null;
  slideFiles: BuildDeckHtmlFromManifestFileOutput[];
  slideCount: number;
  title: string;
  manifestPath: string;
}

export interface BrowserRenderTheme {
  logoUrl: string | null;
  companyName: string | null;
  colors: Record<string, string>;
  fontName: string | null;
  fontUrl: string | null;
}

export interface BrowserRenderContext {
  templateGroup: string;
  layoutId: string;
  slideData: Record<string, unknown>;
  speakerNote: string;
  title: string;
  theme: BrowserRenderTheme;
}
