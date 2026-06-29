import type { ResearchEvidenceIndex, ResearchPlan } from "../../api/types";
import type { DeckGenerationContext } from "./types";
import { normalizeResearchEvidenceIndex } from "./researchWorkflow";

export async function readResearchPlanSafe(
  input: Pick<DeckGenerationContext, "backend" | "workspace">,
): Promise<ResearchPlan | null> {
  try {
    return await input.backend.getResearchPlan({
      workspace_dir: input.workspace.workspace_dir,
    });
  } catch {
    return null;
  }
}

export async function readResearchEvidenceSafe(
  input: Pick<DeckGenerationContext, "backend" | "workspace">,
): Promise<ResearchEvidenceIndex | null> {
  try {
    return normalizeResearchEvidenceIndex(
      await input.backend.getResearchEvidence({
        workspace_dir: input.workspace.workspace_dir,
      }),
    );
  } catch {
    return null;
  }
}
