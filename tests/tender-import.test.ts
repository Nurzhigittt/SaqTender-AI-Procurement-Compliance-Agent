import assert from "node:assert/strict";
import test from "node:test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { assertPdfHeader, decodeTenderText, IMPORT_MAX_BYTES, IMPORT_MAX_CHARS, TenderImportError, validateImportFile, validateImportedText } from "../lib/tender-import";
import { extractPdfText } from "../lib/pdf-text";
import { makePdf, PDF_SAMPLE_PAGES } from "./fixtures/pdf";

const code = (expected: string) => (error: unknown) => error instanceof TenderImportError && error.code === expected;
const encode = (text: string) => new TextEncoder().encode(text);
async function extract(pages: string[][], signal = new AbortController().signal) {
  const task = getDocument({ data: makePdf(pages), stopAtErrors: true, useSystemFonts: true, verbosity: 0 });
  try { return await extractPdfText(await task.promise, signal, () => {}); }
  finally { await task.destroy(); }
}

test("file import rejects unsupported, empty and oversized files before reading", () => {
  assert.equal(validateImportFile({ name: "Tender.PDF", size: IMPORT_MAX_BYTES }), "pdf");
  assert.equal(validateImportFile({ name: "требования.txt", size: 30 }), "txt");
  assert.throws(() => validateImportFile({ name: "tender.pdf.exe", size: 30 }), code("unsupported"));
  assert.throws(() => validateImportFile({ name: "tender.txt", size: 0 }), code("empty"));
  assert.throws(() => validateImportFile({ name: "tender.pdf", size: IMPORT_MAX_BYTES + 1 }), code("size"));
  assert.throws(() => assertPdfHeader(encode("not a PDF")), code("invalid-pdf"));
});

test("UTF-8 text keeps Cyrillic, punctuation and source dates, with or without BOM", () => {
  const text = "Требуется лицензия.\r\nСрок: 2026-11-20 18:00 UTC+5.\nСумма — 1 000 ₸.";
  assert.equal(decodeTenderText(encode(text)).text, text);
  assert.equal(decodeTenderText(encode("\ufeff" + text)).text, text);
  assert.throws(() => decodeTenderText(new Uint8Array([0xff, 0xfe, 0x80])), code("encoding"));
  assert.throws(() => decodeTenderText(encode("binary\x00payload")), code("binary"));
  assert.throws(() => decodeTenderText(encode("%PDF-1.7 disguised")), code("unsupported"));
  assert.throws(() => decodeTenderText(encode("\n \t")), code("empty"));
});

test("text length limit never silently truncates a document", () => {
  assert.equal(validateImportedText("a".repeat(IMPORT_MAX_CHARS)).length, IMPORT_MAX_CHARS);
  assert.throws(() => decodeTenderText(encode("a".repeat(IMPORT_MAX_CHARS + 1))), code("length"));
});

test("real two-page PDF extraction preserves requirements, deadlines and page separation", async () => {
  const result = await extract(PDF_SAMPLE_PAGES);
  assert.equal(result.text, PDF_SAMPLE_PAGES.map(lines => lines.join("\n")).join("\n\n"));
  assert.equal(result.pageCount, 2);
  assert.deepEqual(result.emptyPages, []);
});

test("PDF pages without text are reported and fully blank documents cannot be analyzed", async () => {
  const result = await extract([PDF_SAMPLE_PAGES[0], [], PDF_SAMPLE_PAGES[1]]);
  assert.deepEqual(result.emptyPages, [2]);
  assert.match(result.text, /2026-11-20 18:00 UTC\+5/);
  await assert.rejects(extract([[], []]), code("no-text"));
});

test("PDF page and text limits reject entire imports, including overflowing later pages", async () => {
  await assert.rejects(extract(Array.from({ length: 31 }, () => [])), code("pages"));
  // Lines fit the page, so the text extractor cannot cull them outside the viewport.
  await assert.rejects(extract(Array.from({ length: 20 }, () => Array(35).fill("A requirement with a date 2026-11-20."))), code("length"));
});

test("cancelled PDF extraction cannot return a partial success", async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(extract(PDF_SAMPLE_PAGES, controller.signal), { name: "AbortError" });
  const task = getDocument({ data: makePdf(PDF_SAMPLE_PAGES), verbosity: 0 });
  const midway = new AbortController();
  try { await assert.rejects(extractPdfText(await task.promise, midway.signal, () => midway.abort()), { name: "AbortError" }); }
  finally { await task.destroy(); }
});
