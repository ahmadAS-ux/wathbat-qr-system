import AdmZip from 'adm-zip';
import type { CutProfile } from '@workspace/db';

export interface ParsedCutOptimisation {
  projectName: string | null;
  profileCount: number;
  profiles: CutProfile[];
}

function extractTextSegments(buffer: Buffer): string[] {
  const zip = new AdmZip(buffer);
  const docXmlEntry = zip.getEntry('word/document.xml');
  if (!docXmlEntry) throw new Error('Invalid DOCX: word/document.xml not found');
  const xml = docXmlEntry.getData().toString('utf8');
  const segs: string[] = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const s = m[1];
    if (s.trim()) segs.push(s);
  }
  return segs;
}

function extractProjectName(segs: string[]): string | null {
  for (let i = 1; i < segs.length - 1; i++) {
    if (segs[i] === 'Date:' && segs[i + 1] === 'Project:') {
      return segs[i - 1].trim();
    }
  }
  return null;
}

function parseNum(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0;
}

export function parseCutOptimisationDocx(buffer: Buffer): ParsedCutOptimisation {
  const segs = extractTextSegments(buffer);
  const projectName = extractProjectName(segs);
  const profiles: CutProfile[] = [];

  // Find the "Summary" marker
  let summaryIdx = -1;
  for (let i = segs.length - 1; i >= 0; i--) {
    if (segs[i] === 'Summary') {
      summaryIdx = i;
      break;
    }
  }

  if (summaryIdx !== -1) {
    // skip 11 header segments after "Summary"
    let i = summaryIdx + 1 + 11;

    // parse groups of 7
    while (i + 6 < segs.length) {
      const row = segs.slice(i, i + 7);
      // row: [number, description, colour, qty, length_mm, wastage_mm, wastage_percent]
      const qty = parseInt(row[3].replace(/,/g, ''), 10) || 0;
      if (qty === 0 && !/^\d/.test(row[3])) break;

      profiles.push({
        number: row[0].trim(),
        description: row[1].trim(),
        colour: row[2].trim(),
        quantity: qty,
        lengthMm: parseNum(row[4]),
        wastageMm: parseNum(row[5]),
        wastagePercent: parseNum(row[6]),
      });
      i += 7;
    }
  }

  return {
    projectName,
    profileCount: profiles.length,
    profiles,
  };
}
