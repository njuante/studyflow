import type { ParsedFormat } from "./types";

const NARRATIVE_DAY_REGEX =
  /(?:^|\n)\s*(?:[*\-•]\s*)?(?:d[ií]a|d)\s*\d+\s*[:.\-–—]/iu;

const NARRATIVE_DAY_GLOBAL_REGEX =
  /(?:^|\n)\s*(?:[*\-•]\s*)?(?:d[ií]a|d)\s*(\d+)\s*[:.\-–—]/giu;

export function detectFormat(text: string): ParsedFormat {
  const trimmed = text.trim();
  if (!trimmed) return "unknown";

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // fallthrough
    }
  }

  if (NARRATIVE_DAY_REGEX.test(trimmed)) {
    return "narrative";
  }

  if (
    /^##\s+\d{4}-\d{2}-\d{2}/m.test(trimmed) ||
    /\|\s*D[ií]a/i.test(trimmed) ||
    /^-\s*\[\d{1,2}:\d{2}/m.test(trimmed)
  ) {
    return "markdown";
  }

  return "unknown";
}

export function countNarrativeDays(text: string): number {
  const days = new Set<number>();
  for (const match of text.matchAll(NARRATIVE_DAY_GLOBAL_REGEX)) {
    days.add(Number(match[1]));
  }
  return days.size;
}
