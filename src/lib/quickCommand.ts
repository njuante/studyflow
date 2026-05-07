import { extractDuration } from "./parser/narrativeParser";
import { toIsoDate } from "./dates";

export interface QuickCommandResult {
  title: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  hasExplicitDate: boolean;
  hasExplicitTime: boolean;
}

const TIME_REGEX = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;
const ISO_DATE_REGEX = /\b(\d{4}-\d{2}-\d{2})\b/;
const DM_DATE_REGEX = /\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/;

const WEEKDAY_NAMES: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  "miércoles": 3,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  "sábado": 6,
  sabado: 6,
};

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(base.getDate() + days);
  return next;
}

export function parseQuickCommand(input: string): QuickCommandResult | null {
  const text = input.trim();
  if (!text) return null;

  let working = ` ${text} `;
  let date = new Date();
  let hasExplicitDate = false;
  let startTime = "09:00";
  let hasExplicitTime = false;

  const isoMatch = working.match(ISO_DATE_REGEX);
  if (isoMatch) {
    const [year, month, day] = isoMatch[1].split("-").map(Number);
    date = new Date(year, month - 1, day);
    hasExplicitDate = true;
    working = working.replace(isoMatch[0], " ");
  } else {
    const dmMatch = working.match(DM_DATE_REGEX);
    if (dmMatch) {
      const day = Number(dmMatch[1]);
      const month = Number(dmMatch[2]);
      const yearRaw = dmMatch[3];
      const today = new Date();
      const year = yearRaw
        ? Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw)
        : today.getFullYear();
      date = new Date(year, month - 1, day);
      hasExplicitDate = true;
      working = working.replace(dmMatch[0], " ");
    } else {
      const lower = working.toLowerCase();
      if (/\bpasado\s+ma[nñ]ana\b/.test(lower)) {
        date = addDays(new Date(), 2);
        hasExplicitDate = true;
        working = working.replace(/\bpasado\s+ma[nñ]ana\b/i, " ");
      } else if (/\bma[nñ]ana\b/.test(lower)) {
        date = addDays(new Date(), 1);
        hasExplicitDate = true;
        working = working.replace(/\bma[nñ]ana\b/i, " ");
      } else if (/\bhoy\b/.test(lower)) {
        date = new Date();
        hasExplicitDate = true;
        working = working.replace(/\bhoy\b/i, " ");
      } else {
        for (const [name, weekday] of Object.entries(WEEKDAY_NAMES)) {
          const regex = new RegExp(`\\b${name}\\b`, "i");
          if (regex.test(working)) {
            const today = new Date();
            const todayDow = today.getDay();
            let delta = (weekday - todayDow + 7) % 7;
            if (delta === 0) delta = 7;
            date = addDays(today, delta);
            hasExplicitDate = true;
            working = working.replace(regex, " ");
            break;
          }
        }
      }
    }
  }

  const timeMatch = working.match(TIME_REGEX);
  if (timeMatch) {
    startTime = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
    hasExplicitTime = true;
    working = working.replace(timeMatch[0], " ");
  }

  const durationMinutes = extractDuration(text);
  const titleCandidate = working
    .replace(/\b\d+\s*(?:horas?|h|min|minutos?|mins?)\b/gi, " ")
    .replace(/\bmedia\s+hora\b/gi, " ")
    .replace(/\bhora\s+y\s+media\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!titleCandidate) return null;

  return {
    title: titleCandidate,
    date: toIsoDate(date),
    startTime,
    durationMinutes,
    hasExplicitDate,
    hasExplicitTime,
  };
}
