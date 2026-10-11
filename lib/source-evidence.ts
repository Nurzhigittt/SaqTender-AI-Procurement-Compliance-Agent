/** Restore only whitespace formatting from a uniquely matching source passage. */
export function resolveFindingQuote(quote: string, source: string): string {
  const reject = () => { throw new Error("Ungrounded finding evidence"); };
  if (!quote.trim() || quote.length > 2000) return reject();
  if (source.includes(quote)) return quote;

  // PDF text commonly contains line wraps and non-breaking spaces. Retain an
  // original index for each normalized character; never normalize words,
  // punctuation, case, dates, Unicode lookalikes, or the presence of whitespace.
  const normalized: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  for (let index = 0; index < source.length;) {
    const start = index;
    if (/\s/.test(source[index])) {
      while (index < source.length && /\s/.test(source[index])) index += 1;
      normalized.push(" ");
    } else {
      normalized.push(source[index]);
      index += 1;
    }
    starts.push(start);
    ends.push(index);
  }

  const needle = quote.trim().replace(/\s+/g, " ");
  const haystack = normalized.join("");
  const match = haystack.indexOf(needle);
  if (match < 0 || haystack.indexOf(needle, match + 1) !== -1) return reject();
  const original = source.slice(starts[match], ends[match + needle.length - 1]);
  if (original.length > 2000) return reject();
  return original;
}
