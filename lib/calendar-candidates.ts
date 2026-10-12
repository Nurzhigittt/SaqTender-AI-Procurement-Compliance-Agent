import { z } from "zod";
import { explicitDatesInEvidence, resolveGroundedDeadlines } from "./grounding";
import { ReferencedDeadlineCandidateSchema } from "./referenced-findings";
import { resolveSourceReference, type SourceReference, type TenderFragment } from "./tender-fragments";
import type { Deadline } from "./types";

export interface CalendarCandidates {
  deadlines: Array<Deadline & { sourceReference: SourceReference }>;
  unresolvedDeadlines: Array<{ tenderEvidence: string; reason: "ambiguous"; sourceReference: SourceReference }>;
}

/** Preserve incomplete source passages without inventing a calendar instant. */
export function resolveCalendarCandidates(value: unknown, fragments: readonly TenderFragment[], source: string): CalendarCandidates {
  // Resolve every reference before classifying dates. Invalid source references
  // must fail the call even when another candidate has ambiguous calendar data.
  const candidates = z.array(ReferencedDeadlineCandidateSchema).max(30).parse(value).map(candidate => ({
    ...candidate,
    tenderEvidence: resolveSourceReference(candidate.sourceReference, fragments, source),
  }));
  const exactCandidates: typeof candidates = [];
  const unresolvedDeadlines: CalendarCandidates["unresolvedDeadlines"] = [];
  for (const candidate of candidates) {
    const instants = new Set(explicitDatesInEvidence(candidate.tenderEvidence));
    if (instants.size === 0) {
      unresolvedDeadlines.push({
        tenderEvidence: candidate.tenderEvidence,
        reason: "ambiguous",
        sourceReference: candidate.sourceReference,
      });
    } else if (instants.size === 1) {
      exactCandidates.push(candidate);
    } else {
      throw new Error("Deadline evidence must contain exactly one explicit instant");
    }
  }
  // Existing grounding also rejects duplicates across the complete exact set.
  const deadlines = resolveGroundedDeadlines(exactCandidates, source).map((deadline, index) => ({
    ...deadline,
    sourceReference: exactCandidates[index].sourceReference,
  }));
  return { deadlines, unresolvedDeadlines };
}
