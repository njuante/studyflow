import { toIsoDate } from "../dates";
import type {
  AutoplanOptions,
  AutoplanResult,
  ParsedBlock,
  ScheduledBlock,
} from "./types";

interface FreeSlot {
  startMin: number;
  endMin: number;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function nextWorkday(date: Date, skipWeekends: boolean): Date {
  const next = new Date(date);
  if (!skipWeekends) return next;
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function advanceOneDay(date: Date, skipWeekends: boolean): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return nextWorkday(next, skipWeekends);
}

function shuffle<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildInitialSlots(
  workSlots: AutoplanOptions["workSlots"],
): FreeSlot[] {
  return workSlots
    .map((slot) => ({
      startMin: timeToMinutes(slot.start),
      endMin: timeToMinutes(slot.end),
    }))
    .filter((slot) => slot.endMin > slot.startMin)
    .sort((a, b) => a.startMin - b.startMin);
}

function consumeSlot(
  slots: FreeSlot[],
  slotIndex: number,
  durationMinutes: number,
  paddingAfter: number,
): { startMin: number; endMin: number } {
  const slot = slots[slotIndex];
  const start = slot.startMin;
  const end = start + durationMinutes;
  const newStart = end + paddingAfter;
  if (newStart >= slot.endMin) {
    slots.splice(slotIndex, 1);
  } else {
    slots[slotIndex] = { startMin: newStart, endMin: slot.endMin };
  }
  return { startMin: start, endMin: end };
}

interface ChunkPlan {
  durations: number[];
  paddingAfter: number[];
}

function planChunks(
  block: ParsedBlock,
  splitIntoPomodoros: boolean,
): ChunkPlan {
  if (!splitIntoPomodoros || block.durationMinutes <= 90) {
    return { durations: [block.durationMinutes], paddingAfter: [0] };
  }

  const chunkSize = 50;
  const restGap = 10;
  const total = block.durationMinutes;
  const fullChunks = Math.floor(total / chunkSize);
  const remainder = total - fullChunks * chunkSize;

  const durations: number[] = [];
  for (let i = 0; i < fullChunks; i += 1) durations.push(chunkSize);
  if (remainder > 0) durations.push(remainder);

  const paddingAfter = durations.map((_, i) =>
    i < durations.length - 1 ? restGap : 0,
  );
  return { durations, paddingAfter };
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `block_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

function buildScheduledBlock(
  parent: ParsedBlock,
  options: AutoplanOptions,
  scheduled: boolean,
  date: string,
  startTime: string,
  chunkIndex: number,
  chunkTotal: number,
  durationMinutes: number,
): ScheduledBlock {
  const tagId = parent.tagId ?? options.defaultTagId;
  const title =
    chunkTotal > 1
      ? `${parent.title} (${chunkIndex + 1}/${chunkTotal})`
      : parent.title;

  return {
    ...parent,
    id: chunkTotal > 1 ? makeId() : parent.id,
    title,
    durationMinutes,
    tagId,
    scheduled,
    date,
    startTime,
  };
}

export function scheduleBlocks(
  blocks: ParsedBlock[],
  options: AutoplanOptions,
): AutoplanResult {
  const warnings: string[] = [];
  const scheduled: ScheduledBlock[] = [];
  const inbox: ScheduledBlock[] = [];

  if (blocks.length === 0) {
    return { scheduledBlocks: [], inboxBlocks: [], warnings: [] };
  }

  const blocksByDay = new Map<number, ParsedBlock[]>();
  for (const block of blocks) {
    const day = block.dayNumber ?? 1;
    const list = blocksByDay.get(day) ?? [];
    list.push(block);
    blocksByDay.set(day, list);
  }

  const sortedDays = Array.from(blocksByDay.keys()).sort((a, b) => a - b);

  let currentDate = nextWorkday(options.startDate, options.skipWeekends);
  let lastDayNumber: number | null = null;

  for (const dayNumber of sortedDays) {
    if (lastDayNumber !== null) {
      const gap = dayNumber - lastDayNumber;
      for (let i = 0; i < gap; i += 1) {
        currentDate = advanceOneDay(currentDate, options.skipWeekends);
      }
    }
    lastDayNumber = dayNumber;

    const dayBlocks = blocksByDay.get(dayNumber) ?? [];
    const isoDate = toIsoDate(currentDate);
    const slots = buildInitialSlots(options.workSlots);
    const maxMinutes = options.maxHoursPerDay * 60;

    let scheduledMinutes = 0;
    let lastTagId: string | null = null;
    let lastEndMin: number | null = null;
    let inboxFromMaxHours = 0;

    for (const block of dayBlocks) {
      const { durations, paddingAfter } = planChunks(
        block,
        options.splitIntoPomodoros,
      );

      for (let chunkIndex = 0; chunkIndex < durations.length; chunkIndex += 1) {
        const duration = durations[chunkIndex];
        const padding = paddingAfter[chunkIndex];
        const blockTagId = block.tagId ?? options.defaultTagId;

        if (scheduledMinutes + duration > maxMinutes) {
          inbox.push(
            buildScheduledBlock(
              block,
              options,
              false,
              isoDate,
              "00:00",
              chunkIndex,
              durations.length,
              duration,
            ),
          );
          inboxFromMaxHours += duration;
          continue;
        }

        const indices =
          options.placement === "random"
            ? shuffle(slots.map((_, i) => i))
            : slots.map((_, i) => i);

        let placedIndex = -1;

        if (
          options.avoidSameTagInRow &&
          lastTagId !== null &&
          blockTagId === lastTagId &&
          lastEndMin !== null
        ) {
          for (const idx of indices) {
            const slot = slots[idx];
            if (!slot || slot.endMin - slot.startMin < duration) continue;
            if (slot.startMin === lastEndMin) continue;
            placedIndex = idx;
            break;
          }
        }

        if (placedIndex === -1) {
          for (const idx of indices) {
            const slot = slots[idx];
            if (!slot || slot.endMin - slot.startMin < duration) continue;
            placedIndex = idx;
            break;
          }
        }

        if (placedIndex === -1) {
          inbox.push(
            buildScheduledBlock(
              block,
              options,
              false,
              isoDate,
              "00:00",
              chunkIndex,
              durations.length,
              duration,
            ),
          );
          warnings.push(
            `Día ${dayNumber}: no cabe "${block.title}" en las franjas, movido al Inbox`,
          );
          continue;
        }

        const { startMin, endMin } = consumeSlot(
          slots,
          placedIndex,
          duration,
          padding,
        );

        if (
          options.avoidSameTagInRow &&
          blockTagId !== null &&
          blockTagId === lastTagId &&
          startMin === lastEndMin
        ) {
          warnings.push(
            `Día ${dayNumber}: "${block.title}" queda contiguo a otro bloque con la misma etiqueta`,
          );
        }

        scheduled.push(
          buildScheduledBlock(
            block,
            options,
            true,
            isoDate,
            minutesToTime(startMin),
            chunkIndex,
            durations.length,
            duration,
          ),
        );
        scheduledMinutes += duration;
        lastTagId = blockTagId;
        lastEndMin = endMin;
      }
    }

    if (inboxFromMaxHours > 0) {
      const totalHours = (scheduledMinutes + inboxFromMaxHours) / 60;
      const overflowHours = inboxFromMaxHours / 60;
      warnings.push(
        `Día ${dayNumber} tiene ${totalHours.toFixed(1)}h planeadas, ${overflowHours.toFixed(1)}h se han movido al Inbox`,
      );
    }
  }

  return {
    scheduledBlocks: scheduled,
    inboxBlocks: inbox,
    warnings,
  };
}
