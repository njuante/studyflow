import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { motion, useAnimationControls } from "framer-motion";

import { useTags } from "../../hooks/useTags";
import { darkenColor, lightenColor } from "../../lib/colorUtils";
import { getWeekDays, isToday, toIsoDate } from "../../lib/dates";
import { DRAG_CONFIG } from "../../lib/dragConfig";
import { useMotionPresets } from "../../lib/motion";
import type { StudyEvent } from "../../types";
import styles from "./WeekView.module.css";

interface WeekViewProps {
  currentDate: Date;
  events: StudyEvent[];
  activeDragEventId?: string | null;
  onEventClick: (event: StudyEvent) => void;
  onEventResize: (event: StudyEvent, durationMinutes: number) => void;
  onCreateAt: (date: Date, time: string) => void;
}

const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_HEIGHT = 60;
const TOTAL_HOURS = END_HOUR - START_HOUR + 1;
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const NEUTRAL_EVENT_COLOR = "#8e8e93";

function padTimeUnit(value: number): string {
  return `${value}`.padStart(2, "0");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${padTimeUnit(hours)}:${padTimeUnit(remainingMinutes)}`;
}

function formatTimeRange(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const startTotalMinutes = hours * 60 + minutes;
  const endTotalMinutes = startTotalMinutes + durationMinutes;
  const endHours = Math.floor(endTotalMinutes / 60);
  const endMinutes = endTotalMinutes % 60;

  return `${startTime} – ${padTimeUnit(endHours)}:${padTimeUnit(endMinutes)}`;
}

function roundMinutesToHalfHour(minutes: number): number {
  if (minutes < 15) return 0;
  if (minutes < 45) return 30;
  return 60;
}

function snapOffsetMinutes(offsetY: number): number {
  const rawMinutes = offsetY / DRAG_CONFIG.pixelsPerMinute;
  return Math.round(rawMinutes / DRAG_CONFIG.snapMinutes) * DRAG_CONFIG.snapMinutes;
}

export function WeekView({
  activeDragEventId = null,
  currentDate,
  events,
  onCreateAt,
  onEventClick,
  onEventResize,
}: WeekViewProps) {
  const { getTagById } = useTags();
  const [now, setNow] = useState(() => new Date());

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const weekIsoDates = useMemo(() => weekDays.map(toIsoDate), [weekDays]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const visibleEvents = useMemo(() => {
    const indexByIso = new Map(weekIsoDates.map((iso, index) => [iso, index]));
    return events
      .map((event) => {
        const columnIndex = indexByIso.get(event.date);
        if (columnIndex === undefined) return null;
        return { event, columnIndex };
      })
      .filter((entry): entry is { event: StudyEvent; columnIndex: number } =>
        entry !== null,
      );
  }, [events, weekIsoDates]);

  const todayColumn = weekDays.findIndex((day) => isToday(day));
  const showNowIndicator = todayColumn !== -1;
  const nowMinutesFromStart =
    (now.getHours() - START_HOUR) * 60 + now.getMinutes();
  const nowWithinRange =
    nowMinutesFromStart >= 0 && nowMinutesFromStart <= TOTAL_HOURS * 60;

  return (
    <section className={styles.weekView}>
      <div className={styles.dayHeaders}>
        <div className={styles.timeColumnHeader} />
        {weekDays.map((day, index) => (
          <div
            className={`${styles.dayHeader} ${isToday(day) ? styles.dayHeaderToday : ""}`}
            data-today={isToday(day) ? "true" : undefined}
            key={toIsoDate(day)}
          >
            <span className={styles.dayHeaderLabel}>{DAY_NAMES[index]}</span>
            <span className={styles.dayHeaderNumber}>{day.getDate()}</span>
          </div>
        ))}
      </div>

      <div className={styles.gridScroll}>
        <div className={styles.grid}>
          <div className={styles.timeColumn}>
            {Array.from({ length: TOTAL_HOURS }, (_, index) => {
              const hour = START_HOUR + index;
              return (
                <div className={styles.hourLabel} key={hour}>
                  {padTimeUnit(hour)}:00
                </div>
              );
            })}
          </div>

          {weekDays.map((day, index) => (
            <WeekDayColumn
              day={day}
              index={index}
              key={toIsoDate(day)}
              onCreateAt={onCreateAt}
            />
          ))}
        </div>

        <div className={styles.eventsLayer}>
          {weekDays.map((day, columnIndex) => {
            const columnEntries = visibleEvents.filter(
              (entry) => entry.columnIndex === columnIndex,
            );

            return (
              <div className={styles.eventsColumn} key={toIsoDate(day)}>
                {columnEntries.map(({ event }) => (
                  <WeekEventBlock
                    activeDragEventId={activeDragEventId}
                    event={event}
                    getTagById={getTagById}
                    key={event.id}
                    onEventClick={onEventClick}
                    onEventResize={onEventResize}
                  />
                ))}
              </div>
            );
          })}

          {showNowIndicator && nowWithinRange ? (
            <div
              aria-hidden="true"
              className={styles.nowIndicator}
              style={{ top: `${nowMinutesFromStart}px` }}
            >
              <div className={styles.nowLine} />
              <div className={styles.nowDot} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

interface WeekDayColumnProps {
  day: Date;
  index: number;
  onCreateAt: (date: Date, time: string) => void;
}

function WeekDayColumn({ day, index, onCreateAt }: WeekDayColumnProps) {
  const isoDate = toIsoDate(day);
  const columnRef = useRef<HTMLDivElement | null>(null);
  const getTimeFromY = useCallback((clientY: number) => {
    const rect = columnRef.current?.getBoundingClientRect();
    const offsetY = rect ? clientY - rect.top : 0;
    const snappedOffset = snapOffsetMinutes(
      clamp(offsetY, 0, TOTAL_HOURS * HOUR_HEIGHT - 1),
    );
    const totalMinutes = clamp(
      START_HOUR * 60 + snappedOffset,
      0,
      23 * 60 + 45,
    );
    return minutesToTime(totalMinutes);
  }, []);
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${index}-${isoDate}`,
    data: { type: "day-slot", date: isoDate, getTimeFromY },
  });
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      columnRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef],
  );

  function handleColumnClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = Math.max(0, event.clientY - rect.top);
    const totalMinutes = Math.min(
      TOTAL_HOURS * HOUR_HEIGHT - 1,
      Math.floor(offsetY),
    );
    const hourOffset = Math.floor(totalMinutes / HOUR_HEIGHT);
    const minuteInHour = totalMinutes % HOUR_HEIGHT;
    const roundedMinutes = roundMinutesToHalfHour(minuteInHour);
    const hour = START_HOUR + hourOffset + (roundedMinutes === 60 ? 1 : 0);
    const minutes = roundedMinutes === 60 ? 0 : roundedMinutes;
    const time = `${padTimeUnit(hour)}:${padTimeUnit(minutes)}`;
    onCreateAt(day, time);
  }

  return (
    <div
      className={`${styles.dayColumn} ${isToday(day) ? styles.dayColumnToday : ""} ${
        isOver ? styles.dayColumnOver : ""
      }`}
      data-day-index={index}
      data-iso={isoDate}
      onClick={handleColumnClick}
      ref={setRefs}
    >
      {Array.from({ length: TOTAL_HOURS }, (_, hourIndex) => (
        <div
          className={styles.hourLine}
          key={`hour-line-${hourIndex}`}
          style={{ top: `${hourIndex * HOUR_HEIGHT}px` }}
        />
      ))}
      {Array.from({ length: TOTAL_HOURS }, (_, hourIndex) => (
        <div
          className={styles.halfHourLine}
          key={`half-hour-line-${hourIndex}`}
          style={{
            top: `${hourIndex * HOUR_HEIGHT + HOUR_HEIGHT / 2}px`,
          }}
        />
      ))}
    </div>
  );
}

interface WeekEventBlockProps {
  activeDragEventId: string | null;
  event: StudyEvent;
  getTagById: ReturnType<typeof useTags>["getTagById"];
  onEventClick: (event: StudyEvent) => void;
  onEventResize: (event: StudyEvent, durationMinutes: number) => void;
}

function WeekEventBlock({
  activeDragEventId,
  event,
  getTagById,
  onEventClick,
  onEventResize,
}: WeekEventBlockProps) {
  const [localDuration, setLocalDuration] = useState(event.durationMinutes);
  const [isResizing, setIsResizing] = useState(false);
  const localDurationRef = useRef(event.durationMinutes);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickUntilRef = useRef(0);
  const previousPositionRef = useRef({ date: event.date, startTime: event.startTime });
  const bounceControls = useAnimationControls();
  const { springs, reduced } = useMotionPresets();
  const tag = getTagById(event.tagId);
  const isUntagged = event.tagId === null || !tag;
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useDraggable({
      id: `event-${event.id}`,
      data: { type: "move-event", event },
      disabled: isResizing,
    });

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
  const [startHour, startMinutes] = event.startTime.split(":").map(Number);
  const top = (startHour - START_HOUR) * HOUR_HEIGHT + startMinutes;
  const height = Math.max(20, localDuration);
  const isDimmed = Boolean(activeDragEventId && activeDragEventId !== event.id);
  const dragX = transform?.x ?? 0;
  const dragY = transform?.y ?? 0;
  const dragOpacity = transform ? 0.85 : 1;
  const dragZIndex = transform ? 100 : undefined;

  useEffect(() => {
    setLocalDuration(event.durationMinutes);
    localDurationRef.current = event.durationMinutes;
  }, [event.durationMinutes]);

  function handleResizeStart(eventPointer: React.PointerEvent<HTMLDivElement>) {
    eventPointer.preventDefault();
    eventPointer.stopPropagation();

    const startY = eventPointer.clientY;
    const startDuration = localDurationRef.current;
    setIsResizing(true);

    function onMove(pointerEvent: PointerEvent) {
      pointerEvent.preventDefault();
      const deltaMinutes =
        (pointerEvent.clientY - startY) / DRAG_CONFIG.pixelsPerMinute;
      const snappedDelta =
        Math.round(deltaMinutes / DRAG_CONFIG.snapMinutes) *
        DRAG_CONFIG.snapMinutes;
      const nextDuration = clamp(
        startDuration + snappedDelta,
        DRAG_CONFIG.minDurationMinutes,
        DRAG_CONFIG.maxDurationMinutes,
      );

      localDurationRef.current = nextDuration;
      setLocalDuration(nextDuration);
    }

    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      setIsResizing(false);
      suppressClickUntilRef.current = Date.now() + 250;

      if (localDurationRef.current !== startDuration) {
        onEventResize(event, localDurationRef.current);
      }
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  function handleEventActivation() {
    onEventClick(event);
  }

  return (
    <motion.div
      animate={bounceControls}
      initial={false}
      className={`${styles.eventBlock} ${isUntagged ? styles.untaggedEvent : ""} ${
        isDragging ? styles.eventBlockDragging : ""
      } ${isDimmed ? styles.eventBlockDimmed : ""}`}
      onClick={(clickEvent) => {
        const start = pointerStartRef.current;
        if (Date.now() < suppressClickUntilRef.current || isResizing) {
          clickEvent.stopPropagation();
          return;
        }

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
        handleEventActivation();
      }}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
          keyboardEvent.preventDefault();
          handleEventActivation();
        }
      }}
      onPointerDownCapture={(pointerEvent) => {
        pointerStartRef.current = {
          x: pointerEvent.clientX,
          y: pointerEvent.clientY,
        };
      }}
      ref={setNodeRef}
      style={{
        ["--event-color" as string]: tag?.color ?? NEUTRAL_EVENT_COLOR,
        ["--event-color-light" as string]: lightenColor(
          tag?.color ?? NEUTRAL_EVENT_COLOR,
          0.15,
        ),
        ["--event-color-dark" as string]: darkenColor(
          tag?.color ?? NEUTRAL_EVENT_COLOR,
          0.15,
        ),
        top: `${top}px`,
        height: `${height}px`,
        x: dragX,
        y: dragY,
        opacity: dragOpacity,
        zIndex: dragZIndex,
      }}
      title={tag ? tag.name : "Sin etiqueta"}
      {...listeners}
      {...attributes}
    >
      <span className={styles.eventTitle}>{event.title}</span>
      {localDuration > 35 ? (
        <span className={styles.eventTime}>
          {formatTimeRange(event.startTime, localDuration)}
        </span>
      ) : null}
      <div
        className={styles.resizeHandle}
        onClick={(clickEvent) => {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();
        }}
        onPointerDown={handleResizeStart}
        style={{ height: DRAG_CONFIG.resizeHandleHeight }}
      />
    </motion.div>
  );
}
