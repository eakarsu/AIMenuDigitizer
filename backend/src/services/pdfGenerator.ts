import PDFDocument from 'pdfkit';

export function createPDFTable(doc: PDFKit.PDFDocument, title: string, headers: string[], rows: string[][]) {
  doc.fontSize(18).text(title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(8).text(`Generated: ${new Date().toLocaleString()}`, { align: 'right' });
  doc.moveDown();

  const startX = 50;
  const colWidth = (doc.page.width - 100) / headers.length;
  let y = doc.y;

  // Header
  doc.fontSize(9).font('Helvetica-Bold');
  headers.forEach((header, i) => {
    doc.text(header, startX + i * colWidth, y, { width: colWidth - 5, align: 'left' });
  });
  y = doc.y + 5;
  doc.moveTo(startX, y).lineTo(doc.page.width - 50, y).stroke();
  y += 10;

  // Rows
  doc.font('Helvetica').fontSize(8);
  for (const row of rows) {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 50;
    }
    const rowY = y;
    row.forEach((cell, i) => {
      doc.text(cell || '', startX + i * colWidth, rowY, { width: colWidth - 5, align: 'left' });
    });
    y = Math.max(doc.y + 5, rowY + 15);
  }

  return doc;
}
