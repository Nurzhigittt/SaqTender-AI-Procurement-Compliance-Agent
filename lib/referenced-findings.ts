import { z } from "zod";
import { LiveFindingsSchema, type LiveFindings } from "./live-findings";
import { resolveSourceReference, SourceReferenceSchema, type TenderFragment } from "./tender-fragments";
import { DeadlineSchema, type Deadline } from "./types";

export const ReferencedDeadlineCandidateSchema = DeadlineSchema.pick({ title: true }).extend({
  sourceReference: SourceReferenceSchema,
}).strict();
export const ReferencedDeadlineSchema = ReferencedDeadlineCandidateSchema.extend({ date: DeadlineSchema.shape.date }).strict();

/** Model-facing contract contains references, never model-authored source quotes. */
export const ReferencedFindingsSchema = LiveFindingsSchema.extend({
  requirements: z.array(LiveFindingsSchema.shape.requirements.element.omit({ tenderEvidence: true, conflictingEvidence: true, contextEvidence: true }).extend({
    sourceReference: SourceReferenceSchema,
    conflictingSourceReference: SourceReferenceSchema.nullable(),
    contextSourceReference: SourceReferenceSchema.nullable().describe("Full governing heading, exemption or applicability clause. Required for contract_obligation, evaluation_criterion and exemption; may refer to the main clause itself. May be distant from sourceReference. Never omit exceptions or no-rejection wording."),
  }).strict()).max(60).describe(LiveFindingsSchema.shape.requirements.description!),
  deadlines: z.array(ReferencedDeadlineSchema).max(30),
  unresolvedDeadlines: z.array(LiveFindingsSchema.shape.unresolvedDeadlines.element.omit({ tenderEvidence: true }).extend({
    sourceReference: SourceReferenceSchema,
  }).strict()).max(30),
}).strict();

export function resolveReferencedDeadlineCandidates(value: unknown, fragments: readonly TenderFragment[], source: string): Pick<Deadline, "title" | "tenderEvidence">[] {
  return z.array(ReferencedDeadlineCandidateSchema).max(30).parse(value).map(({ sourceReference, ...candidate }) => ({
    ...candidate, tenderEvidence: resolveSourceReference(sourceReference, fragments, source),
  }));
}

export function resolveReferencedDeadlines(value: unknown, fragments: readonly TenderFragment[], source: string): Deadline[] {
  return z.array(ReferencedDeadlineSchema).max(30).parse(value).map(({ sourceReference, ...deadline }) => ({
    ...deadline, tenderEvidence: resolveSourceReference(sourceReference, fragments, source),
  }));
}

export function resolveReferencedFindings(value: unknown, fragments: readonly TenderFragment[], source: string): LiveFindings {
  const findings = ReferencedFindingsSchema.parse(value);
  return LiveFindingsSchema.parse({
    requirements: findings.requirements.map(({ sourceReference, conflictingSourceReference, contextSourceReference, ...requirement }) => ({
      ...requirement,
      tenderEvidence: resolveSourceReference(sourceReference, fragments, source),
      conflictingEvidence: conflictingSourceReference === null ? null : resolveSourceReference(conflictingSourceReference, fragments, source),
      contextEvidence: contextSourceReference === null ? null : resolveSourceReference(contextSourceReference, fragments, source),
    })),
    deadlines: resolveReferencedDeadlines(findings.deadlines, fragments, source),
    unresolvedDeadlines: findings.unresolvedDeadlines.map(({ sourceReference, ...deadline }) => ({
      ...deadline, tenderEvidence: resolveSourceReference(sourceReference, fragments, source),
    })),
  });
}
