import type {
  ParseResult,
  ParsedBlock,
  StudyEventType,
  StudyPriority,
} from "./types";

const VALID_TYPES = new Set<StudyEventType>([
  "theory",
  "practice",
  "review",
  "exam",
]);

const VALID_PRIORITIES = new Set<StudyPriority>(["low", "medium", "high"]);

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

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `block_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

export function parseJson(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Sin contenido", format: "json" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "JSON invalido";
    return { ok: false, error: `JSON inválido: ${message}`, format: "json" };
  }

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      error: "El JSON debe ser un array de bloques",
      format: "json",
    };
  }

  const blocks: ParsedBlock[] = [];

  for (const [index, item] of parsed.entries()) {
    if (!item || typeof item !== "object") {
      return {
        ok: false,
        error: `Elemento ${index}: objeto inválido`,
        format: "json",
      };
    }

    const record = item as Record<string, unknown>;

    if (typeof record.title !== "string" || !record.title.trim()) {
      return {
        ok: false,
        error: `Elemento ${index}: título es obligatorio`,
        format: "json",
      };
    }

    if (typeof record.date !== "string" || !isValidIsoDate(record.date)) {
      return {
        ok: false,
        error: `Elemento ${index}: fecha inválida`,
        format: "json",
      };
    }

    if (typeof record.startTime !== "string" || !isValidTime(record.startTime)) {
      return {
        ok: false,
        error: `Elemento ${index}: hora inválida`,
        format: "json",
      };
    }

    if (
      typeof record.durationMinutes !== "number" ||
      !Number.isFinite(record.durationMinutes) ||
      record.durationMinutes <= 0 ||
      record.durationMinutes >= 1440
    ) {
      return {
        ok: false,
        error: `Elemento ${index}: durationMinutes debe ser > 0 y < 1440`,
        format: "json",
      };
    }

    const rawType = typeof record.type === "string" ? record.type : "theory";
    const type = (
      VALID_TYPES.has(rawType as StudyEventType) ? rawType : "theory"
    ) as StudyEventType;

    const rawPriority =
      typeof record.priority === "string" ? record.priority : "medium";
    const priority = (
      VALID_PRIORITIES.has(rawPriority as StudyPriority) ? rawPriority : "medium"
    ) as StudyPriority;

    blocks.push({
      id: makeId(),
      title: record.title.trim(),
      description:
        typeof record.description === "string" && record.description.trim()
          ? record.description.trim()
          : undefined,
      durationMinutes: record.durationMinutes,
      tagId: typeof record.tagId === "string" ? record.tagId : null,
      type,
      priority,
      date: record.date,
      startTime: record.startTime,
    });
  }

  return { ok: true, blocks, format: "json" };
}
