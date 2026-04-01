import type { TimelineEntry } from '@/types';
import { getJurisdictionSummary } from './timeline-engine';
import { logExport } from './storage';

const DISCLAIMER = `ResiDues is a reconstruction aid, not a legal or tax compliance tool. Inferred jurisdictions are based on photo metadata and may be inaccurate. Users should verify all dates independently before submitting to tax authorities, immigration agencies, or employers. ResiDues makes no warranties regarding the accuracy or completeness of any timeline.`;

export async function exportCSV(timeline: TimelineEntry[], year: number): Promise<void> {
  const header = 'Date,Jurisdiction,Confidence,Confidence Score,Evidence Count,Manual Override,Notes';
  const rows = timeline.map(e => {
    const jurisdiction = e.overrides?.jurisdiction || e.jurisdiction;
    const override = e.overrides ? 'Yes' : 'No';
    const notes = e.overrides?.note ? `"${e.overrides.note.replace(/"/g, '""')}"` : '';
    return `${e.date},${jurisdiction},${e.confidence},${e.confidenceScore.toFixed(2)},${e.evidence.length},${override},${notes}`;
  });

  const csv = [
    `# ResiDues Timeline Export - ${year}`,
    `# Generated: ${new Date().toISOString()}`,
    `# ${DISCLAIMER}`,
    '',
    header,
    ...rows,
  ].join('\n');

  downloadFile(`residues-timeline-${year}.csv`, csv, 'text/csv');
  await logExport('csv');
}

export async function exportTaxSummaryPDF(timeline: TimelineEntry[], year: number): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const summary = getJurisdictionSummary(timeline);
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.text('ResiDues Tax Summary', 14, 22);
  doc.setFontSize(12);
  doc.text(`Tax Year: ${year}`, 14, 32);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 40);

  // Country summary
  let y = 52;
  doc.setFontSize(14);
  doc.text('Days by Country', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Country', 'Total Days', 'High Confidence Days']],
    body: summary.countries.map(c => [c.jurisdiction, c.days.toString(), c.highConfidenceDays.toString()]),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 12;

  // US State summary (if applicable)
  if (summary.states.length > 0) {
    doc.setFontSize(14);
    doc.text('Days by US State', 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['State', 'Total Days', 'High Confidence Days']],
      body: summary.states.map(s => [s.jurisdiction, s.days.toString(), s.highConfidenceDays.toString()]),
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Substantial Presence Test
  if (summary.usDays > 0) {
    doc.setFontSize(14);
    doc.text('Substantial Presence Test', 14, y);
    y += 8;
    doc.setFontSize(11);
    doc.text(`Days in the United States (${year}): ${summary.usDays}`, 14, y);
    y += 7;
    doc.text(`Threshold: 183 days`, 14, y);
    y += 7;
    const status = summary.usDays >= 183 ? 'THRESHOLD MET' : `${183 - summary.usDays} days remaining`;
    doc.text(`Status: ${status}`, 14, y);
    y += 14;
  }

  // Disclaimer
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  const splitDisclaimer = doc.splitTextToSize(DISCLAIMER, 180);
  doc.text(splitDisclaimer, 14, y);

  doc.save(`residues-tax-summary-${year}.pdf`);
  await logExport('pdf');
}

export async function exportJSON(timeline: TimelineEntry[]): Promise<void> {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    app: 'ResiDues',
    timeline,
  };
  const json = JSON.stringify(data, null, 2);
  downloadFile('residues-backup.json', json, 'application/json');
  await logExport('json');
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
