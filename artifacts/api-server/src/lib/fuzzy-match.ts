import { compareTwoStrings } from 'string-similarity';

export interface MatchResult {
  id: number;
  name: string;
  customerName: string;
  score: number; // 0-100
}

interface ProjectRow {
  id: number;
  name: string;
  customerName: string;
}

/**
 * Normalize text for fuzzy comparison:
 * lowercase, trim, collapse spaces, remove punctuation
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[.,\-_/\\]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Find projects whose name fuzzy-matches the query.
 * Returns matches with score >= 60, sorted descending by score, max 5.
 */
export function findFuzzyMatches(
  query: string,
  projects: ProjectRow[]
): MatchResult[] {
  if (!query || !projects.length) return [];

  const normalizedQuery = normalize(query);
  const results: MatchResult[] = [];

  for (const project of projects) {
    const normalizedName = normalize(project.name);
    const similarity = compareTwoStrings(normalizedQuery, normalizedName);
    const score = Math.round(similarity * 100);

    if (score >= 60) {
      results.push({
        id: project.id,
        name: project.name,
        customerName: project.customerName,
        score,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 5);
}
