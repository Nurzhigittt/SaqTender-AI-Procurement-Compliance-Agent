import { createReviewPacket, type ReviewPacket, type ReviewPacketInput } from "./assessment-review";

// Includes valid maximal v1 packets with multibyte text or JSON-escaped controls.
export const REVIEW_FILE_MAX_BYTES = 8 * 1024 * 1024;

export type ReviewImportErrorCode = "invalid_file" | "unsupported_version" | "too_large";

export class ReviewImportError extends Error {
  constructor(public readonly code: ReviewImportErrorCode) {
    super(code);
    this.name = "ReviewImportError";
  }
}

const PACKET_KEYS = new Set(["schemaVersion", "assessment", "companyProfile", "mode", "analyzedAt", "locale", "review", "reviewedAt"]);

/** Reads a local snapshot only. Validation establishes its format, not its authenticity. */
export function parseReviewFile(text: string): ReviewPacket {
  if (typeof text !== "string") throw new ReviewImportError("invalid_file");
  // UTF-8 never uses fewer bytes than UTF-16 code units. Avoid a large allocation
  // for oversized input, then measure multibyte text before parsing anything.
  if (text.length > REVIEW_FILE_MAX_BYTES || new TextEncoder().encode(text).byteLength > REVIEW_FILE_MAX_BYTES) {
    throw new ReviewImportError("too_large");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    throw new ReviewImportError("invalid_file");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new ReviewImportError("invalid_file");
  const candidate = parsed as Record<string, unknown>;
  if (Object.keys(candidate).some(key => !PACKET_KEYS.has(key)) || typeof candidate.schemaVersion !== "string") {
    throw new ReviewImportError("invalid_file");
  }
  if (candidate.schemaVersion !== "saqtender-review-v1") throw new ReviewImportError("unsupported_version");

  const { schemaVersion: _schemaVersion, ...input } = candidate;
  try {
    // The export validator also checks row correspondence, required error notes,
    // all nested report/profile data and bounds, then returns a frozen clone.
    return createReviewPacket(input as ReviewPacketInput);
  } catch {
    throw new ReviewImportError("invalid_file");
  }
}
