import { z } from "zod";

export const SourceReferenceSchema = z.object({
  startFragment: z.number().int().min(1).max(20000),
  endFragment: z.number().int().min(1).max(20000),
}).strict();
export type SourceReference = z.infer<typeof SourceReferenceSchema>;
export interface TenderFragment {
  readonly id: number;
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

const MAX_FRAGMENT_LENGTH = 600;
const COMPLETE_TIMESTAMP = /\b\d{4}-\d{2}-\d{2}[T\s]+\d{2}:\d{2}(?::\d{2})?\s*(?:Asia\/Almaty|Z|(?:UTC\s*)?[+-]\d{2}:\d{2})(?![\w/])/g;

/** Number source spans afresh for this request; text resembling IDs is only data. */
export function createTenderFragments(source: string): TenderFragment[] {
  if (source.length > 20000) throw new Error("Tender source exceeds fragment limit");
  const timestampSpans = [...source.matchAll(COMPLETE_TIMESTAMP)]
    .map(match => ({ start: match.index, end: match.index + match[0].length }))
    .filter(span => span.end - span.start <= MAX_FRAGMENT_LENGTH);
  const boundaries = new Set<number>([0, source.length]);
  for (const match of source.matchAll(/\r\n|[\r\n]|;|[.!?](?=\s|$)/g)) boundaries.add(match.index + match[0].length);
  // Two deadlines on one line must be independently addressable, even without
  // punctuation. Keep any immediate sentence punctuation with the first span.
  for (const span of timestampSpans) {
    // A relative duration and an explicit deadline may share one sentence.
    // Keep the duration addressable without forcing an instant into its quote.
    boundaries.add(span.start);
    let end = span.end;
    if (/[.;!?]/.test(source[end] ?? "")) end += 1;
    boundaries.add(end);
  }
  // PDF wrapping inside a timestamp must not create an overlapping chunk when
  // a later length boundary is adjusted to keep that timestamp together.
  const cuts = [...boundaries]
    .filter(cut => !timestampSpans.some(span => span.start < cut && cut < span.end))
    .sort((a, b) => a - b);
  const spans: Array<{ start: number; end: number }> = [];
  for (let index = 1; index < cuts.length; index += 1) {
    let start = cuts[index - 1];
    const end = cuts[index];
    while (start < end) {
      while (start < end && /\s/.test(source[start])) start += 1;
      if (start === end) break;
      let stop = Math.min(start + MAX_FRAGMENT_LENGTH, end);
      if (stop < end) {
        const whitespace = source.slice(start, stop).search(/\s+\S*$/);
        if (whitespace >= MAX_FRAGMENT_LENGTH / 2) stop = start + whitespace;
        const timestamp = timestampSpans.find(span => span.start < stop && span.end > stop);
        if (timestamp) stop = timestamp.start > start ? timestamp.start : timestamp.end;
        // JS offsets are UTF-16. Do not split an astral character at a chunk edge.
        if (stop < end && /[\uDC00-\uDFFF]/.test(source[stop]) && /[\uD800-\uDBFF]/.test(source[stop - 1])) stop -= 1;
      }
      let contentEnd = stop;
      while (contentEnd > start && /\s/.test(source[contentEnd - 1])) contentEnd -= 1;
      if (contentEnd > start) spans.push({ start, end: contentEnd });
      start = stop;
    }
  }

  // Bound overhead for pathological text containing thousands of tiny lines.
  // Adjacent short spans may share an ID; no original characters are rewritten.
  const compact: typeof spans = [];
  for (const span of spans) {
    const previous = compact.at(-1);
    const crossesTimestamp = previous && timestampSpans.some(timestamp => previous.start <= timestamp.start && timestamp.end <= span.end);
    if (spans.length > 1000 && previous && previous.end - previous.start < 20 && span.end - previous.start <= MAX_FRAGMENT_LENGTH && !crossesTimestamp) previous.end = span.end;
    else compact.push({ ...span });
  }
  return compact.map(({ start, end }, index) => Object.freeze({ id: index + 1, start, end, text: source.slice(start, end) }));
}

/** Restore a contiguous original span, never concatenate or normalize quotations. */
export function resolveSourceReference(value: unknown, fragments: readonly TenderFragment[], source: string): string {
  const reference = SourceReferenceSchema.parse(value);
  const first = fragments[reference.startFragment - 1];
  const last = fragments[reference.endFragment - 1];
  if (!first || !last || first.id !== reference.startFragment || last.id !== reference.endFragment || reference.endFragment < reference.startFragment) {
    throw new Error("Invalid tender source reference");
  }
  if (first.start < 0 || last.end > source.length || last.end <= first.start || last.end - first.start > 2000) {
    throw new Error("Invalid tender source reference");
  }
  const quote = source.slice(first.start, last.end);
  if (!quote.trim() || source.slice(first.start, first.end) !== first.text || source.slice(last.start, last.end) !== last.text) {
    throw new Error("Invalid tender source reference");
  }
  return quote;
}
