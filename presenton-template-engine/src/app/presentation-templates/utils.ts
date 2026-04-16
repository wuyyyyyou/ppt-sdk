import * as z from "zod";

export type TemplateDensity = "low" | "medium" | "high";
export type TemplateVisualWeight = "text-heavy" | "balanced" | "visual-heavy";
export type TemplateEditableTextPriority = "high" | "medium" | "low";

export interface TemplateLayoutMetadata {
    layoutTags?: string[];
    layoutRole?: string;
    contentElements?: string[];
    useCases?: string[];
    suitableFor?: string;
    avoidFor?: string;
    density?: TemplateDensity;
    visualWeight?: TemplateVisualWeight;
    editableTextPriority?: TemplateEditableTextPriority;
}

export interface TemplateGroupMetadata {
    groupBrief?: string;
    styleTags?: string[];
    industryTags?: string[];
    useCases?: string[];
    audienceTags?: string[];
    toneTags?: string[];
    coverLayoutId?: string;
    agendaLayoutId?: string;
    closingLayoutId?: string;
}

/**
 * Extracts default values from a Zod schema by parsing an empty object
 * This leverages Zod's built-in default handling
 */
export function getSchemaDefaults<T extends z.ZodTypeAny>(schema: T): z.infer<T> {
    try {
        // Try to parse an empty object - Zod will fill in defaults
        return schema.parse({});
    } catch {
        // If parsing fails, try with undefined
        try {
            return schema.parse(undefined);
        } catch {
            // Return empty object as fallback
            return {} as z.infer<T>;
        }
    }
}

export function getSchemaJSON(schema: z.ZodTypeAny) {
    try {
        return z.toJSONSchema(schema)
    } catch (error) {
        console.error('Error converting schema to JSON:', error)
        throw error
    }
}

export function createTemplateEntry(
    component: React.ComponentType<{ data: any }>,
    schema: any,
    layoutId: string,
    layoutName: string,
    layoutDescription: string,
    templateName: string,
    fileName: string,
    metadata: (TemplateLayoutMetadata & { sampleData?: Record<string, unknown> }) = {},
): TemplateWithData {
    const id = `${templateName}:${layoutId}`;
    return {
        component,
        schema,
        layoutId: id,
        layoutName,
        layoutDescription,
        templateName,
        fileName,
        sampleData: metadata.sampleData ?? getSchemaDefaults(schema),
        schemaJSON: getSchemaJSON(schema),
        layoutTags: metadata.layoutTags,
        layoutRole: metadata.layoutRole,
        contentElements: metadata.contentElements,
        useCases: metadata.useCases,
        suitableFor: metadata.suitableFor,
        avoidFor: metadata.avoidFor,
        density: metadata.density,
        visualWeight: metadata.visualWeight,
        editableTextPriority: metadata.editableTextPriority,
    };
}

/**
 * Template metadata interface
 */
export interface TemplateMetadata {
    layoutId: string;
    layoutName: string;
    layoutDescription: string;
    templateName: string;
    fileName: string;
}

/**
 * Template with component and sample data
 */
export interface TemplateWithData extends TemplateMetadata, TemplateLayoutMetadata {
    component: React.ComponentType<{ data: any }>;
    sampleData: Record<string, unknown>;
    schema: z.ZodTypeAny;
    schemaJSON: any;
}

/**
 * Template group settings
 */
export interface TemplateGroupSettings extends TemplateGroupMetadata {
    description: string;
    ordered: boolean;
    default: boolean;
}

// Template with settings
export interface TemplateLayoutsWithSettings {
    id: string;
    name: string;
    description: string;
    settings: TemplateGroupSettings;
    layouts: TemplateWithData[];
}
