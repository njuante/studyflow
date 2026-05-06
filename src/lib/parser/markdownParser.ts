import type { ParseResult, ParsedBlock, StudyEventType } from "./types";

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

function toIsoFromSlashDate(value: string): string | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (!match) return null;
  const [, dayString, monthString, yearString] = match;
  const year = yearString ? Number(yearString) : new Date().getFullYear();
  const month = Number(monthString);
  const day = Number(dayString);
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidIsoDate(iso) ? iso : null;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `block_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

function parseRange(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function inferType(text: string): StudyEventType {
  const lower = text.toLowerCase();
  if (/\b(test|examen|autoevaluaci[oó]n)\b/.test(lower)) return "exam";
  if (/\b(lab|pr[aá]ctic|implement|ejercicio)\b/.test(lower)) return "practice";
  if (/\b(repas|revis|memoriz)/.test(lower)) return "review";
  return "theory";
}

export function parseMarkdown(input: string): ParseResult {
  const text = input.trim();
  if (!text) {
    return { ok: false, error: "Sin contenido", format: "markdown" };
  }

  const lines = text.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];
  const warnings: string[] = [];
  let currentDate: string | null = null;

  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line) continue;

    const dateHeading = line.match(/^##\s+(.+)$/);
    if (dateHeading) {
      const value = dateHeading[1].trim();
      if (isValidIsoDate(value)) {
        currentDate = value;
        continue;
      }
      const slash = toIsoFromSlashDate(value);
      if (slash) {
        currentDate = slash;
        continue;
      }
    }

    const bulletMatch = line.match(
      /^-\s*\[(\d{1,2}:\d{2})\s*[–—\-]\s*(\d{1,2}:\d{2})\]\s*(.+)$/u,
    );

    if (bulletMatch) {
      if (!currentDate) {
        return {
          ok: false,
          error: `Markdown inválido en línea ${lineNumber}: falta encabezado de fecha`,
          format: "markdown",
        };
      }

      const [, startTime, endTime, rawContent] = bulletMatch;
      const tagMatch = rawContent.match(/#([a-z0-9]+)/i);
      const title = rawContent
        .replace(/\*\*/g, "")
        .replace(/#([a-z0-9]+)/gi, "")
        .trim();

      blocks.push({
        id: makeId(),
        title: title || "Bloque importado",
        description: undefined,
        durationMinutes: parseRange(startTime, endTime),
        tagId: tagMatch ? tagMatch[1].toLowerCase() : null,
        type: inferType(title),
        priority: "medium",
        date: currentDate,
        startTime,
      });
      continue;
    }

    if (line.startsWith("- ")) {
      warnings.push(`Línea ${lineNumber}: ítem markdown no reconocido`);
    }
  }

  if (blocks.length === 0) {
    return {
      ok: false,
      error: "No se detectaron bloques en Markdown",
      format: "markdown",
    };
  }

  return {
    ok: true,
    blocks,
    format: "markdown",
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
