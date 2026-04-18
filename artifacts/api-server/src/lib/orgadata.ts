import AdmZip from 'adm-zip';

export interface OrgadataMetadata {
  projectName: string | null;
  personInCharge: string | null;
}

/**
 * Extract project name and person in charge from Orgadata DOCX buffer.
 * Pure function — no DB, no side effects.
 */
export function extractOrgadataMetadata(docxBuffer: Buffer): OrgadataMetadata {
  try {
    const zip = new AdmZip(docxBuffer);
    const documentXml = zip.getEntry('word/document.xml');
    if (!documentXml) return { projectName: null, personInCharge: null };

    const xml = documentXml.getData().toString('utf-8');

    // Strip XML tags, get plain text
    const text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // Match "Project name:" followed by value
    const projectMatch = text.match(/Project\s+name\s*:\s*([^\n]+?)(?=\s+Person|\s+Date|\s+Glass|\s+Name|$)/i);
    const personMatch = text.match(/Person\s+in\s+[Cc]harge\s*:\s*([^\n]+?)(?=\s+Project|\s+Date|\s+Glass|\s+Name|$)/i);

    return {
      projectName: projectMatch ? projectMatch[1].trim() : null,
      personInCharge: personMatch ? personMatch[1].trim() : null,
    };
  } catch {
    return { projectName: null, personInCharge: null };
  }
}
