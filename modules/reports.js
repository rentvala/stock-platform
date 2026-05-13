'use strict';
/**
 * CSV + PDF report generators — Node.js edition
 * Replaces Python reportlab with pdfkit (npm)
 * Mirrors python modules/reports.py
 */
const { stringify } = require('csv-stringify/sync');
const PDFDocument = require('pdfkit');

function toCsv(rows, headers = null) {
  if (!rows || rows.length === 0) {
    return headers ? headers.join(',') + '\n' : '';
  }
  const keys = headers || Object.keys(rows[0]);
  return stringify(rows.map(r => keys.map(k => r[k] ?? '')), { header: true, columns: keys });
}

function buildPdf(title, sections) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
    const buffers = [];
    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Title
    doc.fontSize(20).fillColor('#0b5fff').text(title, { align: 'center' });
    doc.fontSize(9).fillColor('#555').text(`Generated: ${new Date().toUTCString()}`, { align: 'center' });
    doc.moveDown();

    for (const [heading, rows, headers] of sections) {
      doc.fontSize(14).fillColor('#222').text(heading);
      doc.moveDown(0.3);
      if (!rows || rows.length === 0) {
        doc.fontSize(9).fillColor('#888').text('No data.');
        doc.moveDown();
        continue;
      }
      const cols = headers || Object.keys(rows[0]);
      const colW = Math.min(80, (doc.page.width - 56) / cols.length);

      // Header row
      let x = doc.page.margins.left;
      const headerY = doc.y;
      doc.rect(x, headerY, colW * cols.length, 16).fill('#0b5fff');
      doc.fontSize(7).fillColor('white');
      cols.forEach((col, i) => {
        doc.text(String(col).substring(0, 14), x + i * colW + 2, headerY + 4, { width: colW - 4, lineBreak: false });
      });
      doc.y = headerY + 18;

      // Data rows
      rows.slice(0, 50).forEach((row, ri) => {
        if (doc.y > doc.page.height - 60) { doc.addPage({ layout: 'landscape' }); }
        const rowY = doc.y;
        const bg = ri % 2 === 0 ? '#ffffff' : '#eef4ff';
        doc.rect(x, rowY, colW * cols.length, 14).fill(bg);
        doc.fontSize(6).fillColor('#222');
        cols.forEach((col, i) => {
          const val = String(row[col] ?? '').substring(0, 18);
          doc.text(val, x + i * colW + 2, rowY + 3, { width: colW - 4, lineBreak: false });
        });
        doc.y = rowY + 15;
      });
      doc.moveDown();
    }

    doc.end();
  });
}

module.exports = { toCsv, buildPdf };
