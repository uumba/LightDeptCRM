import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { daysBetween, calculateRentalPrice, formatCurrency, groupItemsByCategory, cleanEquipmentName } from './calc';

const COMPANY = {
  name: 'LIGHT DEPT',
  tagline: 'Rental Department',
  email: 'info@lightdept.com',
  phone: '+1 (555) 000-0000',
};

function sanitizeFilename(name) {
  return (name || 'rental').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
}

export function generateRentalPDF(rental, client, equipment, categories = []) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ── Logo (drawn vector, text fallback) ──
  doc.setFillColor(245, 197, 24);
  doc.roundedRect(14, 14, 14, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('LD', 21, 23, { align: 'center' });

  // ── Brand & company info ──
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(15);
  doc.text(COMPANY.name, 32, 19);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(COMPANY.tagline, 32, 24);
  doc.text(`${COMPANY.email}  |  ${COMPANY.phone}`, 32, 28);

  // ── Title ──
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('RENTAL AGREEMENT', pageWidth - 14, 19, { align: 'right' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`#${(rental.id || '').slice(-8).toUpperCase()}`, pageWidth - 14, 24, { align: 'right' });

  // ── Separator ──
  doc.setDrawColor(225, 225, 225);
  doc.line(14, 33, pageWidth - 14, 33);

  // ── Client & period ──
  const days = daysBetween(rental.start_date, rental.end_date);
  let y = 40;

  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('CLIENT', 14, y);
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.text(client?.name || 'Unknown', 14, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(client?.contact || '', 14, y + 10);

  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('PERIOD', pageWidth / 2, y);
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text(new Date(rental.start_date).toLocaleString(), pageWidth / 2, y + 5);
  doc.text(`to ${new Date(rental.end_date).toLocaleString()}`, pageWidth / 2, y + 10);

  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('DURATION', pageWidth - 14, y, { align: 'right' });
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.text(`${days} day${days !== 1 ? 's' : ''}`, pageWidth - 14, y + 5, { align: 'right' });
  doc.setFont('helvetica', 'normal');

  y += 16;

  // ── Equipment table (grouped by category) ──
  const grouped = groupItemsByCategory(rental.items || [], equipment, categories);
  const tableBody = [];
  grouped.forEach((group) => {
    tableBody.push([{
      content: group.category.toUpperCase(),
      colSpan: 4,
      styles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [80, 80, 80], fontSize: 8 },
    }]);
    group.items.forEach((item) => {
      const eq = equipment.find((e) => e.id === item.equipment_id);
      const lineTotal = (item.price_per_day || 0) * (item.quantity || 0) * days;
      tableBody.push([
        cleanEquipmentName(eq?.name) || 'Unknown',
        String(item.quantity || 1),
        formatCurrency(item.price_per_day || 0),
        formatCurrency(lineTotal),
      ]);
    });
  });

  autoTable(doc, {
    startY: y,
    head: [['Equipment', 'Qty', 'Daily Price', 'Line Total']],
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: [245, 197, 24], textColor: [20, 20, 20], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 35 },
    },
    margin: { left: 14, right: 14 },
  });

  // ── Totals ──
  const { basePrice, discountAmount, finalPrice } = calculateRentalPrice(rental.items, days, rental.discount);
  let finalY = doc.lastAutoTable.finalY + 8;

  // Subtotal (faded)
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', pageWidth - 70, finalY);
  doc.text(formatCurrency(basePrice), pageWidth - 14, finalY, { align: 'right' });

  // Discount (black, bold)
  finalY += 6;
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.text(`Discount (${rental.discount || 0}%):`, pageWidth - 70, finalY);
  doc.text(`-${formatCurrency(discountAmount)}`, pageWidth - 14, finalY, { align: 'right' });

  // Final total (highlighted)
  finalY += 8;
  doc.setFillColor(245, 197, 24);
  doc.roundedRect(pageWidth - 74, finalY - 4, 60, 10, 1, 1, 'F');
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);
  doc.text('Final Total:', pageWidth - 70, finalY + 2);
  doc.text(formatCurrency(finalPrice), pageWidth - 14, finalY + 2, { align: 'right' });

  // ── Notes ──
  if (rental.notes) {
    finalY += 14;
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES', 14, finalY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    doc.text(doc.splitTextToSize(rental.notes, pageWidth - 28), 14, finalY + 5);
  }

  // ── Footer ──
  doc.setFontSize(6);
  doc.setTextColor(180, 180, 180);
  doc.text(
    `LIGHT DEPT CRM  —  Generated ${new Date().toLocaleString()}`,
    14, pageHeight - 6
  );

  // ── Save ──
  const fname = sanitizeFilename(client?.name || 'unknown');
  doc.save(`rental_${fname}_${(rental.id || '').slice(-8)}.pdf`);
}