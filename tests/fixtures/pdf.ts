// Small, fictional PDFs generated without a second PDF dependency.
// ASCII only; UTF-8/Cyrillic coverage is provided by the text-file tests.
export function makePdf(pages: string[][]): Uint8Array {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  pages.forEach((lines, index) => {
    const stream = lines.length ? `BT /F1 12 Tf 50 780 Td 18 TL ${lines.map(line => `(${line.replace(/[\\()]/g, "\\$&")}) Tj T*`).join(" ")} ET` : "";
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let pdf = "%PDF-1.7\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

export const PDF_SAMPLE_PAGES = [
  ["FICTIONAL TENDER - TEST DATA", "Project: construction of a demonstration school.", "A construction license and proof of work experience are required."],
  ["Submission deadline: 2026-11-20 18:00 UTC+5.", "Clarification deadline: 2026-11-15 12:00 UTC+5.", "A financial report for 2025 must be attached."],
];
