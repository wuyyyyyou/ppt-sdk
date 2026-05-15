export interface ToolIds {
  pptEngine: string;
  pptGener: string;
}

export interface CreateProjectInput {
  projectDir: string;
  title: string;
  initialRequest?: string;
}

export interface ProjectResult {
  projectDir: string;
  state: unknown;
  nextStep?: string;
}

export interface RecordRequirementsInput {
  projectDir: string;
  requirements: string;
}

export interface ListTemplatesInput {
  projectDir?: string;
}

export interface TemplateSummary {
  id: string;
  name: string;
  description?: string;
}

export interface ListTemplatesResult {
  templates: TemplateSummary[];
}

export interface SelectTemplateInput {
  projectDir: string;
  templateId: string;
}

export interface RecordOutlineInput {
  projectDir: string;
  outline: unknown;
}

export interface RenderDeckHtmlInput {
  projectDir: string;
}

export interface RenderDeckHtmlResult {
  htmlPath: string;
  screenshotPaths: string[];
  diagnostics?: unknown;
}

export interface RecordDeckReviewInput {
  projectDir: string;
  approved: boolean;
  feedback?: string;
}

export interface PrepareExportModelInput {
  projectDir: string;
}

export interface PrepareExportModelResult {
  modelPath: string;
}

export interface GeneratePptxInput {
  modelPath: string;
  outputPath: string;
}

export interface GeneratePptxResult {
  pptxPath: string;
  summary?: unknown;
}

export interface RecordPptxExportInput {
  projectDir: string;
  pptxPath: string;
  generatorResult?: unknown;
}
