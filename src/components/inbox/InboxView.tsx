import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  Calendar as CalendarIcon,
  Inbox as InboxIcon,
  MoreHorizontal,
  Sparkles,
  X,
} from "lucide-react";

import { useTags } from "../../hooks/useTags";
import {
  deleteEvent,
  createEvent,
  getEventsInRange,
  getInboxEvents,
  scheduleEvent,
} from "../../lib/api";
import { toIsoDate } from "../../lib/dates";
import type { StudyEvent } from "../../types";
import styles from "./InboxView.module.css";

interface InboxViewProps {
  refreshKey: number;
  onChanged: () => void;
  onShowToast: (message: string, kind: "success" | "info" | "error") => void;
  onEditEvent: (event: StudyEvent) => void;
}

const NEUTRAL_EVENT_COLOR = "#8e8e93";
const PRIORITY_LABEL: Record<StudyEvent["priority"], string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

function formatTotalHours(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}min`;
  const hours = totalMinutes / 60;
  return Number.isInteger(hours)
    ? `${hours}h total`
    : `${hours.toFixed(1)}h total`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${`${h}`.padStart(2, "0")}:${`${m}`.padStart(2, "0")}`;
}

const DAY_START_MIN = 9 * 60;
const DAY_END_MIN = 21 * 60;

interface Slot {
  date: string;
  startTime: string;
}

function findNextSlot(
  durationMinutes: number,
  occupiedByDate: Map<string, Array<{ start: number; end: number }>>,
  startFrom: Date,
): Slot {
  let cursor = new Date(startFrom);

  for (let dayOffset = 0; dayOffset < 90; dayOffset += 1) {
    const day = addDays(cursor, dayOffset);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;

    const isoDate = toIsoDate(day);
    const occupied = (occupiedByDate.get(isoDate) ?? [])
      .slice()
      .sort((a, b) => a.start - b.start);

    let candidate = DAY_START_MIN;
    for (const slot of occupied) {
      if (candidate + durationMinutes <= slot.start) {
        return { date: isoDate, startTime: minutesToTime(candidate) };
      }
      candidate = Math.max(candidate, slot.end);
    }

    if (candidate + durationMinutes <= DAY_END_MIN) {
      return { date: isoDate, startTime: minutesToTime(candidate) };
    }
  }

  return { date: toIsoDate(addDays(startFrom, 1)), startTime: "09:00" };
}

export function InboxView({
  refreshKey,
  onChanged,
  onShowToast,
  onEditEvent,
}: InboxViewProps) {
  const { getTagById } = useTags();
  const [events, setEvents] = useState<StudyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pickerOpenId, setPickerOpenId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [autoplanning, setAutoplanning] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const inbox = await getInboxEvents();
      setEvents(inbox);
    } catch {
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const totalMinutes = useMemo(
    () => events.reduce((sum, event) => sum + event.durationMinutes, 0),
    [events],
  );

  async function handleSchedule(id: string, date: string, startTime: string) {
    try {
      await scheduleEvent(id, date, startTime);
      setPickerOpenId(null);
      setEvents((current) => current.filter((event) => event.id !== id));
      onShowToast("Bloque programado en el calendario", "success");
      onChanged();
    } catch {
      onShowToast("No se pudo programar el bloque", "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteEvent(id);
      setMenuOpenId(null);
      setEvents((current) => current.filter((event) => event.id !== id));
      onShowToast("Bloque eliminado", "info");
      onChanged();
    } catch {
      onShowToast("No se pudo eliminar el bloque", "error");
    }
  }

  async function handleDuplicate(event: StudyEvent) {
    setMenuOpenId(null);
    const now = new Date().toISOString();
    const copy: StudyEvent = {
      ...event,
      id: crypto.randomUUID(),
      title: `${event.title} (copia)`,
      createdAt: now,
      updatedAt: now,
      scheduled: false,
      completed: false,
      completedAt: null,
    };
    try {
      const created = await createEvent(copy);
      setEvents((current) => [created, ...current]);
      onShowToast("Bloque duplicado", "success");
      onChanged();
    } catch {
      onShowToast("No se pudo duplicar el bloque", "error");
    }
  }

  async function handleAutoplan() {
    if (events.length === 0 || autoplanning) return;
    setAutoplanning(true);

    try {
      const today = new Date();
      const start = addDays(today, 1);
      const horizonEnd = addDays(today, 90);
      const scheduledEvents = await getEventsInRange(
        toIsoDate(today),
        toIsoDate(horizonEnd),
      );

      const occupied = new Map<string, Array<{ start: number; end: number }>>();
      for (const event of scheduledEvents) {
        const existing = occupied.get(event.date) ?? [];
        const startMin = timeToMinutes(event.startTime);
        existing.push({ start: startMin, end: startMin + event.durationMinutes });
        occupied.set(event.date, existing);
      }

      const ranking: Record<StudyEvent["priority"], number> = {
        high: 0,
        medium: 1,
        low: 2,
      };
      const ordered = [...events].sort((a, b) => {
        const priorityDelta = ranking[a.priority] - ranking[b.priority];
        if (priorityDelta !== 0) return priorityDelta;
        return b.durationMinutes - a.durationMinutes;
      });

      let scheduled = 0;
      for (const event of ordered) {
        const slot = findNextSlot(event.durationMinutes, occupied, start);
        try {
          await scheduleEvent(event.id, slot.date, slot.startTime);
          const list = occupied.get(slot.date) ?? [];
          const slotStart = timeToMinutes(slot.startTime);
          list.push({
            start: slotStart,
            end: slotStart + event.durationMinutes,
          });
          occupied.set(slot.date, list);
          scheduled += 1;
        } catch {
          /* skip on failure */
        }
      }

      onShowToast(`${scheduled} bloques programados`, "success");
      await reload();
      onChanged();
    } finally {
      setAutoplanning(false);
    }
  }

  if (!isLoading && events.length === 0) {
    return (
      <section className={styles.inbox}>
        <header className={styles.header}>
          <h1 className={styles.title}>Inbox</h1>
          <p className={styles.subtitle}>0 bloques pendientes de organizar</p>
        </header>
        <div className={styles.emptyState}>
          <InboxIcon className={styles.emptyIcon} size={48} strokeWidth={1.5} />
          <h2 className={styles.emptyTitle}>Bandeja vacía</h2>
          <p className={styles.emptyText}>
            Todos los bloques están programados
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.inbox}>
      <header className={styles.header}>
        <h1 className={styles.title}>Inbox</h1>
        <p className={styles.subtitle}>
          {events.length} bloques pendientes de organizar ·{" "}
          {formatTotalHours(totalMinutes)}
        </p>
      </header>

      {events.length > 0 ? (
        <div className={styles.banner}>
          <div className={styles.bannerText}>
            <strong>Tienes días pendientes de organizar</strong>
            <span>
              Arrastra los bloques al calendario o usa autoplanificar
            </span>
          </div>
          <button
            className={styles.autoplanButton}
            disabled={autoplanning}
            onClick={handleAutoplan}
            type="button"
          >
            <Sparkles size={14} strokeWidth={1.75} />
            {autoplanning ? "Programando..." : "Autoplanificar todo"}
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className={styles.loading}>Cargando bandeja...</div>
      ) : (
        <div className={styles.list}>
          {events.map((event) => {
            const tag = getTagById(event.tagId);
            const color = tag?.color ?? NEUTRAL_EVENT_COLOR;

            return (
              <article
                className={styles.card}
                draggable
                key={event.id}
                onDragStart={(dragEvent) => {
                  dragEvent.dataTransfer.setData(
                    "application/x-studyflow-inbox-event",
                    event.id,
                  );
                  dragEvent.dataTransfer.effectAllowed = "move";
                }}
                style={
                  {
                    "--event-color": color,
                  } as CSSProperties
                }
              >
                <div className={styles.cardBody}>
                  <h2 className={styles.cardTitle}>{event.title}</h2>
                  {event.description ? (
                    <p className={styles.cardDescription}>{event.description}</p>
                  ) : null}
                  <div className={styles.metaRow}>
                    <span className={styles.metaChip}>
                      {formatDuration(event.durationMinutes)}
                    </span>
                    <span
                      className={`${styles.metaChip} ${styles[`priority_${event.priority}`]}`}
                    >
                      {PRIORITY_LABEL[event.priority]}
                    </span>
                    <span
                      className={styles.tagChip}
                      style={{
                        backgroundColor: `${color}24`,
                        color,
                      }}
                    >
                      {tag?.name ?? "Sin etiqueta"}
                    </span>
                  </div>
                </div>

                <div className={styles.cardActions}>
                  <button
                    className={styles.scheduleButton}
                    onClick={() =>
                      setPickerOpenId(pickerOpenId === event.id ? null : event.id)
                    }
                    type="button"
                  >
                    <CalendarIcon size={13} strokeWidth={1.75} />
                    Programar
                  </button>

                  <div className={styles.menuWrap}>
                    <button
                      aria-label="Más acciones"
                      className={styles.menuButton}
                      onClick={() =>
                        setMenuOpenId(menuOpenId === event.id ? null : event.id)
                      }
                      type="button"
                    >
                      <MoreHorizontal size={14} strokeWidth={1.75} />
                    </button>
                    {menuOpenId === event.id ? (
                      <div className={styles.menu}>
                        <button
                          onClick={() => {
                            setMenuOpenId(null);
                            onEditEvent(event);
                          }}
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDuplicate(event)}
                          type="button"
                        >
                          Duplicar
                        </button>
                        <button
                          data-danger="true"
                          onClick={() => handleDelete(event.id)}
                          type="button"
                        >
                          Eliminar
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {pickerOpenId === event.id ? (
                  <SchedulePicker
                    onCancel={() => setPickerOpenId(null)}
                    onSubmit={(date, startTime) =>
                      handleSchedule(event.id, date, startTime)
                    }
                  />
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface SchedulePickerProps {
  onCancel: () => void;
  onSubmit: (date: string, startTime: string) => void;
}

function SchedulePicker({ onCancel, onSubmit }: SchedulePickerProps) {
  const tomorrow = addDays(new Date(), 1);
  const [date, setDate] = useState(toIsoDate(tomorrow));
  const [startTime, setStartTime] = useState("09:00");

  return (
    <div className={styles.picker}>
      <div className={styles.pickerFields}>
        <label className={styles.pickerField}>
          <span>Fecha</span>
          <input
            onChange={(event) => setDate(event.target.value)}
            type="date"
            value={date}
          />
        </label>
        <label className={styles.pickerField}>
          <span>Hora</span>
          <input
            onChange={(event) => setStartTime(event.target.value)}
            type="time"
            value={startTime}
          />
        </label>
      </div>
      <div className={styles.pickerActions}>
        <button
          aria-label="Cancelar"
          className={styles.pickerCancel}
          onClick={onCancel}
          type="button"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
        <button
          className={styles.pickerConfirm}
          disabled={!date || !startTime}
          onClick={() => onSubmit(date, startTime)}
          type="button"
        >
          Programar
        </button>
      </div>
    </div>
  );
}
