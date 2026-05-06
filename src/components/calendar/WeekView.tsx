import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { useTags } from "../../hooks/useTags";
import { getWeekDays, isToday, toIsoDate } from "../../lib/dates";
import type { StudyEvent } from "../../types";
import styles from "./WeekView.module.css";

interface WeekViewProps {
  currentDate: Date;
  events: StudyEvent[];
  onEventClick: (event: StudyEvent) => void;
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

export function WeekView({
  currentDate,
  events,
  onCreateAt,
  onEventClick,
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

          {weekDays.map((day, index) => {
            const isoDate = toIsoDate(day);
            return (
              <div
                className={`${styles.dayColumn} ${isToday(day) ? styles.dayColumnToday : ""}`}
                data-day-index={index}
                data-iso={isoDate}
                key={isoDate}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const offsetY = Math.max(0, event.clientY - rect.top);
                  const totalMinutes = Math.min(
                    TOTAL_HOURS * HOUR_HEIGHT - 1,
                    Math.floor(offsetY),
                  );
                  const hourOffset = Math.floor(totalMinutes / HOUR_HEIGHT);
                  const minuteInHour = totalMinutes % HOUR_HEIGHT;
                  const roundedMinutes = roundMinutesToHalfHour(minuteInHour);
                  const hour =
                    START_HOUR + hourOffset + (roundedMinutes === 60 ? 1 : 0);
                  const minutes = roundedMinutes === 60 ? 0 : roundedMinutes;
                  const time = `${padTimeUnit(hour)}:${padTimeUnit(minutes)}`;
                  onCreateAt(day, time);
                }}
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
          })}
        </div>

        <div className={styles.eventsLayer}>
          {weekDays.map((day, columnIndex) => {
            const columnEntries = visibleEvents.filter(
              (entry) => entry.columnIndex === columnIndex,
            );

            return (
              <div className={styles.eventsColumn} key={toIsoDate(day)}>
                {columnEntries.map(({ event }) => {
                  const tag = getTagById(event.tagId);
                  const isUntagged = event.tagId === null || !tag;
                  const [startHour, startMinutes] = event.startTime
                    .split(":")
                    .map(Number);
                  const top =
                    (startHour - START_HOUR) * HOUR_HEIGHT + startMinutes;
                  const height = Math.max(20, event.durationMinutes);

                  return (
                    <button
                      className={`${styles.eventBlock} ${
                        isUntagged ? styles.untaggedEvent : ""
                      }`}
                      key={event.id}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onEventClick(event);
                      }}
                      style={
                        {
                          "--event-color": tag?.color ?? NEUTRAL_EVENT_COLOR,
                          top: `${top}px`,
                          height: `${height}px`,
                        } as CSSProperties
                      }
                      title={tag ? tag.name : "Sin etiqueta"}
                      type="button"
                    >
                      <span className={styles.eventTitle}>{event.title}</span>
                      {event.durationMinutes > 35 ? (
                        <span className={styles.eventTime}>
                          {formatTimeRange(
                            event.startTime,
                            event.durationMinutes,
                          )}
                        </span>
                      ) : null}
                    </button>
                  );
                })}

                {showNowIndicator &&
                nowWithinRange &&
                columnIndex === todayColumn ? (
                  <span
                    aria-hidden="true"
                    className={styles.nowLine}
                    style={{ top: `${nowMinutesFromStart}px` }}
                  />
                ) : null}
              </div>
            );
          })}

          {showNowIndicator && nowWithinRange ? (
            <div
              className={styles.nowDotRail}
              style={{ top: `${nowMinutesFromStart}px` }}
              aria-hidden="true"
            >
              <span className={styles.nowDot} />
            </div>
          ) : null}
        </div>
      </div>

    </section>
  );
}
