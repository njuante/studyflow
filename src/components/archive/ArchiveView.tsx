import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Archive as ArchiveIcon, Check, Search, X } from "lucide-react";

import { useTags } from "../../hooks/useTags";
import { getArchiveEvents } from "../../lib/api";
import type { StudyEvent } from "../../types";
import styles from "./ArchiveView.module.css";

interface ArchiveViewProps {
  refreshKey: number;
  onEventClick: (event: StudyEvent) => void;
}

const PAGE_SIZE = 50;
const NEUTRAL_EVENT_COLOR = "#8e8e93";

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return capitalize(
    new Intl.DateTimeFormat("es-ES", {
      month: "long",
      year: "numeric",
    }).format(date),
  );
}

function formatDayLine(date: string, startTime: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  const dayLabel = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
  }).format(parsed);
  return `${dayLabel} · ${startTime}`;
}

export function ArchiveView({ refreshKey, onEventClick }: ArchiveViewProps) {
  const { tags, getTagById } = useTags();
  const [items, setItems] = useState<StudyEvent[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadFirstPage = useCallback(async () => {
    setIsLoading(true);
    try {
      const events = await getArchiveEvents(PAGE_SIZE, 0);
      setItems(events);
      setOffset(events.length);
      setHasMore(events.length === PAGE_SIZE);
    } catch {
      setItems([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage, refreshKey]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || isLoading) return;
    setIsLoadingMore(true);
    try {
      const events = await getArchiveEvents(PAGE_SIZE, offset);
      setItems((current) => [...current, ...events]);
      setOffset(offset + events.length);
      setHasMore(events.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoading, isLoadingMore, offset]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((event) => {
      if (onlyCompleted && !event.completed) return false;
      if (selectedTagIds.length > 0) {
        if (!event.tagId || !selectedTagIds.includes(event.tagId)) return false;
      }
      if (term && !event.title.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [items, onlyCompleted, search, selectedTagIds]);

  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, StudyEvent[]>();
    for (const event of filtered) {
      const key = event.date.slice(0, 7);
      const list = groups.get(key) ?? [];
      list.push(event);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  function toggleTag(id: string) {
    setSelectedTagIds((current) =>
      current.includes(id)
        ? current.filter((tagId) => tagId !== id)
        : [...current, id],
    );
  }

  return (
    <section className={styles.archive}>
      <header className={styles.header}>
        <h1 className={styles.title}>Archivo</h1>
        <p className={styles.subtitle}>{items.length} eventos pasados</p>
      </header>

      <div className={styles.toolbar}>
        <button
          className={`${styles.toggle} ${onlyCompleted ? styles.toggleActive : ""}`}
          onClick={() => setOnlyCompleted((current) => !current)}
          type="button"
        >
          <Check size={13} strokeWidth={2} />
          Solo completados
        </button>

        <div className={styles.tagFilter}>
          {tags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <button
                className={`${styles.tagChipButton} ${isSelected ? styles.tagChipActive : ""}`}
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                style={{
                  borderColor: isSelected ? tag.color : "transparent",
                  color: isSelected ? tag.color : "var(--text-secondary)",
                  backgroundColor: isSelected
                    ? `${tag.color}1f`
                    : "var(--bg-secondary)",
                }}
                type="button"
              >
                <span
                  className={styles.tagDot}
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </button>
            );
          })}
        </div>

        <label className={styles.searchWrap}>
          <Search size={14} strokeWidth={1.75} />
          <input
            className={styles.searchInput}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por título..."
            value={search}
          />
          {search ? (
            <button
              aria-label="Limpiar búsqueda"
              className={styles.searchClear}
              onClick={() => setSearch("")}
              type="button"
            >
              <X size={12} strokeWidth={1.75} />
            </button>
          ) : null}
        </label>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Cargando archivo...</div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <ArchiveIcon className={styles.emptyIcon} size={40} strokeWidth={1.5} />
          <h2 className={styles.emptyTitle}>Sin resultados</h2>
          <p className={styles.emptyText}>
            {items.length === 0
              ? "Aún no hay eventos pasados"
              : "Prueba a quitar filtros o cambiar la búsqueda"}
          </p>
        </div>
      ) : (
        <div className={styles.groups}>
          {groupedByMonth.map(([monthKey, monthEvents]) => (
            <div className={styles.group} key={monthKey}>
              <h2 className={styles.monthHeading}>{formatMonthLabel(monthKey)}</h2>
              <div className={styles.list}>
                {monthEvents.map((event) => {
                  const tag = getTagById(event.tagId);
                  const color = tag?.color ?? NEUTRAL_EVENT_COLOR;

                  return (
                    <button
                      className={`${styles.row} ${event.completed ? styles.rowCompleted : ""}`}
                      key={event.id}
                      onClick={() => onEventClick(event)}
                      style={
                        {
                          "--event-color": color,
                        } as CSSProperties
                      }
                      type="button"
                    >
                      <span
                        className={`${styles.checkBubble} ${event.completed ? styles.checkBubbleCompleted : ""}`}
                      >
                        {event.completed ? (
                          <Check size={12} strokeWidth={2.5} />
                        ) : null}
                      </span>
                      <span className={styles.dateLine}>
                        {formatDayLine(event.date, event.startTime)}
                      </span>
                      <span className={styles.titleLine}>{event.title}</span>
                      <span
                        className={styles.tagPill}
                        style={{
                          backgroundColor: `${color}24`,
                          color,
                        }}
                      >
                        {tag?.name ?? "Sin etiqueta"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div ref={sentinelRef} />
      {isLoadingMore ? (
        <div className={styles.loadingMore}>Cargando más...</div>
      ) : null}
    </section>
  );
}
