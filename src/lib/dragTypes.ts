import type { StudyEvent } from "../types";

export interface MoveEventDragData {
  type: "move-event";
  event: StudyEvent;
}

export interface ScheduleFromInboxDragData {
  type: "schedule-from-inbox";
  event: StudyEvent;
}

export type StudyFlowDragData = MoveEventDragData | ScheduleFromInboxDragData;

export interface WeekDayDropData {
  type: "day-slot";
  date: string;
  getTimeFromY: (clientY: number) => string;
}

export interface MonthDayDropData {
  type: "month-day";
  date: string;
}

export type StudyFlowDropData = WeekDayDropData | MonthDayDropData;
