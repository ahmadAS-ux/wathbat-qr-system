export function normalizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s/g, '')
    .trim();
}

export function namesMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return normalizeProjectName(a) === normalizeProjectName(b);
}
