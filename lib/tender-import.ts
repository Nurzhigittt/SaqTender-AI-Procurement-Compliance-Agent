export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_PAGES = 30;
export const IMPORT_MAX_CHARS = 20000;
export const IMPORT_TIMEOUT_MS = 30000;

export type ImportErrorCode = "unsupported" | "size" | "empty" | "encoding" | "binary" | "invalid-pdf" | "password" | "pages" | "length" | "no-text" | "timeout" | "failed";
export class TenderImportError extends Error {
  constructor(public readonly code: ImportErrorCode) { super(code); this.name = "TenderImportError"; }
}
export type ImportedTender = { text: string; format: "pdf" | "txt"; pageCount: number | null; emptyPages: number[] };

export function validateImportFile(file: Pick<File, "name" | "size">): "pdf" | "txt" {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "pdf" && extension !== "txt") throw new TenderImportError("unsupported");
  if (file.size === 0) throw new TenderImportError("empty");
  if (file.size > IMPORT_MAX_BYTES) throw new TenderImportError("size");
  return extension;
}

export function validateImportedText(text: string): string {
  // Never truncate a requirement or date to make a document fit.
  if (text.length > IMPORT_MAX_CHARS) throw new TenderImportError("length");
  if (!text.trim()) throw new TenderImportError("empty");
  if (/[\x00-\x08\x0b\x0e-\x1f\x7f]/.test(text)) throw new TenderImportError("binary");
  return text.trim();
}

export function decodeTenderText(bytes: Uint8Array): ImportedTender {
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new TenderImportError("encoding"); }
  if (text.startsWith("%PDF-")) throw new TenderImportError("unsupported");
  return { text: validateImportedText(text), format: "txt", pageCount: null, emptyPages: [] };
}

export function assertPdfHeader(bytes: Uint8Array) {
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") throw new TenderImportError("invalid-pdf");
}

export async function importTenderFile(file: File, signal: AbortSignal, onProgress: (page: number, total: number) => void): Promise<ImportedTender> {
  const format = validateImportFile(file);
  signal.throwIfAborted();
  const bytes = new Uint8Array(await file.arrayBuffer());
  signal.throwIfAborted();
  if (format === "txt") return decodeTenderText(bytes);
  assertPdfHeader(bytes);
  const { extractPdf } = await import("./tender-pdf");
  signal.throwIfAborted();
  return extractPdf(bytes, signal, onProgress);
}
