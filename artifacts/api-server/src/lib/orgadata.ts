import AdmZip from 'adm-zip';

export interface OrgadataMetadata {
  projectName: string | null;
  personInCharge: string | null;
}

/** Extract all <w:t> text runs from a paragraph XML string. */
function paraText(paraXml: string): string {
  return (paraXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
    .map(t => t.replace(/<[^>]+>/g, ''))
    .join('');
}

/** Split table-row XML into cell XML strings. */
function splitCells(rowXml: string): string[] {
  const cells: string[] = [];
  const re = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rowXml)) !== null) cells.push(m[0]);
  return cells;
}

/** Split cell XML into paragraph XML strings. */
function splitParas(cellXml: string): string[] {
  const paras: string[] = [];
  const re = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cellXml)) !== null) paras.push(m[0]);
  return paras;
}

/** Split table XML into row XML strings. */
function splitRows(tableXml: string): string[] {
  const rows: string[] = [];
  const re = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tableXml)) !== null) rows.push(m[0]);
  return rows;
}

/**
 * Extract project name and person in charge from Orgadata DOCX buffer.
 * Reads Row 2 of the first header table, matching Cell-0 label paragraphs
 * to Cell-1 value paragraphs by index.
 * Pure function — no DB, no side effects.
 */
export function extractOrgadataMetadata(docxBuffer: Buffer): OrgadataMetadata {
  try {
    const zip = new AdmZip(docxBuffer);
    const documentXml = zip.getEntry('word/document.xml');
    if (!documentXml) return { projectName: null, personInCharge: null };

    const xml = documentXml.getData().toString('utf-8');

    // Find first table
    const tableMatch = xml.match(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/);
    if (!tableMatch) return { projectName: null, personInCharge: null };

    const rows = splitRows(tableMatch[0]);
    // Row index 1 is the data row (index 0 is typically the column header row)
    // Try rows 1 and 2 in case the first real data row varies
    let projectName: string | null = null;
    let personInCharge: string | null = null;

    for (let ri = 0; ri < rows.length && (!projectName && !personInCharge); ri++) {
      const cells = splitCells(rows[ri]);
      if (cells.length < 2) continue;

      const labelParas = splitParas(cells[0]).map(paraText).map(s => s.trim());
      const valueParas = splitParas(cells[1]).map(paraText).map(s => s.trim());

      for (let pi = 0; pi < labelParas.length; pi++) {
        const label = labelParas[pi];
        const value = valueParas[pi] ?? '';
        if (/project\s*name/i.test(label) && value) projectName = value;
        if (/person\s+in\s+charge/i.test(label) && value) personInCharge = value;
      }
    }

    return { projectName, personInCharge };
  } catch {
    return { projectName: null, personInCharge: null };
  }
}
