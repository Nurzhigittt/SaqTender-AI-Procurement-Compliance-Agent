import { createReviewPacket, type ReviewEntry, type ReviewPacket, type ReviewPacketInput } from "./assessment-review";

export type ReviewComparisonErrorCode = "mismatched_report" | "invalid_review";

export class ReviewComparisonError extends Error {
  constructor(public readonly code: ReviewComparisonErrorCode) {
    super(code);
    this.name = "ReviewComparisonError";
  }
}

export type ReviewComparisonRow = {
  kind: "requirement" | "deadline";
  index: number;
  comparison: "same" | "different" | "incomplete";
  needsDiscussion: boolean;
  left: ReviewEntry;
  right: ReviewEntry;
};

export type ReviewComparison = {
  identicalFeedback: boolean;
  rows: ReviewComparisonRow[];
  summary: {
    total: number;
    same: number;
    different: number;
    incomplete: number;
    needsDiscussion: number;
  };
  notes: { omissionsDiffer: boolean; notesDiffer: boolean };
};

function validatePacket(packet: ReviewPacket): ReviewPacket {
  try {
    if (!packet || typeof packet !== "object" || Array.isArray(packet)
      || packet.schemaVersion !== "saqtender-review-v1") {
      throw new Error("Invalid review packet");
    }
    // Keep every other key so the strict packet validator rejects unexpected data.
    const { schemaVersion: _schemaVersion, ...input } = packet;
    return createReviewPacket(input as ReviewPacketInput);
  } catch {
    throw new ReviewComparisonError("invalid_review");
  }
}

function originalReport(packet: ReviewPacket): string {
  // createReviewPacket parses each nested object in schema order; serialized
  // equality therefore ignores input JSON key order, but not report content.
  return JSON.stringify({
    assessment: packet.assessment,
    companyProfile: packet.companyProfile,
    analyzedAt: packet.analyzedAt,
    locale: packet.locale,
    mode: packet.mode,
  });
}

/**
 * Compares two feedback snapshots of the exact same original report.
 * This describes team markings, not correctness, reviewer identity or expertise.
 * Notes use exact string equality (including whitespace); no feedback is trimmed
 * or rewritten. Unreviewed rows never count as agreement.
 */
export function compareReviews(leftInput: ReviewPacket, rightInput: ReviewPacket): ReviewComparison {
  const left = validatePacket(leftInput);
  const right = validatePacket(rightInput);
  if (originalReport(left) !== originalReport(right)) {
    throw new ReviewComparisonError("mismatched_report");
  }
  const identicalFeedback = JSON.stringify(left.review) === JSON.stringify(right.review);

  const rows: ReviewComparisonRow[] = [];
  const summary: ReviewComparison["summary"] = { total: 0, same: 0, different: 0, incomplete: 0, needsDiscussion: 0 };
  for (const [kind, field] of [["requirement", "requirements"], ["deadline", "deadlines"]] as const) {
    left.review[field].forEach((leftEntry, index) => {
      const rightEntry = right.review[field][index];
      const comparison = leftEntry.verdict === "unreviewed" || rightEntry.verdict === "unreviewed"
        ? "incomplete"
        : leftEntry.verdict === rightEntry.verdict ? "same" : "different";
      const needsDiscussion = comparison === "different"
        || leftEntry.verdict === "incorrect" || rightEntry.verdict === "incorrect"
        || leftEntry.verdict === "unsure" || rightEntry.verdict === "unsure"
        || leftEntry.note !== rightEntry.note;
      rows.push(Object.freeze({ kind, index, comparison, needsDiscussion, left: leftEntry, right: rightEntry }));
      summary.total += 1;
      summary[comparison] += 1;
      if (needsDiscussion) summary.needsDiscussion += 1;
    });
  }
  Object.freeze(rows);
  Object.freeze(summary);
  return Object.freeze({
    identicalFeedback,
    rows,
    summary,
    notes: Object.freeze({
      omissionsDiffer: left.review.omissions !== right.review.omissions,
      notesDiffer: left.review.notes !== right.review.notes,
    }),
  });
}
