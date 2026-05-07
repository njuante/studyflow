import { invoke } from "@tauri-apps/api/core";

import type { StudyEvent, Tag, TagStats, TagViewOptions } from "../types";

export function getTags(): Promise<Tag[]> {
  return invoke<Tag[]>("get_tags");
}

export function createTag(
  name: string,
  color: string,
  icon?: string,
): Promise<Tag> {
  return invoke<Tag>("create_tag", { name, color, icon: icon || null });
}

export function updateTag(
  id: string,
  name: string,
  color: string,
  icon?: string,
): Promise<Tag> {
  return invoke<Tag>("update_tag", { id, name, color, icon: icon || null });
}

export function deleteTag(id: string): Promise<void> {
  return invoke<void>("delete_tag", { id });
}

export function reorderTags(ids: string[]): Promise<void> {
  return invoke<void>("reorder_tags", { ids });
}

export function countEventsByTag(id: string): Promise<number> {
  return invoke<number>("count_events_by_tag", { id });
}

export function getEventsByTag(
  tagId: string,
  options: TagViewOptions,
): Promise<StudyEvent[]> {
  return invoke<StudyEvent[]>("get_events_by_tag", { tagId, options });
}

export function getTagStats(tagId: string): Promise<TagStats> {
  return invoke<TagStats>("get_tag_stats", { tagId });
}

export function bulkChangeTag(
  eventIds: string[],
  newTagId: string | null,
): Promise<number> {
  return invoke<number>("bulk_change_tag", { eventIds, newTagId });
}

export function getEventsInRange(
  startDate: string,
  endDate: string,
): Promise<StudyEvent[]> {
  return invoke<StudyEvent[]>("get_events_in_range", {
    startDate,
    endDate,
  });
}

export function createEvent(event: StudyEvent): Promise<StudyEvent> {
  return invoke<StudyEvent>("create_event", { event });
}

export function updateEvent(event: StudyEvent): Promise<StudyEvent> {
  return invoke<StudyEvent>("update_event", { event });
}

export function deleteEvent(id: string): Promise<void> {
  return invoke<void>("delete_event", { id });
}

export function bulkCreateEvents(events: StudyEvent[]): Promise<number> {
  return invoke<number>("bulk_create_events", { events });
}

export function getTodayEvents(): Promise<StudyEvent[]> {
  return invoke<StudyEvent[]>("get_today_events");
}

export function getInboxEvents(): Promise<StudyEvent[]> {
  return invoke<StudyEvent[]>("get_inbox_events");
}

export function getArchiveEvents(
  limit: number,
  offset: number,
): Promise<StudyEvent[]> {
  return invoke<StudyEvent[]>("get_archive_events", { limit, offset });
}

export function countInboxEvents(): Promise<number> {
  return invoke<number>("count_inbox_events");
}

export function scheduleEvent(
  id: string,
  date: string,
  startTime: string,
): Promise<StudyEvent> {
  return invoke<StudyEvent>("schedule_event", { id, date, startTime });
}

export function unscheduleEvent(id: string): Promise<StudyEvent> {
  return invoke<StudyEvent>("unschedule_event", { id });
}

export function completeEvent(id: string): Promise<StudyEvent> {
  return invoke<StudyEvent>("complete_event", { id });
}
