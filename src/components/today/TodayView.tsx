import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Sun } from "lucide-react";

import { useTags } from "../../hooks/useTags";
import { completeEvent, getTodayEvents } from "../../lib/api";
import type { StudyEvent } from "../../types";
import styles from "./TodayView.module.css";

interface TodayViewProps {
  refreshKey: number;
  onCompletedChange?: () => void;
}

const NEUTRAL_EVENT_COLOR = "#8e8e93";

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTodayHeading(date: Date): string {
  return capitalize(
    new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "long",
      weekday: "long",
    }).format(date),
  );
}

function formatStudyDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function formatEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;

  return `${`${endHours}`.padStart(2, "0")}:${`${endMinutes}`.padStart(2, "0")}`;
}

export function TodayView({ refreshKey, onCompletedChange }: TodayViewProps) {
  const { getTagById } = useTags();
  const [events, setEvents] = useState<StudyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);

    getTodayEvents()
      .then((todayEvents) => {
        if (!cancelled) {
          setEvents(
            [...todayEvents].sort((left, right) =>
              left.startTime.localeCompare(right.startTime),
            ),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEvents([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const totalMinutes = useMemo(
    () => events.reduce((sum, event) => sum + event.durationMinutes, 0),
    [events],
  );

  async function toggleCompleted(id: string) {
    try {
      const updated = await completeEvent(id);
      setEvents((current) =>
        current.map((event) => (event.id === id ? updated : event)),
      );
      onCompletedChange?.();
    } catch {
      /* swallow - UI stays consistent on next refresh */
    }
  }

  if (!isLoading && events.length === 0) {
    return (
      <section className={styles.emptyState}>
        <Sun className={styles.emptyIcon} size={40} strokeWidth={1.75} />
        <h2 className={styles.emptyTitle}>Día libre</h2>
        <p className={styles.emptyText}>Añade un bloque o importa un planning</p>
      </section>
    );
  }

  return (
    <section className={styles.todayView}>
      <header className={styles.header}>
        <h1 className={styles.title}>{formatTodayHeading(new Date())}</h1>
        <p className={styles.subtitle}>
          {events.length} bloques · {formatStudyDuration(totalMinutes)} de estudio
        </p>
      </header>

      {isLoading ? (
        <div className={styles.loading}>Cargando agenda de hoy...</div>
      ) : (
        <div className={styles.timeline}>
          {events.map((event) => {
            const isCompleted = event.completed;
            const tag = getTagById(event.tagId);
            const isUntagged = event.tagId === null || !tag;

            return (
              <article
                className={`${styles.eventCard} ${
                  isUntagged ? styles.untaggedEvent : ""
                } ${isCompleted ? styles.completed : ""}`}
                key={event.id}
                style={
                  {
                    "--event-color": isCompleted
                      ? "var(--tag-green)"
                      : tag?.color ?? NEUTRAL_EVENT_COLOR,
                  } as CSSProperties
                }
              >
                <div className={styles.timeColumn}>
                  <span className={styles.startTime}>{event.startTime}</span>
                  <span className={styles.endTime}>
                    {formatEndTime(event.startTime, event.durationMinutes)}
                  </span>
                </div>

                <div className={styles.content}>
                  <h2 className={styles.eventTitle}>{event.title}</h2>
                  {event.description ? (
                    <p className={styles.description}>{event.description}</p>
                  ) : null}
                  <div className={styles.tags}>
                    <span className={styles.projectTag}>
                      {tag?.name ?? "Sin etiqueta"}
                    </span>
                  </div>
                </div>

                <div className={styles.actions}>
                  <label className={styles.checkboxLabel}>
                    <input
                      checked={isCompleted}
                      onChange={() => void toggleCompleted(event.id)}
                      type="checkbox"
                    />
                    <span>Hecho</span>
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
