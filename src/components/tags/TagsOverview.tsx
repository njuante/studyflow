import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CheckCircle2, MoreHorizontal, Plus, Tags as TagsIcon } from "lucide-react";

import { useTags } from "../../hooks/useTags";
import { getEventsByTag } from "../../lib/api";
import type { StudyEvent, Tag } from "../../types";
import { EventTagMenu } from "./EventTagMenu";
import styles from "./TagsOverview.module.css";

interface TagsOverviewProps {
  refreshKey: number;
  onCreateEventWithTag: (tagId: string) => void;
  onEventClick: (event: StudyEvent) => void;
  onFilterTag: (tagId: string) => void;
  onOpenTag: (tagId: string) => void;
  onShowToast: (message: string, kind: "success" | "info" | "error") => void;
}

type RangeOption = "week" | "month" | "quarter" | "all";

const RANGE_LABELS: Record<RangeOption, string> = {
  week: "Proxima semana",
  month: "Proximo mes",
  quarter: "Proximos 3 meses",
  all: "Todo",
};

const TYPE_LABELS: Record<StudyEvent["type"], string> = {
  theory: "Teoria",
  practice: "Practica",
  review: "Repaso",
  exam: "Examen",
};

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(date.getMonth() + months);
  return next;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

function formatEventDate(event: StudyEvent): string {
  if (!event.scheduled) return "Inbox";
  const [year, month, day] = event.date.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dayLabel = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    weekday: "short",
  }).format(date);
  return `${dayLabel} - ${event.startTime}`;
}

function sortEvents(left: StudyEvent, right: StudyEvent): number {
  if (left.scheduled !== right.scheduled) return left.scheduled ? -1 : 1;
  return (
    left.date.localeCompare(right.date) ||
    left.startTime.localeCompare(right.startTime)
  );
}

export function TagsOverview({
  refreshKey,
  onCreateEventWithTag,
  onEventClick,
  onFilterTag,
  onOpenTag,
  onShowToast,
}: TagsOverviewProps) {
  const { createTag, deleteTag, tags, updateTag } = useTags();
  const [eventsByTag, setEventsByTag] = useState<Record<string, StudyEvent[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const [includeInbox, setIncludeInbox] = useState(false);
  const [range, setRange] = useState<RangeOption>("month");
  const [menuTagId, setMenuTagId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      const entries = await Promise.all(
        tags.map(async (tag) => {
          const events = await getEventsByTag(tag.id, {
            upcomingOnly,
            includeInbox,
            limit: 500,
            offset: 0,
          }).catch(() => []);
          return [tag.id, events] as const;
        }),
      );

      if (!cancelled) {
        setEventsByTag(Object.fromEntries(entries));
        setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [includeInbox, refreshKey, tags, upcomingOnly]);

  const todayIso = toIsoDate(new Date());
  const rangeEnd = useMemo(() => {
    const today = new Date();
    if (range === "week") return toIsoDate(addDays(today, 7));
    if (range === "month") return toIsoDate(addMonths(today, 1));
    if (range === "quarter") return toIsoDate(addMonths(today, 3));
    return null;
  }, [range]);

  const filteredByTag = useMemo(() => {
    const next: Record<string, StudyEvent[]> = {};
    for (const tag of tags) {
      next[tag.id] = (eventsByTag[tag.id] ?? [])
        .filter((event) => {
          if (!includeInbox && !event.scheduled) return false;
          if (upcomingOnly && event.scheduled && event.date < todayIso) return false;
          if (rangeEnd && event.scheduled && event.date > rangeEnd) return false;
          return true;
        })
        .sort(sortEvents);
    }
    return next;
  }, [eventsByTag, includeInbox, rangeEnd, tags, todayIso, upcomingOnly]);

  const totalEvents = Object.values(filteredByTag).reduce(
    (sum, events) => sum + events.length,
    0,
  );

  async function createNewTag() {
    const name = window.prompt("Nombre de la etiqueta");
    if (!name?.trim()) return;
    try {
      await createTag(name.trim(), "#378ADD");
      onShowToast("Etiqueta creada", "success");
    } catch {
      onShowToast("No se pudo crear la etiqueta", "error");
    }
  }

  async function renameTag(tag: Tag) {
    const name = window.prompt("Nuevo nombre", tag.name);
    if (!name?.trim() || name.trim() === tag.name) return;
    try {
      await updateTag(tag.id, name.trim(), tag.color, tag.icon);
      onShowToast("Etiqueta actualizada", "success");
    } catch {
      onShowToast("No se pudo actualizar la etiqueta", "error");
    }
  }

  async function removeTag(tag: Tag) {
    if (!window.confirm(`Eliminar "${tag.name}"? Los eventos quedaran sin etiqueta.`)) {
      return;
    }
    try {
      await deleteTag(tag.id);
      onShowToast("Etiqueta eliminada", "info");
    } catch {
      onShowToast("No se pudo eliminar la etiqueta", "error");
    }
  }

  function handleEventChanged(updated: StudyEvent) {
    setEventsByTag((current) => {
      const next: Record<string, StudyEvent[]> = {};
      for (const [tagId, events] of Object.entries(current)) {
        next[tagId] = events.filter((event) => event.id !== updated.id);
      }
      if (updated.tagId) {
        next[updated.tagId] = [updated, ...(next[updated.tagId] ?? [])];
      }
      return next;
    });
  }

  if (!isLoading && tags.length === 0) {
    return (
      <section className={styles.emptyState}>
        <TagsIcon className={styles.emptyIcon} size={48} strokeWidth={1.5} />
        <h1>Crea tu primera etiqueta</h1>
        <button className={styles.primaryButton} onClick={createNewTag} type="button">
          <Plus size={15} strokeWidth={1.75} />
          Nueva etiqueta
        </button>
      </section>
    );
  }

  return (
    <section className={styles.view}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Etiquetas</h1>
          <p className={styles.subtitle}>
            {tags.length} etiquetas - {totalEvents} eventos en total
          </p>
        </div>
        <button className={styles.primaryButton} onClick={createNewTag} type="button">
          <Plus size={15} strokeWidth={1.75} />
          Nueva etiqueta
        </button>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.toggle}>
          <input
            checked={upcomingOnly}
            onChange={(event) => setUpcomingOnly(event.target.checked)}
            type="checkbox"
          />
          Solo mostrar proximos eventos
        </label>
        <label className={styles.toggle}>
          <input
            checked={includeInbox}
            onChange={(event) => setIncludeInbox(event.target.checked)}
            type="checkbox"
          />
          Incluir Inbox
        </label>
        <select
          className={styles.select}
          onChange={(event) => setRange(event.target.value as RangeOption)}
          value={range}
        >
          {Object.entries(RANGE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Cargando etiquetas...</div>
      ) : (
        <div className={styles.kanban}>
          {tags.map((tag) => {
            const tagEvents = filteredByTag[tag.id] ?? [];
            return (
              <section className={styles.column} key={tag.id}>
                <header className={styles.columnHeader}>
                  <button
                    className={styles.columnTitle}
                    onClick={() => onOpenTag(tag.id)}
                    type="button"
                  >
                    <span
                      className={styles.columnDot}
                      style={{ backgroundColor: tag.color }}
                    />
                    <span>{tag.name}</span>
                    <span className={styles.countPill}>{tagEvents.length}</span>
                  </button>
                  <div className={styles.columnMenuWrap}>
                    <button
                      aria-label="Mas acciones"
                      className={styles.iconButton}
                      onClick={() =>
                        setMenuTagId(menuTagId === tag.id ? null : tag.id)
                      }
                      type="button"
                    >
                      <MoreHorizontal size={15} strokeWidth={1.75} />
                    </button>
                    {menuTagId === tag.id ? (
                      <div className={styles.columnMenu}>
                        <button onClick={() => renameTag(tag)} type="button">
                          Editar
                        </button>
                        <button onClick={() => removeTag(tag)} type="button">
                          Eliminar
                        </button>
                        <button onClick={() => onFilterTag(tag.id)} type="button">
                          Filtrar calendario por esta
                        </button>
                      </div>
                    ) : null}
                  </div>
                </header>

                <div className={styles.columnBody}>
                  {tagEvents.length === 0 ? (
                    <div className={styles.columnEmpty}>
                      <span>Sin eventos proximos</span>
                      <button
                        onClick={() => onCreateEventWithTag(tag.id)}
                        type="button"
                      >
                        Crear evento
                      </button>
                    </div>
                  ) : (
                    tagEvents.map((event) => (
                      <article
                        className={`${styles.eventCard} ${
                          event.completed ? styles.eventCompleted : ""
                        }`}
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        style={{ "--event-color": tag.color } as CSSProperties}
                      >
                        <div className={styles.eventTopLine}>
                          {event.completed ? (
                            <CheckCircle2
                              className={styles.checkIcon}
                              size={14}
                              strokeWidth={2}
                            />
                          ) : null}
                          <h2 className={styles.eventTitle}>{event.title}</h2>
                          <EventTagMenu
                            event={event}
                            onChanged={handleEventChanged}
                            onEdit={onEventClick}
                          />
                        </div>
                        <p className={styles.eventDate}>{formatEventDate(event)}</p>
                        {event.description ? (
                          <p className={styles.eventDescription}>
                            {event.description}
                          </p>
                        ) : null}
                        <footer className={styles.cardFooter}>
                          <span className={styles.typeChip}>
                            {TYPE_LABELS[event.type]}
                          </span>
                          <span
                            className={`${styles.priorityChip} ${
                              event.priority === "high" ? styles.highPriority : ""
                            }`}
                          >
                            {event.priority === "high" ? "Alta" : event.priority}
                          </span>
                          <span className={styles.durationChip}>
                            {formatDuration(event.durationMinutes)}
                          </span>
                        </footer>
                      </article>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
