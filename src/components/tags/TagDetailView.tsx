import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Calendar,
  ChevronLeft,
  Edit3,
  Trash2,
} from "lucide-react";

import { useTags } from "../../hooks/useTags";
import {
  bulkChangeTag,
  completeEvent,
  deleteEvent,
  getEventsByTag,
  getTagStats,
  updateEvent,
} from "../../lib/api";
import type { StudyEvent, TagStats } from "../../types";
import { EventTagMenu } from "./EventTagMenu";
import styles from "./TagDetailView.module.css";

interface TagDetailViewProps {
  refreshKey: number;
  selectedTagId: string | null;
  onBack: () => void;
  onCreateEventWithTag: (tagId: string) => void;
  onEventClick: (event: StudyEvent) => void;
  onShowToast: (message: string, kind: "success" | "info" | "error") => void;
}

type DetailTab = "upcoming" | "past" | "inbox" | "all";

const PAGE_SIZE = 60;
const TAB_LABELS: Record<DetailTab, string> = {
  upcoming: "Proximos",
  past: "Pasados",
  inbox: "Inbox",
  all: "Todos",
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

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const total = hours * 60 + minutes + durationMinutes;
  return `${`${Math.floor(total / 60)}`.padStart(2, "0")}:${`${total % 60}`.padStart(2, "0")}`;
}

function groupLabel(date: string): string {
  const today = new Date();
  const todayIso = toIsoDate(today);
  const tomorrowIso = toIsoDate(addDays(today, 1));
  if (date === todayIso) return "Hoy";
  if (date === tomorrowIso) return "Manana";

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  const diffDays = Math.round(
    (parsed.getTime() - new Date(todayIso).getTime()) / 86_400_000,
  );
  if (diffDays >= 0 && diffDays < 7) return "Esta semana";
  if (diffDays >= 7 && diffDays < 14) return "Proxima semana";
  return new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function sortEvents(left: StudyEvent, right: StudyEvent): number {
  if (left.scheduled !== right.scheduled) return left.scheduled ? -1 : 1;
  return (
    left.date.localeCompare(right.date) ||
    left.startTime.localeCompare(right.startTime)
  );
}

export function TagDetailView({
  refreshKey,
  selectedTagId,
  onBack,
  onCreateEventWithTag,
  onEventClick,
  onShowToast,
}: TagDetailViewProps) {
  const { deleteTag, getTagById, tags, updateTag } = useTags();
  const tag = getTagById(selectedTagId);
  const [items, setItems] = useState<StudyEvent[]>([]);
  const [stats, setStats] = useState<TagStats | null>(null);
  const [tab, setTab] = useState<DetailTab>("upcoming");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [editPopoverOpen, setEditPopoverOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [colorDraft, setColorDraft] = useState("#378ADD");
  const [fadingIds, setFadingIds] = useState<string[]>([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const todayIso = toIsoDate(new Date());

  const loadFirstPage = useCallback(async () => {
    if (!selectedTagId) return;
    setIsLoading(true);
    setSelectedIds([]);
    try {
      const [events, nextStats] = await Promise.all([
        getEventsByTag(selectedTagId, {
          upcomingOnly: tab === "upcoming",
          includeInbox: true,
          inboxOnly: tab === "inbox",
          limit: PAGE_SIZE,
          offset: 0,
        }),
        getTagStats(selectedTagId),
      ]);
      setItems(events);
      setOffset(events.length);
      setHasMore(events.length === PAGE_SIZE);
      setStats(nextStats);
    } catch {
      setItems([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTagId, tab]);

  useEffect(() => {
    setNameDraft(tag?.name ?? "");
    setColorDraft(tag?.color ?? "#378ADD");
  }, [tag?.color, tag?.name]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage, refreshKey]);

  const loadMore = useCallback(async () => {
    if (!selectedTagId || isLoading || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const events = await getEventsByTag(selectedTagId, {
        upcomingOnly: tab === "upcoming",
        includeInbox: true,
        inboxOnly: tab === "inbox",
        limit: PAGE_SIZE,
        offset,
      });
      setItems((current) => [...current, ...events]);
      setOffset((current) => current + events.length);
      setHasMore(events.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoading, isLoadingMore, offset, selectedTagId, tab]);

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

  const visibleItems = useMemo(() => {
    return items
      .filter((event) => {
        if (tab === "inbox") return !event.scheduled;
        if (tab === "past") return event.scheduled && event.date < todayIso;
        if (tab === "upcoming") return event.scheduled && event.date >= todayIso;
        return true;
      })
      .sort(sortEvents);
  }, [items, tab, todayIso]);

  const grouped = useMemo(() => {
    const groups = new Map<string, StudyEvent[]>();
    for (const event of visibleItems) {
      const key = event.scheduled ? groupLabel(event.date) : "Inbox";
      const list = groups.get(key) ?? [];
      list.push(event);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [visibleItems]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const hasSelectAll = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a";
      if (hasSelectAll) {
        event.preventDefault();
        setSelectedIds(visibleItems.map((item) => item.id));
      }
      if (event.key === "Escape") {
        setSelectedIds([]);
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [visibleItems]);

  if (!tag || !selectedTagId) {
    return (
      <section className={styles.emptyState}>
        <Calendar size={44} strokeWidth={1.5} />
        <h1>Etiqueta no encontrada</h1>
        <button onClick={onBack} type="button">Volver</button>
      </section>
    );
  }

  const currentTag = tag;
  const completedCount = stats?.completedCount ?? 0;
  const totalEvents = stats?.totalEvents ?? 0;
  const progress = totalEvents > 0 ? (completedCount / totalEvents) * 100 : 0;

  async function saveInlineName() {
    if (!nameDraft.trim() || nameDraft.trim() === currentTag.name) {
      setEditingName(false);
      setNameDraft(currentTag.name);
      return;
    }
    try {
      await updateTag(
        currentTag.id,
        nameDraft.trim(),
        currentTag.color,
        currentTag.icon,
      );
      onShowToast("Etiqueta actualizada", "success");
    } catch {
      onShowToast("No se pudo actualizar la etiqueta", "error");
    } finally {
      setEditingName(false);
    }
  }

  async function removeTag() {
    if (!window.confirm(`Eliminar "${currentTag.name}"? Los eventos quedaran sin etiqueta.`)) {
      return;
    }
    try {
      await deleteTag(currentTag.id);
      onShowToast("Etiqueta eliminada", "info");
      onBack();
    } catch {
      onShowToast("No se pudo eliminar la etiqueta", "error");
    }
  }

  async function saveEditPopover() {
    if (!nameDraft.trim()) return;
    try {
      await updateTag(
        currentTag.id,
        nameDraft.trim(),
        colorDraft,
        currentTag.icon,
      );
      setEditPopoverOpen(false);
      onShowToast("Etiqueta actualizada", "success");
    } catch {
      onShowToast("No se pudo actualizar la etiqueta", "error");
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }

  function removeLocally(ids: string[]) {
    setFadingIds((current) => [...new Set([...current, ...ids])]);
    window.setTimeout(() => {
      setItems((current) => current.filter((event) => !ids.includes(event.id)));
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setFadingIds((current) => current.filter((id) => !ids.includes(id)));
    }, 200);
  }

  async function markSelectedCompleted() {
    const selected = visibleItems.filter(
      (event) => selectedIds.includes(event.id) && !event.completed,
    );
    const updated = await Promise.all(selected.map((event) => completeEvent(event.id)));
    setItems((current) =>
      current.map((event) =>
        updated.find((updatedEvent) => updatedEvent.id === event.id) ?? event,
      ),
    );
    setSelectedIds([]);
    onShowToast("Eventos marcados como completos", "success");
  }

  async function moveSelected(newTagId: string | null) {
    const ids = [...selectedIds];
    await bulkChangeTag(ids, newTagId);
    removeLocally(ids);
    onShowToast("Eventos movidos", "success");
  }

  async function deleteSelected() {
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) => deleteEvent(id)));
    removeLocally(ids);
    onShowToast("Eventos eliminados", "info");
  }

  function handleEventChanged(updated: StudyEvent) {
    if (updated.tagId !== currentTag.id) {
      removeLocally([updated.id]);
      return;
    }
    setItems((current) =>
      current.map((event) => (event.id === updated.id ? updated : event)),
    );
  }

  async function clearEventTag(event: StudyEvent) {
    const updated = await updateEvent({
      ...event,
      tagId: null,
      updatedAt: new Date().toISOString(),
    });
    handleEventChanged(updated);
  }

  const heatmapValues = new Map<string, number>();
  for (const event of items) {
    if (!event.scheduled) continue;
    heatmapValues.set(
      event.date,
      (heatmapValues.get(event.date) ?? 0) + event.durationMinutes,
    );
  }
  const heatmapDays = Array.from({ length: 35 }, (_, index) => {
    const day = addDays(new Date(), index - 14);
    const iso = toIsoDate(day);
    const minutes = heatmapValues.get(iso) ?? 0;
    let level: 0 | 1 | 2 | 3 | 4;
    if (minutes === 0) level = 0;
    else if (minutes < 60) level = 1;
    else if (minutes < 120) level = 2;
    else if (minutes < 240) level = 3;
    else level = 4;
    return { iso, level, label: formatDate(iso), minutes };
  });

  const HEATMAP_OPACITIES: Record<0 | 1 | 2 | 3 | 4, number> = {
    0: 0,
    1: 0.2,
    2: 0.4,
    3: 0.7,
    4: 1,
  };

  return (
    <section className={styles.view}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={onBack} type="button">
          <ChevronLeft size={18} strokeWidth={1.8} />
        </button>
        <span
          className={styles.bigDot}
          style={{ backgroundColor: currentTag.color }}
          aria-hidden="true"
        />
        <div className={styles.titleBlock}>
          {editingName ? (
            <input
              autoFocus
              className={styles.nameInput}
              onBlur={() => void saveInlineName()}
              onChange={(event) => setNameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveInlineName();
                if (event.key === "Escape") setEditingName(false);
              }}
              value={nameDraft}
            />
          ) : (
            <button
              className={styles.titleButton}
              onClick={() => setEditingName(true)}
              type="button"
            >
              {currentTag.name}
            </button>
          )}
          <p className={styles.subtitle}>
            {totalEvents} eventos - {formatHours(stats?.totalMinutes ?? 0)} totales -{" "}
            {completedCount} completados
          </p>
        </div>
        <div className={styles.headerActions}>
          <button onClick={() => setEditPopoverOpen(true)} type="button">
            <Edit3 size={14} strokeWidth={1.75} />
            Editar
          </button>
          <button className={styles.dangerButton} onClick={removeTag} type="button">
            <Trash2 size={14} strokeWidth={1.75} />
            Eliminar
          </button>
          {editPopoverOpen ? (
            <div className={styles.editPopover}>
              <label>
                <span>Nombre</span>
                <input
                  onChange={(event) => setNameDraft(event.target.value)}
                  value={nameDraft}
                />
              </label>
              <label>
                <span>Color</span>
                <input
                  onChange={(event) => setColorDraft(event.target.value)}
                  type="color"
                  value={colorDraft}
                />
              </label>
              <div className={styles.editPopoverActions}>
                <button onClick={() => setEditPopoverOpen(false)} type="button">
                  Cancelar
                </button>
                <button onClick={() => void saveEditPopover()} type="button">
                  Guardar
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <div className={styles.statsRow}>
        <StatCard label="Total eventos" value={`${totalEvents}`} />
        <StatCard label="Horas totales" value={formatHours(stats?.totalMinutes ?? 0)} />
        <div className={styles.statCard}>
          <span>Completados / pendientes</span>
          <strong>{completedCount}/{Math.max(totalEvents - completedCount, 0)}</strong>
          <div className={styles.progressTrack}>
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        <StatCard
          label="Proximo evento"
          value={stats?.nextEventDate ? formatDate(stats.nextEventDate) : "Sin eventos proximos"}
        />
      </div>

      <div className={styles.heatmapWrap}>
        <div className={styles.heatmapDays} aria-hidden="true">
          {["L", "M", "X", "J", "V", "S", "D"].map((label) => (
            <span className={styles.heatmapDay} key={label}>
              {label}
            </span>
          ))}
        </div>
        <div className={styles.heatmapGrid}>
          {heatmapDays.map((day) => {
            const opacity = HEATMAP_OPACITIES[day.level];
            const background =
              opacity === 0
                ? "var(--heatmap-empty)"
                : `${currentTag.color}${Math.round(opacity * 255)
                    .toString(16)
                    .padStart(2, "0")}`;
            return (
              <div
                className={styles.heatmapCell}
                key={day.iso}
                style={{ background }}
                title={`${day.label}: ${formatHours(day.minutes)} dedicadas`}
              />
            );
          })}
        </div>
      </div>

      <div className={styles.tabs}>
        {(Object.keys(TAB_LABELS) as DetailTab[]).map((tabId) => (
          <button
            className={tab === tabId ? styles.tabActive : ""}
            key={tabId}
            onClick={() => setTab(tabId)}
            type="button"
          >
            {TAB_LABELS[tabId]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className={styles.loading}>Cargando eventos...</div>
      ) : visibleItems.length === 0 ? (
        <div className={styles.emptyState}>
          <Calendar size={44} strokeWidth={1.5} />
          <h1>Sin eventos en esta etiqueta</h1>
          <button
            className={styles.primaryButton}
            onClick={() => onCreateEventWithTag(currentTag.id)}
            type="button"
          >
            Crear evento con esta etiqueta
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {grouped.map(([label, groupEvents]) => (
            <section className={styles.group} key={label}>
              <h2 className={styles.groupHeader}>{label}</h2>
              {groupEvents.map((event) => {
                const isSelected = selectedIds.includes(event.id);
                return (
                  <article
                    className={`${styles.row} ${
                      event.completed ? styles.rowCompleted : ""
                    } ${isSelected ? styles.rowSelected : ""} ${
                      fadingIds.includes(event.id) ? styles.rowFading : ""
                    }`}
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    style={{ "--tag-color": currentTag.color } as CSSProperties}
                  >
                    <label
                      className={styles.selectBox}
                      onClick={(clickEvent) => clickEvent.stopPropagation()}
                    >
                      <input
                        checked={isSelected}
                        onChange={() => toggleSelected(event.id)}
                        type="checkbox"
                      />
                    </label>
                    <span className={styles.rowTime}>
                      {event.scheduled ? event.startTime : "Inbox"}
                    </span>
                    <div className={styles.rowMain}>
                      <h3>{event.title}</h3>
                      <span>
                        {event.scheduled
                          ? `${formatDate(event.date)} - ${formatEndTime(event.startTime, event.durationMinutes)}`
                          : "Sin programar"}
                      </span>
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        className={styles.rowAction}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          onEventClick(event);
                        }}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className={`${styles.rowAction} ${styles.rowActionSuccess}`}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          void completeEvent(event.id).then(handleEventChanged);
                        }}
                        type="button"
                      >
                        {event.completed ? "Pendiente" : "Completo"}
                      </button>
                      <button
                        className={styles.rowAction}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          void clearEventTag(event);
                        }}
                        type="button"
                      >
                        Sin etiqueta
                      </button>
                      <EventTagMenu
                        event={event}
                        onChanged={handleEventChanged}
                        onDelete={() => {
                          void deleteEvent(event.id).then(() => removeLocally([event.id]));
                        }}
                      />
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
          <div ref={sentinelRef} />
          {isLoadingMore ? (
            <div className={styles.loadingMore}>Cargando mas...</div>
          ) : null}
        </div>
      )}

      {selectedIds.length > 0 ? (
        <div className={styles.selectionToolbar}>
          <strong>{selectedIds.length} seleccionados</strong>
          <button onClick={() => void markSelectedCompleted()} type="button">
            Marcar completos
          </button>
          <select
            onChange={(event) => {
              const value = event.target.value;
              if (!value) return;
              void moveSelected(value === "__none" ? null : value);
              event.target.value = "";
            }}
          >
            <option value="">Mover a etiqueta...</option>
            {tags.map((optionTag) => (
              <option key={optionTag.id} value={optionTag.id}>
                {optionTag.name}
              </option>
            ))}
            <option value="__none">Sin etiqueta</option>
          </select>
          <button onClick={() => void deleteSelected()} type="button">
            Eliminar
          </button>
        </div>
      ) : null}
    </section>
  );
}

interface StatCardProps {
  label: string;
  value: string;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className={styles.statCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
