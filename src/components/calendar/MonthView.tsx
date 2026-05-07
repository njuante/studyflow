import { useEffect, useRef } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { motion, useAnimationControls } from "framer-motion";

import { useTags } from "../../hooks/useTags";
import { getMonthGrid, isSameMonth, isToday, toIsoDate } from "../../lib/dates";
import { DRAG_CONFIG } from "../../lib/dragConfig";
import { useMotionPresets } from "../../lib/motion";
import type { StudyEvent } from "../../types";
import styles from "./MonthView.module.css";

interface MonthViewProps {
  currentDate: Date;
  events: StudyEvent[];
  activeDragEventId?: string | null;
  onEventClick: (event: StudyEvent) => void;
  onDayClick: (date: Date) => void;
  onCreateOnDay: (date: Date) => void;
}

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const NEUTRAL_EVENT_COLOR = "#8e8e93";

export function MonthView({
  activeDragEventId = null,
  currentDate,
  events,
  onCreateOnDay,
  onDayClick,
  onEventClick,
}: MonthViewProps) {
  const { getTagById } = useTags();
  const monthGrid = getMonthGrid(currentDate);
  const eventsByDate = new Map<string, StudyEvent[]>();

  for (const event of events) {
    const existingEvents = eventsByDate.get(event.date);
    if (existingEvents) {
      existingEvents.push(event);
    } else {
      eventsByDate.set(event.date, [event]);
    }
  }

  for (const [, dateEvents] of eventsByDate) {
    dateEvents.sort((left, right) => left.startTime.localeCompare(right.startTime));
  }

  return (
    <section className={styles.monthView}>
      <div className={styles.weekdays}>
        {WEEKDAYS.map((weekday) => (
          <div className={styles.weekday} key={weekday}>
            {weekday}
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        {monthGrid.map((date) => (
          <MonthDayCell
            activeDragEventId={activeDragEventId}
            currentDate={currentDate}
            date={date}
            dayEvents={eventsByDate.get(toIsoDate(date)) ?? []}
            getTagById={getTagById}
            key={toIsoDate(date)}
            onCreateOnDay={onCreateOnDay}
            onDayClick={onDayClick}
            onEventClick={onEventClick}
          />
        ))}
      </div>
    </section>
  );
}

interface MonthDayCellProps {
  activeDragEventId: string | null;
  currentDate: Date;
  date: Date;
  dayEvents: StudyEvent[];
  getTagById: ReturnType<typeof useTags>["getTagById"];
  onCreateOnDay: (date: Date) => void;
  onDayClick: (date: Date) => void;
  onEventClick: (event: StudyEvent) => void;
}

function MonthDayCell({
  activeDragEventId,
  currentDate,
  date,
  dayEvents,
  getTagById,
  onCreateOnDay,
  onDayClick,
  onEventClick,
}: MonthDayCellProps) {
  const isoDate = toIsoDate(date);
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${isoDate}`,
    data: { type: "month-day", date: isoDate },
  });
  const isCurrentMonth = isSameMonth(date, currentDate);
  const dayIsToday = isToday(date);

  function handleCellClick() {
    if (dayEvents.length === 0) {
      onCreateOnDay(date);
      return;
    }

    onDayClick(date);
  }

  return (
    <div
      className={`${styles.dayCell} ${isCurrentMonth ? "" : styles.outsideMonth} ${
        isOver ? styles.dayCellOver : ""
      }`}
      ref={setNodeRef}
      onClick={handleCellClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleCellClick();
        }
      }}
    >
      <div className={styles.dayHeader}>
        {dayIsToday ? (
          <span className={styles.todayBadge}>{date.getDate()}</span>
        ) : (
          <span className={styles.dayNumber}>{date.getDate()}</span>
        )}
      </div>

      <div className={styles.events}>
        {dayEvents.slice(0, 3).map((event) => {
          const tag = getTagById(event.tagId);
          return (
            <MonthEventPill
              activeDragEventId={activeDragEventId}
              color={tag?.color ?? NEUTRAL_EVENT_COLOR}
              event={event}
              isUntagged={event.tagId === null || !tag}
              key={event.id}
              onEventClick={onEventClick}
              title={tag ? tag.name : "Sin etiqueta"}
            />
          );
        })}

        {dayEvents.length > 3 ? (
          <span className={styles.moreEvents}>+{dayEvents.length - 3} mas</span>
        ) : null}
      </div>
    </div>
  );
}

interface MonthEventPillProps {
  activeDragEventId: string | null;
  color: string;
  event: StudyEvent;
  isUntagged: boolean;
  onEventClick: (event: StudyEvent) => void;
  title: string;
}

function MonthEventPill({
  activeDragEventId,
  color,
  event,
  isUntagged,
  onEventClick,
  title,
}: MonthEventPillProps) {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const previousPositionRef = useRef({ date: event.date, startTime: event.startTime });
  const bounceControls = useAnimationControls();
  const { springs, reduced } = useMotionPresets();
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useDraggable({
      id: `event-${event.id}`,
      data: { type: "move-event", event },
    });
  const isDimmed = Boolean(activeDragEventId && activeDragEventId !== event.id);
  const dragX = transform?.x ?? 0;
  const dragY = transform?.y ?? 0;
  const dragOpacity = transform ? 0.85 : 1;
  const dragZIndex = transform ? 100 : undefined;

  useEffect(() => {
    const previous = previousPositionRef.current;
    if (previous.date === event.date && previous.startTime === event.startTime) {
      return;
    }
    previousPositionRef.current = { date: event.date, startTime: event.startTime };
    if (reduced) return;
    void bounceControls.start({
      scale: [1, 1.03, 1],
      transition: { ...springs.drop, duration: 0.4, times: [0, 0.5, 1] },
    });
  }, [event.date, event.startTime, bounceControls, springs.drop, reduced]);

  return (
    <motion.button
      animate={bounceControls}
      initial={false}
      className={`${styles.eventPill} ${isUntagged ? styles.untaggedEvent : ""} ${
        isDragging ? styles.eventPillDragging : ""
      } ${isDimmed ? styles.eventPillDimmed : ""}`}
      onClick={(clickEvent) => {
        const start = pointerStartRef.current;
        if (start) {
          const distance = Math.hypot(
            clickEvent.clientX - start.x,
            clickEvent.clientY - start.y,
          );
          if (distance > DRAG_CONFIG.activationDistance) {
            clickEvent.stopPropagation();
            return;
          }
        }

        clickEvent.stopPropagation();
        onEventClick(event);
      }}
      onPointerDownCapture={(pointerEvent) => {
        pointerStartRef.current = {
          x: pointerEvent.clientX,
          y: pointerEvent.clientY,
        };
      }}
      ref={setNodeRef}
      style={{
        ["--event-color" as string]: color,
        x: dragX,
        y: dragY,
        opacity: dragOpacity,
        zIndex: dragZIndex,
      }}
      title={title}
      type="button"
      {...listeners}
      {...attributes}
    >
      {event.title}
    </motion.button>
  );
}
