import React from "react";
import * as z from "zod";

import { BalancedComparisonDecorations } from "../components/ComparisonDecorations.tsx";
import ComparisonTablePanel, {
  type ComparisonTableColumn,
  type ComparisonTableRow,
} from "../components/ComparisonTablePanel.tsx";
import ImageShowcasePanel, { type ImageShowcaseImage } from "../components/ImageShowcasePanel.tsx";
import ThemeContentFrame from "../components/ThemeContentFrame.tsx";

const ToneSchema = z.enum(["red", "blue", "purple", "neutral"]);

const ImageSchema = z.object({
  url: z.string().max(5000).default(""),
  title: z.string().max(48).optional(),
  caption: z.string().max(150).optional(),
  source: z.string().max(90).optional(),
  alt: z.string().max(120).optional(),
  fit: z.enum(["cover", "contain"]).default("cover"),
  tone: ToneSchema.default("purple"),
});

const TableColumnSchema = z.object({
  label: z.string().min(1).max(28),
  width: z.string().min(2).max(28).optional(),
  align: z.enum(["left", "center", "right"]).default("left"),
  tone: ToneSchema.optional(),
});

const TableCellSchema = z.object({
  value: z.string().min(1).max(42),
  note: z.string().max(70).optional(),
  tone: ToneSchema.optional(),
  emphasis: z.boolean().default(false),
  align: z.enum(["left", "center", "right"]).optional(),
});

const TableRowSchema = z.object({
  cells: z.array(TableCellSchema).min(3).max(4),
});

const defaultTableColumns: z.infer<typeof TableColumnSchema>[] = [
  { label: "Dimension", width: "1.08fr", align: "left", tone: "purple" },
  { label: "Entity A", width: "0.9fr", align: "center", tone: "red" },
  { label: "Entity B", width: "0.9fr", align: "center", tone: "blue" },
  { label: "Signal", width: "1.16fr", align: "left", tone: "purple" },
];

const defaultTableRows: z.infer<typeof TableRowSchema>[] = [
  {
    cells: [
      { value: "Visual footprint", note: "What the image shows", emphasis: false },
      { value: "High", tone: "red", emphasis: true, align: "center" },
      { value: "Focused", tone: "blue", emphasis: true, align: "center" },
      { value: "Different scale", note: "Use concise interpretation", emphasis: false },
    ],
  },
  {
    cells: [
      { value: "Operating model", note: "Visible pattern", emphasis: false },
      { value: "Broad base", tone: "red", emphasis: false, align: "center" },
      { value: "Specialized", tone: "blue", emphasis: false, align: "center" },
      { value: "Complementary strengths", emphasis: false },
    ],
  },
  {
    cells: [
      { value: "Evidence confidence", note: "Image plus source", emphasis: false },
      { value: "Medium", tone: "purple", emphasis: false, align: "center" },
      { value: "Medium", tone: "purple", emphasis: false, align: "center" },
      { value: "Validate with data", emphasis: false },
    ],
  },
];

export const Schema = z.object({
  titlePrefix: z.string().min(2).max(30).default("Evidence View:"),
  titleHighlight: z.string().min(2).max(34).default("Image & Table"),
  subtitle: z
    .string()
    .min(8)
    .max(120)
    .default("Pair one visual asset with a compact structured comparison table."),
  footerText: z.string().min(4).max(80).default("Red Blue Comparison | Evidence View"),
  pageNumber: z.string().min(1).max(4).default("09"),
  image: ImageSchema.default({
    url: "",
    title: "Primary visual evidence",
    caption: "Use one strong image, map, product photo, screenshot, or research visual as the page anchor.",
    source: "SOURCE: TBD",
    alt: "Primary visual evidence",
    fit: "cover",
    tone: "purple",
  }),
  tableTitle: z.string().min(2).max(40).default("Structured comparison"),
  tableSubtitle: z.string().min(4).max(90).default("Summarize the image-backed observations in editable rows."),
  tableColumns: z.array(TableColumnSchema).min(3).max(4).default(defaultTableColumns),
  tableRows: z.array(TableRowSchema).min(2).max(5).default(defaultTableRows),
  tableFooterNote: z
    .string()
    .max(140)
    .default("Use the table for observable evidence and short interpretation; keep detailed methodology outside this page."),
  showDecorations: z.boolean().default(true),
});

export const sampleData = Schema.parse({});

export const layoutId = "evidence-image-table";
export const layoutName = "Evidence Image Table";
export const layoutDescription =
  "A TSX-first comparison page that pairs one primary image with a compact editable evidence table.";
export const layoutTags = ["image", "table", "evidence", "comparison", "red-blue", "tsx-first"];
export const layoutRole = "content";
export const contentElements = ["page-title", "subtitle", "image-showcase", "image-caption", "comparison-table", "table-note"];
export const useCases = ["visual evidence comparison", "case image with table", "asset screenshot analysis", "field observation summary"];
export const suitableFor =
  "Suitable for pages where one image is important evidence and the audience needs a concise comparison table beside it.";
export const avoidFor =
  "Avoid using this layout for dashboards, more than one primary image, long narrative, dense data tables, or chart-first analysis.";
export const density = "medium";
export const visualWeight = "balanced";
export const editableTextPriority = "high";

const EvidenceImageTable = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  const parsed = Schema.parse(data ?? {});

  return (
    <ThemeContentFrame
      titlePrefix={parsed.titlePrefix}
      titleHighlight={parsed.titleHighlight}
      subtitle={parsed.subtitle}
      tone="purple"
      footerText={parsed.footerText}
      pageNumber={parsed.pageNumber}
      showHeaderDivider={false}
      contentTop={150}
      contentHeight={512}
    >
      {parsed.showDecorations ? <BalancedComparisonDecorations /> : null}
      <div className="relative z-10 grid h-full min-h-0 grid-cols-[0.95fr_1.25fr] gap-[30px]">
        <ImageShowcasePanel image={parsed.image as ImageShowcaseImage} />
        <ComparisonTablePanel
          title={parsed.tableTitle}
          subtitle={parsed.tableSubtitle}
          columns={parsed.tableColumns as ComparisonTableColumn[]}
          rows={parsed.tableRows as ComparisonTableRow[]}
          footerNote={parsed.tableFooterNote}
          tone="purple"
        />
      </div>
    </ThemeContentFrame>
  );
};

export default EvidenceImageTable;
