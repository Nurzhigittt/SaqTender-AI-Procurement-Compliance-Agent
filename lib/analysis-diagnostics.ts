export type AnalysisStage = "profile_pending" | "profile_read" | "dates_checked" | "alerts_created" | "final_received";

/** Keep the original error available for classification, never for serialization. */
export class AnalysisRunError extends Error {
  constructor(public readonly stage: AnalysisStage, cause: unknown) {
    super("Analysis run failed", { cause });
    this.name = "AnalysisRunError";
  }
}
