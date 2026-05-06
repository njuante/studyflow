import type {
  ParseResult,
  ParsedBlock,
  StudyEventType,
  StudyPriority,
} from "./types";

const DAY_LINE_REGEX =
  /^[\s>]*(?:[*\-•]\s+)?(?:d[ií]a|d)\s*(\d+)\s*[:.\-–—]\s*(.+)$/iu;

const BLOCK_HEADER_REGEX =
  /^[\s>]*(?:#{1,6}\s+)?(?:bloque|m[oó]dulo|tema|parte|secci[oó]n|unidad)\s*(\d+)?\s*[:\-–—]\s*(.+)$/iu;

const HEADING_REGEX = /^#{1,6}\s+(.+)$/u;

export function parseNarrative(input: string): ParseResult {
  const text = input.trim();
  if (!text) {
    return { ok: false, error: "Sin contenido", format: "narrative" };
  }

  const lines = text.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];
  let currentBlockGroup: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (DAY_LINE_REGEX.test(line)) {
      const match = line.match(DAY_LINE_REGEX);
      if (!match) continue;
      const dayNumber = Number(match[1]);
      const content = stripFormatting(match[2]);

      const { title, description } = splitTitleDescription(content);
      const durationMinutes = extractDuration(content);
      const type = inferType(content);
      const priority = inferPriority(content);

      blocks.push({
        id: makeId(),
        title,
        description: description.length > 0 ? description : undefined,
        durationMinutes,
        type,
        priority,
        tagId: null,
        dayNumber,
        blockGroup: currentBlockGroup,
      });
      continue;
    }

    const blockMatch = line.match(BLOCK_HEADER_REGEX);
    if (blockMatch) {
      currentBlockGroup = blockMatch[2].trim().replace(/[*_`]+/g, "").trim();
      continue;
    }

    const headingMatch = line.match(HEADING_REGEX);
    if (headingMatch) {
      const candidate = headingMatch[1].trim().replace(/[*_`]+/g, "").trim();
      if (candidate.length > 0) {
        currentBlockGroup = candidate;
      }
    }
  }

  if (blocks.length === 0) {
    return {
      ok: false,
      error: "No se han detectado bloques con formato 'Día N:'",
      format: "narrative",
    };
  }

  return { ok: true, blocks, format: "narrative" };
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `block_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

function stripFormatting(value: string): string {
  return value
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .trim();
}

function splitTitleDescription(content: string): {
  title: string;
  description: string;
} {
  const stripped = content
    .replace(/\s*\(\s*duraci[oó]n\s*[:\-–]?\s*[^)]*\)/gi, "")
    .replace(
      /\s*\([^)]*?(?:hora|horas|min|minutos?|h\b)[^)]*?\)/gi,
      "",
    )
    .trim();

  const sentenceMatch = stripped.match(/^(.+?[.!?])(?:\s+|$)(.*)$/su);
  if (sentenceMatch) {
    let title = sentenceMatch[1].trim().replace(/[.!?]+$/, "").trim();
    const description = sentenceMatch[2].trim();
    if (title.length > 80) {
      title = `${title.slice(0, 77).trim()}…`;
    }
    return { title, description };
  }

  if (stripped.length <= 80) {
    return { title: stripped, description: "" };
  }
  return {
    title: `${stripped.slice(0, 77).trim()}…`,
    description: stripped,
  };
}

export function extractDuration(text: string): number {
  const lower = text.toLowerCase();

  if (/\b(?:una\s+)?hora\s+y\s+media\b/.test(lower)) return 90;
  if (/\bmedia\s+hora\b/.test(lower)) return 30;

  const compoundHalf = lower.match(
    /(\d+)\s*(?:horas?\s+y\s+media|y\s+media\s+horas?)/,
  );
  if (compoundHalf) {
    const value = Number(compoundHalf[1]);
    if (Number.isFinite(value)) return value * 60 + 30;
  }

  const decimalHours = lower.match(/(\d+[.,]\d+)\s*horas?\b/);
  if (decimalHours) {
    const value = parseFloat(decimalHours[1].replace(",", "."));
    if (Number.isFinite(value)) return Math.round(value * 60);
  }

  const plainHours = lower.match(/(\d+)\s*horas?\b/);
  if (plainHours) {
    return Number(plainHours[1]) * 60;
  }

  const decimalH = lower.match(/(\d+[.,]\d+)\s*h\b/);
  if (decimalH) {
    const value = parseFloat(decimalH[1].replace(",", "."));
    if (Number.isFinite(value)) return Math.round(value * 60);
  }

  const hMatch = lower.match(/(\d+)\s*h\b/);
  if (hMatch) {
    return Number(hMatch[1]) * 60;
  }

  const minMatch = lower.match(/(\d+)\s*(?:minutos?|mins?\b)/);
  if (minMatch) {
    return Number(minMatch[1]);
  }

  return 120;
}

export function inferType(text: string): StudyEventType {
  const lower = text.toLowerCase();

  if (/\b(test|examen|autoevaluaci[oó]n)\b/.test(lower) || text.includes("📝")) {
    return "exam";
  }

  if (
    /\bevaluaci[oó]n\b/.test(lower) &&
    /\b(repas|revis|memoriz)/.test(lower)
  ) {
    return "review";
  }

  if (
    /\b(lab|laboratorio|pr[aá]ctica|pr[aá]ctico|implement|monta|configura|ejercicio|hands[- ]on|c[oó]digo|programa)\b/.test(
      lower,
    )
  ) {
    return "practice";
  }

  if (/\b(repasa|revisa|memoriza|repaso|revisi[oó]n)\b/.test(lower)) {
    return "review";
  }

  return "theory";
}

export function inferPriority(text: string): StudyPriority {
  const lower = text.toLowerCase();
  if (
    /\b(examen|test|importante|clave|cr[ií]tico|imprescindible|prioritario)\b/.test(
      lower,
    ) ||
    text.includes("📝")
  ) {
    return "high";
  }
  return "medium";
}
