import AdmZip from 'adm-zip';
import type { AssemblyGlassItem, AssemblyPosition } from '@workspace/db';

export interface ParsedAssemblyList {
  projectName: string | null;
  positionCount: number;
  positions: AssemblyPosition[];
}

const GLASS_SECTION_STOP_KEYWORDS = new Set([
  'Gaskets', 'Profiles', 'Accessories', 'Glazing Beads', 'Page:', 'Position:', 'Continuation of',
]);

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

export function parseAssemblyListDocx(buffer: Buffer): ParsedAssemblyList {
  const segs = extractTextSegments(buffer);
  const projectName = extractProjectName(segs);
  const positions: AssemblyPosition[] = [];
  let current: AssemblyPosition | null = null;

  const posRe = /^Position:\s+(.+)$/;
  const qtyRe = /^Quantity:\s+(\d[\d,]*)/;
  const sysRe = /^System:\s+(.+)$/;
  const sizeRe = /^Size:\s+([\d,]+)\s+x\s+([\d,]+)\s+mm$/;

  let i = 0;
  while (i < segs.length) {
    const seg = segs[i];

    const posMatch = posRe.exec(seg);
    if (posMatch) {
      if (current) positions.push(current);
      current = {
        positionCode: posMatch[1].trim(),
        quantity: 0,
        system: null,
        widthMm: null,
        heightMm: null,
        glassItems: [],
      };
      i++;
      continue;
    }

    if (current) {
      const qtyMatch = qtyRe.exec(seg);
      if (qtyMatch) {
        current.quantity = parseInt(qtyMatch[1].replace(/,/g, ''), 10) || 0;
        i++;
        continue;
      }

      const sysMatch = sysRe.exec(seg);
      if (sysMatch) {
        current.system = sysMatch[1].trim();
        i++;
        continue;
      }

      const sizeMatch = sizeRe.exec(seg);
      if (sizeMatch) {
        current.widthMm = parseNum(sizeMatch[1]);
        current.heightMm = parseNum(sizeMatch[2]);
        i++;
        continue;
      }

      if (seg === 'Glass') {
        // skip 9 header segments
        i++;
        let skipped = 0;
        while (i < segs.length && skipped < 9) {
          i++;
          skipped++;
        }
        // parse groups of 6 until stop keyword
        while (i + 5 < segs.length) {
          const s0 = segs[i];
          // stop if we hit a known section keyword or a new Position/Page
          if (
            GLASS_SECTION_STOP_KEYWORDS.has(s0) ||
            posRe.test(s0) ||
            s0.startsWith('Page:')
          ) {
            break;
          }
          const row: string[] = [s0, segs[i + 1], segs[i + 2], segs[i + 3], segs[i + 4], segs[i + 5]];
          // row[0] = qty_str like "1 (9) Pcs." or "2 Pcs."
          const qtyStr = row[0];
          const qtyNum = parseInt(qtyStr.replace(/[^\d].*/, ''), 10) || 0;
          if (qtyNum === 0 && !/^\d/.test(qtyStr)) break; // sanity check
          const item: AssemblyGlassItem = {
            quantity: qtyNum,
            widthMm: parseNum(row[1]),
            heightMm: parseNum(row[2]),
            areaSqm: parseNum(row[3]),
            description: row[4].trim(),
          };
          current.glassItems.push(item);
          i += 6;
        }
        continue;
      }
    }

    i++;
  }

  if (current) positions.push(current);

  return {
    projectName,
    positionCount: positions.length,
    positions,
  };
}
