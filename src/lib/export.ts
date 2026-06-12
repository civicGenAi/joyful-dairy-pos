import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Real file exports: CSV (plain), Excel (HTML-table .xls, opens natively in
// Excel/LibreOffice) and PDF (jsPDF + autotable with the brand header).

export interface ExportData {
  /** Document title printed inside the PDF. */
  title: string;
  /** Optional subtitle (date range, filters...). */
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
}

const BRAND_GREEN: [number, number, number] = [30, 124, 63];

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCSV(data: ExportData, filename: string) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [data.headers.map(esc).join(","), ...data.rows.map((r) => r.map(esc).join(","))];
  // BOM so Excel opens UTF-8 (Swahili characters) correctly.
  download(
    new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }),
    `${filename}.csv`,
  );
}

export function exportExcel(data: ExportData, filename: string) {
  const esc = (v: string | number) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8" /></head><body>
    <table border="1"><thead><tr style="background:#1E7C3F;color:#fff;font-weight:bold">
    ${data.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>
    ${data.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}
    </tbody></table></body></html>`;
  download(new Blob([html], { type: "application/vnd.ms-excel" }), `${filename}.xls`);
}

export function exportPDF(data: ExportData, filename: string) {
  const doc = new jsPDF({ orientation: data.headers.length > 7 ? "landscape" : "portrait" });
  doc.setFontSize(16);
  doc.setTextColor(...BRAND_GREEN);
  doc.text("African Joy Dairy", 14, 16);
  doc.setFontSize(12);
  doc.setTextColor(40);
  doc.text(data.title, 14, 24);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(data.subtitle ?? new Date().toLocaleString(), 14, 30);
  autoTable(doc, {
    startY: 35,
    head: [data.headers],
    body: data.rows.map((r) => r.map((c) => String(c ?? ""))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: BRAND_GREEN, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 248, 242] },
  });
  doc.save(`${filename}.pdf`);
}

/**
 * Renders a DOM element (a print page card) into a real multi-page A4 PDF.
 * Used by the print routes' "Download PDF" button.
 */
export async function exportElementPDF(element: HTMLElement, filename: string) {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });
  const img = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let remaining = imgHeight;
  let offset = 0;
  while (remaining > 0) {
    pdf.addImage(img, "PNG", margin, margin - offset, imgWidth, imgHeight);
    remaining -= pageHeight - margin * 2;
    offset += pageHeight - margin * 2;
    if (remaining > 0) pdf.addPage();
  }
  pdf.save(`${filename}.pdf`);
}
