import type { CSSProperties } from "react";

import { useTags } from "../../hooks/useTags";
import { getMonthGrid, isSameMonth, isToday, toIsoDate } from "../../lib/dates";
import type { StudyEvent } from "../../types";
import styles from "./MonthView.module.css";

interface MonthViewProps {
  currentDate: Date;
  events: StudyEvent[];
  onEventClick: (event: StudyEvent) => void;
  onDayClick: (date: Date) => void;
  onCreateOnDay: (date: Date) => void;
}

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const NEUTRAL_EVENT_COLOR = "#8e8e93";

export function MonthView({
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
        {monthGrid.map((date) => {
          const isoDate = toIsoDate(date);
          const dayEvents = eventsByDate.get(isoDate) ?? [];
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
              className={`${styles.dayCell} ${isCurrentMonth ? "" : styles.outsideMonth}`}
              key={isoDate}
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
                  const isUntagged = event.tagId === null || !tag;

                  return (
                    <button
                      className={`${styles.eventPill} ${
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
                        } as CSSProperties
                      }
                      title={tag ? tag.name : "Sin etiqueta"}
                      type="button"
                    >
                      {event.title}
                    </button>
                  );
                })}

                {dayEvents.length > 3 ? (
                  <span className={styles.moreEvents}>+{dayEvents.length - 3} mas</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
