import { z } from "zod";
import type { Locale } from "./i18n";
import { AssessmentSchema, CompanyProfileSchema, type AnalysisMode, type Assessment, type CompanyProfile } from "./types";

export type ReviewEntry = {
  verdict: "unreviewed" | "correct" | "incorrect" | "unsure";
  note: string;
};

export type AssessmentReview = {
  requirements: ReviewEntry[];
  deadlines: ReviewEntry[];
  omissions: string;
  notes: string;
};

export type ReviewPacketInput = {
  assessment: Assessment;
  companyProfile: CompanyProfile;
  mode: AnalysisMode;
  analyzedAt: string;
  locale: Locale;
  review: AssessmentReview;
  reviewedAt: string;
};

export type ReviewPacket = ReviewPacketInput & { schemaVersion: "saqtender-review-v1" };

export type ReviewSummary = {
  total: number;
  marked: number;
  unreviewed: number;
  correct: number;
  incorrect: number;
  unsure: number;
};

const ReviewEntrySchema = z.object({
  verdict: z.enum(["unreviewed", "correct", "incorrect", "unsure"]),
  note: z.string().max(2000),
}).strict();

const AssessmentReviewSchema = z.object({
  requirements: z.array(ReviewEntrySchema).max(60),
  deadlines: z.array(ReviewEntrySchema).max(30),
  omissions: z.string().max(4000),
  notes: z.string().max(4000),
}).strict();

const TimestampSchema = z.string().datetime({ offset: true }).refine(value => Number.isFinite(Date.parse(value)), "Invalid review timestamp");

const ReviewPacketInputSchema = z.object({
  assessment: AssessmentSchema,
  companyProfile: CompanyProfileSchema,
  mode: z.enum(["demo", "live"]),
  analyzedAt: TimestampSchema,
  locale: z.enum(["ru", "en"]),
  review: AssessmentReviewSchema,
  reviewedAt: TimestampSchema,
}).strict();

export function createEmptyReview(assessment: Assessment): AssessmentReview {
  const original = AssessmentSchema.parse(assessment);
  const empty = (): ReviewEntry => ({ verdict: "unreviewed", note: "" });
  return {
    requirements: original.requirements.map(empty),
    deadlines: original.deadlines.map(empty),
    omissions: "",
    notes: "",
  };
}

/** Counts human markings only; these counts are not an accuracy measurement. */
export function summarizeReview(review: AssessmentReview): ReviewSummary {
  const parsed = AssessmentReviewSchema.parse(review);
  const summary: ReviewSummary = { total: 0, marked: 0, unreviewed: 0, correct: 0, incorrect: 0, unsure: 0 };
  for (const entry of [...parsed.requirements, ...parsed.deadlines]) {
    summary.total += 1;
    summary[entry.verdict] += 1;
    if (entry.verdict !== "unreviewed") summary.marked += 1;
  }
  return summary;
}

/** In-progress reviews may contain unmarked rows; an incorrect verdict needs an explanation. */
export function validateReview(assessment: Assessment, review: AssessmentReview): void {
  const original = AssessmentSchema.parse(assessment);
  const parsed = AssessmentReviewSchema.parse(review);
  if (parsed.requirements.length !== original.requirements.length || parsed.deadlines.length !== original.deadlines.length) {
    throw new Error("Review row count does not match the original assessment");
  }
  for (const entry of [...parsed.requirements, ...parsed.deadlines]) {
    if (entry.verdict === "incorrect" && !entry.note.trim()) {
      throw new Error("An incorrect verdict requires a nonblank note");
    }
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Offline snapshot: preserves the original report and keeps human feedback separate. */
export function createReviewPacket(input: ReviewPacketInput): ReviewPacket {
  // Zod returns detached objects, so freezing the snapshot never freezes application state.
  const parsed = ReviewPacketInputSchema.parse(input);
  validateReview(parsed.assessment, parsed.review);
  const entries = [...parsed.review.requirements, ...parsed.review.deadlines];
  const hasFeedback = entries.some(entry => entry.verdict !== "unreviewed" || entry.note.trim())
    || parsed.review.omissions.trim() || parsed.review.notes.trim();
  if (!hasFeedback) throw new Error("Add a review mark or note before exporting");
  return deepFreeze({ schemaVersion: "saqtender-review-v1", ...parsed });
}

export function createReviewJson(input: ReviewPacketInput): string {
  return `${JSON.stringify(createReviewPacket(input), null, 2)}\n`;
}

export function reviewFilename({ reviewedAt, locale }: Pick<ReviewPacketInput, "reviewedAt" | "locale">, extension: "json" | "html"): string {
  if (extension !== "json" && extension !== "html") throw new Error("Unsupported review export format");
  const date = new Date(reviewedAt);
  let stamp = "undated";
  if (Number.isFinite(date.getTime())) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
    stamp = `${part("year")}-${part("month")}-${part("day")}`;
  }
  return `saqtender-review-${locale === "ru" ? "ru" : "en"}-${stamp}.${extension}`;
}
