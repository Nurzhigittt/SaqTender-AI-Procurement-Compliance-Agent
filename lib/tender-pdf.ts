import { getDocument, PDFWorker } from "pdfjs-dist";
import { extractPdfText } from "./pdf-text";
import { TenderImportError } from "./tender-import";

export async function extractPdf(bytes: Uint8Array, signal: AbortSignal, onProgress: (page: number, total: number) => void) {
  signal.throwIfAborted();
  // Each import owns its worker. No document bytes, embedded links or scripts are fetched/executed.
  const port = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
  const worker = PDFWorker.create({ port });
  const task = getDocument({ data: bytes, worker, stopAtErrors: true, disableFontFace: true, useSystemFonts: true, useWasm: false, verbosity: 0 });
  let abort!: () => void;
  const aborted = new Promise<never>((_, reject) => { abort = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError")); });
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  try {
    return await Promise.race([task.promise.then(pdf => extractPdfText(pdf, signal, onProgress)), aborted]);
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (error instanceof TenderImportError) throw error;
    if (error instanceof Error && error.name === "PasswordException") throw new TenderImportError("password");
    throw new TenderImportError("invalid-pdf");
  } finally {
    signal.removeEventListener("abort", abort);
    void task.destroy().catch(() => {});
    worker.destroy();
    port.terminate();
  }
}
