import type { PDFDocumentProxy, TextContent } from "pdfjs-dist/types/src/display/api";
import { IMPORT_MAX_CHARS, IMPORT_MAX_PAGES, TenderImportError, validateImportedText, type ImportedTender } from "./tender-import";

// Kept separate from the browser worker so limits can also be exercised with real PDFs in Node.
export async function extractPdfText(pdf: Pick<PDFDocumentProxy, "numPages" | "getPage">, signal: AbortSignal, onProgress: (page: number, total: number) => void): Promise<ImportedTender> {
  if (pdf.numPages > IMPORT_MAX_PAGES) throw new TenderImportError("pages");
  const pages: string[] = [];
  const emptyPages: number[] = [];
  let characters = 0;
  for (let number = 1; number <= pdf.numPages; number++) {
    signal.throwIfAborted();
    const page = await pdf.getPage(number);
    const reader = page.streamTextContent({ disableNormalization: true }).getReader();
    let text = "";
    let complete = false;
    try {
      while (true) {
        signal.throwIfAborted();
        const { done, value } = await reader.read();
        signal.throwIfAborted();
        if (done) { complete = true; break; }
        for (const item of (value as TextContent).items) {
          if (!("str" in item)) continue;
          // PDF.js supplies spaces and line endings; preserve its wording, including ligatures.
          const part = item.str + (item.hasEOL ? "\n" : "");
          characters += part.length;
          if (characters > IMPORT_MAX_CHARS) throw new TenderImportError("length");
          text += part;
        }
      }
    } finally {
      reader.releaseLock();
      // The caller destroys the entire loading task on an early exit. Cancelling
      // PDF.js's stream while its final chunk arrives races the stream close.
      if (complete) page.cleanup();
    }
    if (!text.trim()) emptyPages.push(number);
    pages.push(text.trim());
    if (number < pdf.numPages) characters += 2;
    onProgress(number, pdf.numPages);
  }
  if (emptyPages.length === pdf.numPages) throw new TenderImportError("no-text");
  return { text: validateImportedText(pages.join("\n\n")), format: "pdf", pageCount: pdf.numPages, emptyPages };
}
