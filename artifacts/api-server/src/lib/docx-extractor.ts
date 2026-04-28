import mammoth from "mammoth";

const PAGE_PATTERN = /page\s+\d+\s+of\s+\d+/i;
const PAGE_NUM_PATTERN = /^\s*\d+\s*$/;

/**
 * Converts a .docx buffer to an A4-sized HTML string suitable for browser preview.
 *
 * The output has project-name headers and page-number footers stripped
 * (conservative heuristic — only removes elements that are clearly structural).
 * The returned HTML is a complete document ready to serve with Content-Type: text/html.
 *
 * Throws with a clear English message if the buffer is unreadable.
 */
export async function extractDocxToA4Html(docxBuffer: Buffer): Promise<string> {
  let result: { value: string; messages: unknown[] };
  try {
    result = await mammoth.convertToHtml({ buffer: docxBuffer });
  } catch (err) {
    throw new Error(`docx extraction failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!result.value || result.value.trim().length === 0) {
    throw new Error("docx extraction produced empty output — file may be malformed or empty");
  }

  const stripped = stripStructuralNoise(result.value);

  return `<!DOCTYPE html>
<html dir="auto">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @page { size: A4; margin: 20mm; }
    body {
      font-family: 'Tajawal', 'DM Sans', Arial, sans-serif;
      max-width: 170mm;
      margin: 0 auto;
      padding: 8px;
      color: #1a1a1a;
      font-size: 13px;
      line-height: 1.6;
    }
    table { border-collapse: collapse; width: 100%; margin: 8px 0; }
    th, td { border: 1px solid #ccc; padding: 4px 8px; }
    th { background: #f4f4f4; font-weight: 600; }
    img { max-width: 100%; }
    p { margin: 4px 0; }
  </style>
</head>
<body>
${stripped}
</body>
</html>`;
}

/**
 * Strips elements that are structurally noise in Orgadata exports:
 * - Page-number-only paragraphs ("1", "2 / 5", "Page 1 of 3")
 * - Paragraphs matching "Page X of Y" pattern
 *
 * Does NOT strip the project name header — that removal is intentionally
 * conservative because the project name may appear mid-document in tables.
 * The NameMismatchModal handles project name conflicts at the upload layer.
 */
function stripStructuralNoise(html: string): string {
  return html
    .split(/(?<=<\/p>)/)
    .filter(segment => {
      const text = segment.replace(/<[^>]+>/g, "").trim();
      if (PAGE_NUM_PATTERN.test(text)) return false;
      if (PAGE_PATTERN.test(text)) return false;
      return true;
    })
    .join("");
}
