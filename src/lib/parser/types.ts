import type { StudyEvent } from "../../types";

export type StudyEventType = StudyEvent["type"];
export type StudyPriority = StudyEvent["priority"];

export type ParsedFormat = "json" | "narrative" | "markdown" | "unknown";

export interface ParsedBlock {
  id: string;
  title: string;
  description?: string;
  durationMinutes: number;
  type: StudyEventType;
  priority: StudyPriority;
  tagId: string | null;
  dayNumber?: number;
  blockGroup?: string | null;
  date?: string;
  startTime?: string;
}

export interface ParseResult {
  ok: boolean;
  format?: ParsedFormat;
  blocks?: ParsedBlock[];
  error?: string;
  warnings?: string[];
}

export interface AutoplanWorkSlot {
  start: string;
  end: string;
}

export interface AutoplanOptions {
  startDate: Date;
  skipWeekends: boolean;
  workSlots: AutoplanWorkSlot[];
  maxHoursPerDay: number;
  splitIntoPomodoros: boolean;
  avoidSameTagInRow: boolean;
  placement: "random" | "sequential";
  defaultTagId: string | null;
}

export interface ScheduledBlock extends ParsedBlock {
  scheduled: boolean;
  date: string;
  startTime: string;
}

export interface AutoplanResult {
  scheduledBlocks: ScheduledBlock[];
  inboxBlocks: ScheduledBlock[];
  warnings: string[];
}
