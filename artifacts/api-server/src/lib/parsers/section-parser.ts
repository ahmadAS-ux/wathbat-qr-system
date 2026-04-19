import AdmZip from 'adm-zip';

export interface SectionDrawing {
  orderIndex: number;
  mediaFilename: string;
  mimeType: string;
  imageData: Buffer;
  positionCode: string | null;
}

export interface ParsedSection {
  projectName: string | null;
  system: string | null;
  drawings: SectionDrawing[];
}

export function parseSectionDocx(buffer: Buffer): ParsedSection {
  const zip = new AdmZip(buffer);
  const docXmlEntry = zip.getEntry('word/document.xml');
  const relsEntry = zip.getEntry('word/_rels/document.xml.rels');
  if (!docXmlEntry || !relsEntry) throw new Error('Invalid DOCX: missing document.xml or rels');
  const xml = docXmlEntry.getData().toString('utf8');
  const relsXml = relsEntry.getData().toString('utf8');

  // --- Metadata from text ---
  const texts: string[] = [];
  const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = textRegex.exec(xml)) !== null) texts.push(m[1]);
  const fullText = texts.join(' ').replace(/\s+/g, ' ').trim();

  let projectName: string | null = null;
  const jobMatch = fullText.match(/Job:\s*(.+?)\s+(?:System:|$)/);
  if (jobMatch) projectName = jobMatch[1].trim();

  let system: string | null = null;
  const sysMatch = fullText.match(/System:\s*(.+?)\s+(?:Flat Glazing|Exterior View|Interior View|Pos\.|$)/);
  if (sysMatch) system = sysMatch[1].trim();

  // --- Build rId → mediaFilename map ---
  const rIdMap = new Map<string, string>();
  const relRegex = /<Relationship\s+[^>]*Id="([^"]+)"[^>]*Target="(media\/[^"]+)"/g;
  let rm: RegExpExecArray | null;
  while ((rm = relRegex.exec(relsXml)) !== null) rIdMap.set(rm[1], rm[2]);

  // --- Walk document.xml in order: collect <a:blip r:embed="rId..."/> ---
  const blipRegex = /<a:blip[^>]+r:embed="([^"]+)"/g;
  const orderedRIds: string[] = [];
  let bm: RegExpExecArray | null;
  while ((bm = blipRegex.exec(xml)) !== null) orderedRIds.push(bm[1]);

  // Dedupe consecutive duplicates (Orgadata quirk)
  const seenOnce = new Set<string>();
  const uniqueOrderedRIds: string[] = [];
  for (const rid of orderedRIds) {
    if (seenOnce.has(rid)) continue;
    seenOnce.add(rid);
    uniqueOrderedRIds.push(rid);
  }

  // --- Pull image buffers ---
  const drawings: SectionDrawing[] = [];
  let orderIndex = 0;
  for (const rid of uniqueOrderedRIds) {
    const relTarget = rIdMap.get(rid);
    if (!relTarget) continue;
    const entry = zip.getEntry(`word/${relTarget}`);
    if (!entry) continue;
    const filename = relTarget.replace(/^media\//, '');
    const ext = filename.split('.').pop()?.toLowerCase() || 'png';
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                   : ext === 'png' ? 'image/png'
                   : ext === 'gif' ? 'image/gif'
                   : 'application/octet-stream';
    drawings.push({
      orderIndex: orderIndex++,
      mediaFilename: filename,
      mimeType,
      imageData: entry.getData(),
      // TODO v2.5.2: pair Nth drawing with Nth position from Quotation for contract generation
      positionCode: null,
    });
  }

  return { projectName, system, drawings };
}
