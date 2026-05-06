import { detectFormat } from "./detectors";
import { parseJson } from "./jsonParser";
import { parseMarkdown } from "./markdownParser";
import { parseNarrative } from "./narrativeParser";
import type { ParseResult } from "./types";

export interface ParseOptions {
  formatHint?: "json" | "narrative" | "markdown" | "auto";
}

export function parseInput(
  rawText: string,
  options: ParseOptions = {},
): ParseResult {
  const text = rawText.trim();
  if (!text) {
    return { ok: false, error: "Sin contenido", format: "unknown" };
  }

  const hint = options.formatHint ?? "auto";
  const format = hint === "auto" ? detectFormat(text) : hint;

  switch (format) {
    case "json":
      return parseJson(text);
    case "narrative":
      return parseNarrative(text);
    case "markdown":
      return parseMarkdown(text);
    case "unknown":
    default: {
      const narrative = parseNarrative(text);
      if (narrative.ok) return narrative;
      const markdown = parseMarkdown(text);
      if (markdown.ok) return markdown;
      const json = parseJson(text);
      if (json.ok) return json;
      return {
        ok: false,
        error: "Formato no reconocido",
        format: "unknown",
      };
    }
  }
}

export { detectFormat, countNarrativeDays } from "./detectors";
export { parseJson } from "./jsonParser";
export { parseMarkdown } from "./markdownParser";
export { parseNarrative } from "./narrativeParser";
export { scheduleBlocks } from "./autoplanner";
export { NARRATIVE_TEMPLATE, JSON_TEMPLATE } from "./templateGenerator";
export type {
  AutoplanOptions,
  AutoplanResult,
  AutoplanWorkSlot,
  ParseResult,
  ParsedBlock,
  ParsedFormat,
  ScheduledBlock,
} from "./types";
